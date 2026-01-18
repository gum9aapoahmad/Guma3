import React, { useState, useRef, useEffect } from 'react';
import { ImageEditor } from './components/ImageEditor';
import { 
  analyzeContent, 
  generateImageWithPro, 
  transcribeAudio, 
  fastChat, 
  searchPlaces,
  textToSpeech,
  generateVideo,
} from './services/geminiService';

const ApiKeySelector: React.FC<{ onSelect: () => void; onBack?: () => void; }> = ({ onSelect, onBack }) => (
  <div className="flex flex-col justify-center items-center text-center p-8 animate-fade-in h-full">
    <div className="glass-panel p-10 rounded-3xl max-w-2xl mx-auto shadow-2xl">
      <h1 className="text-4xl font-black text-gradient mb-4 font-serif">مفتاح API مطلوب</h1>
      <p className="text-gray-300 mb-6 leading-relaxed">
        لإنشاء صور عالية الدقة (Pro) أو مقاطع فيديو (Veo)، يتطلب الأمر استخدام مفتاح API من مشروع Google Cloud مرتبط بحساب فوترة. هذه الميزات المتقدمة لها تكلفة استخدام.
      </p>
      <button onClick={onSelect} className="gold-gradient text-black font-black py-4 px-10 rounded-full hover:bg-yellow-400 transition-all shadow-2xl flex items-center gap-3 transform hover:scale-105 mx-auto">
        <span>اختيار مفتاح API</span>
      </button>
      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="block text-yellow-400 mt-6 text-sm hover:underline">
        تعرف على المزيد حول الفوترة
      </a>
      {onBack && <button onClick={onBack} className="mt-8 text-gray-400 text-sm hover:text-white">
        العودة إلى الخدمات الأخرى
      </button>}
    </div>
  </div>
);

const loadingMessages = [
  "يتم الآن إعداد الكاميرات...",
  "يقوم المخرج بمراجعة النص...",
  "يتم الآن بناء المشهد الرقمي...",
  "لحظات ويبدأ التصوير...",
  "تتم الآن معالجة الإطارات الأولى...",
  "يتم تطبيق المؤثرات الخاصة...",
  "قد يستغرق هذا بضع دقائق، شكراً لصبرك...",
];

// Audio processing helpers
const decodeBase64 = (base64: string): Uint8Array => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const pcmToWav = (pcmData: Uint8Array, sampleRate: number, numChannels: number): Blob => {
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    new Uint8Array(buffer, 44).set(pcmData);

    return new Blob([buffer], { type: 'audio/wav' });
};

const App: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'studio' | 'create' | 'video' | 'maps' | 'tts'>('editor');
  
  // API Key State
  const [hasSelectedKey, setHasSelectedKey] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // Chatbot State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string; audio?: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [useFastMode, setUseFastMode] = useState(false);

  // Maps State
  const [mapsInput, setMapsInput] = useState('');
  const [mapsResult, setMapsResult] = useState<string | null>(null);
  const [isMapsLoading, setIsMapsLoading] = useState(false);

  // Creation State
  const [genPrompt, setGenPrompt] = useState('');
  const [genSize, setGenSize] = useState<"1K" | "2K" | "4K">("1K");
  const [genRatio, setGenRatio] = useState("1:1");
  const [genResult, setGenResult] = useState<string | null>(null);
  const [isGenLoading, setIsGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Video State
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
  
  // TTS State
  const [ttsInput, setTtsInput] = useState('');
  const [ttsVoice, setTtsVoice] = useState('Kore');
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [ttsResultUrl, setTtsResultUrl] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      setIsCheckingKey(true);
      if (await window.aistudio?.hasSelectedApiKey()) {
        setHasSelectedKey(true);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  useEffect(() => {
    let interval: number;
    if (isVideoLoading) {
      let i = 0;
      interval = window.setInterval(() => {
        i = (i + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[i]);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isVideoLoading]);

  const handleSelectKey = async () => {
      await window.aistudio?.openSelectKey();
      setHasSelectedKey(true); // Assume success to avoid race conditions
  };

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    const res = useFastMode ? await fastChat(userMsg) : await analyzeContent(userMsg);
    
    let audioUrl: string | undefined;
    if (res.text) {
      const ttsBase64 = await textToSpeech(res.text.slice(0, 250), 'Kore');
      if (ttsBase64) {
        try {
          const pcmData = decodeBase64(ttsBase64);
          const wavBlob = pcmToWav(pcmData, 24000, 1);
          audioUrl = URL.createObjectURL(wavBlob);
        } catch (e) { console.error("Error processing chat audio:", e); }
      }
    }

    setChatHistory(prev => [...prev, { role: 'ai', text: res.text || res.error || '', audio: audioUrl }]);
    setIsChatLoading(false);
  };

  const handleMapsSearch = async () => {
    if (!mapsInput.trim()) return;
    setIsMapsLoading(true);
    
    let location: { lat: number; lng: number } | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
      location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch (e) {
      console.warn("Location not available");
    }

    const res = await searchPlaces(mapsInput, location);
    setMapsResult(res.text || res.error || null);
    setIsMapsLoading(false);
  };

  const handleGenerate = async () => {
    if (!genPrompt.trim()) return;
    setIsGenLoading(true);
    setGenResult(null);
    setGenError(null);
    const res = await generateImageWithPro(genPrompt, { aspectRatio: genRatio, imageSize: genSize });
    if (res.imageUrls && res.imageUrls.length > 0) {
      setGenResult(res.imageUrls[0]);
    } else {
      const errorMsg = res.error || "حدث خطأ غير متوقع.";
      setGenError(errorMsg);
      if (errorMsg.toLowerCase().includes("permission") || errorMsg.toLowerCase().includes("not found")) {
        setHasSelectedKey(false);
      }
    }
    setIsGenLoading(false);
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    setIsVideoLoading(true);
    setVideoResult(null);
    setVideoError(null);
    
    const res = await generateVideo(videoPrompt);
    
    if (res.videoUrl) {
      setVideoResult(res.videoUrl);
    } else {
      const errorMsg = res.error || "حدث خطأ غير متوقع.";
      setVideoError(errorMsg);
      if (errorMsg.toLowerCase().includes("permission") || errorMsg.toLowerCase().includes("not found")) {
        setHasSelectedKey(false);
      }
    }
    setIsVideoLoading(false);
  };
  
  const handleGenerateSpeech = async () => {
    if (!ttsInput.trim()) {
      setTtsError("الرجاء إدخال نص أولاً.");
      return;
    }
    setIsTtsLoading(true);
    setTtsResultUrl(null);
    setTtsError(null);

    const base64Audio = await textToSpeech(ttsInput, ttsVoice);

    if (base64Audio) {
      try {
        const pcmData = decodeBase64(base64Audio);
        const wavBlob = pcmToWav(pcmData, 24000, 1); // TTS model returns 24kHz mono
        const url = URL.createObjectURL(wavBlob);
        setTtsResultUrl(url);
      } catch (e: any) {
        setTtsError(`حدث خطأ أثناء معالجة الصوت: ${e.message}`);
      }
    } else {
      setTtsError("فشل في إنشاء الصوت. حاول مرة أخرى.");
    }
    setIsTtsLoading(false);
  };

  const needsApiKey = activeTab === 'create' || activeTab === 'video';

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#8b8b8b] border-b border-black/10 h-16 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <button className="text-white text-3xl p-2 hover:bg-black/10 rounded-lg transition-colors" onClick={toggleMobileMenu}>
            ☰
          </button>
          <div className="flex items-center gap-0">
            <div className="bg-[#facc15] px-4 py-1 flex items-center justify-center h-10 shadow-inner">
              <span className="text-black text-sm font-black uppercase tracking-tighter">Jumaa Creative Studio</span>
            </div>
            <div className="bg-[#facc15] w-10 h-10 flex items-center justify-center mr-0.5 border-l border-black/5 animate-pulse-glow shadow-lg">
              <span className="text-black text-2xl font-black font-serif">ج</span>
            </div>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[60] bg-black/80 backdrop-blur-md" onClick={toggleMobileMenu}>
            <div className="bg-[#8b8b8b] w-64 h-full p-6 shadow-2xl flex flex-col gap-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-white font-bold text-xl border-b border-white/20 pb-4 text-right font-serif">القائمة الرئيسية</h2>
              <button onClick={() => {setActiveTab('editor'); setMobileMenuOpen(false);}} className="text-white text-right py-2 text-lg hover:text-yellow-400 font-bold">تعديل الصور (Flash)</button>
              <button onClick={() => {setActiveTab('create'); setMobileMenuOpen(false);}} className="text-white text-right py-2 text-lg hover:text-yellow-400 font-bold">إنشاء صور (Pro)</button>
              <button onClick={() => {setActiveTab('studio'); setMobileMenuOpen(false);}} className="text-white text-right py-2 text-lg hover:text-yellow-400 font-bold">تحليل وذكاء (Pro)</button>
              <button onClick={() => {setActiveTab('maps'); setMobileMenuOpen(false);}} className="text-white text-right py-2 text-lg hover:text-yellow-400 font-bold">خرائط وخدمات</button>
              <button onClick={() => {setActiveTab('video'); setMobileMenuOpen(false);}} className="text-white text-right py-2 text-lg hover:text-yellow-400 font-bold">فيديو Veo</button>
              <button onClick={() => {setActiveTab('tts'); setMobileMenuOpen(false);}} className="text-white text-right py-2 text-lg hover:text-yellow-400 font-bold">تحويل النص لصوت</button>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow pt-16">
        <div className="bg-black/30 py-8 px-4 border-b border-white/5">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl md:text-4xl font-black text-gradient mb-6 font-serif">مركز جمعة للإبداع الذكي</h1>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => setActiveTab('editor')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'editor' ? 'gold-gradient text-black shadow-lg scale-105' : 'glass-panel text-white hover:bg-white/10'}`}>✨ تعديل</button>
              <button onClick={() => setActiveTab('create')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'create' ? 'gold-gradient text-black shadow-lg scale-105' : 'glass-panel text-white hover:bg-white/10'}`}>🎨 إنشاء</button>
              <button onClick={() => setActiveTab('studio')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'studio' ? 'gold-gradient text-black shadow-lg scale-105' : 'glass-panel text-white hover:bg-white/10'}`}>🧠 تحليل</button>
              <button onClick={() => setActiveTab('maps')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'maps' ? 'gold-gradient text-black shadow-lg scale-105' : 'glass-panel text-white hover:bg-white/10'}`}>📍 خرائط</button>
              <button onClick={() => setActiveTab('video')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'video' ? 'gold-gradient text-black shadow-lg scale-105' : 'glass-panel text-white hover:bg-white/10'}`}>🎬 فيديو</button>
              <button onClick={() => setActiveTab('tts')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'tts' ? 'gold-gradient text-black shadow-lg scale-105' : 'glass-panel text-white hover:bg-white/10'}`}>🎤 صوت</button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {activeTab === 'editor' && <ImageEditor />}
          
          {activeTab === 'create' && (
            needsApiKey && !hasSelectedKey && !isCheckingKey ?
            <ApiKeySelector onSelect={handleSelectKey} onBack={() => setActiveTab('editor')} /> :
            <div className="glass-panel p-8 rounded-3xl animate-fade-in space-y-8">
               <h2 className="text-2xl font-black text-yellow-400 font-serif">إنشاء صور بدقة (Nano Banana Pro)</h2>
               <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <textarea 
                      value={genPrompt}
                      onChange={e => setGenPrompt(e.target.value)}
                      placeholder="صف الصورة التي تتخيلها..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 h-32 outline-none focus:border-yellow-400"
                    />
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="text-xs text-gray-400 block mb-2 font-bold">الدقة</label>
                         <select value={genSize} onChange={e => setGenSize(e.target.value as any)} className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm focus:border-yellow-400 outline-none">
                           <option value="1K">1K</option>
                           <option value="2K">2K</option>
                           <option value="4K">4K</option>
                         </select>
                       </div>
                       <div>
                         <label className="text-xs text-gray-400 block mb-2 font-bold">الأبعاد</label>
                         <select value={genRatio} onChange={e => setGenRatio(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm focus:border-yellow-400 outline-none">
                           <option value="1:1">1:1</option>
                           <option value="16:9">16:9</option>
                           <option value="9:16">9:16</option>
                           <option value="4:3">4:3</option>
                         </select>
                       </div>
                    </div>
                    <button onClick={handleGenerate} disabled={isGenLoading} className="w-full gold-gradient text-black font-black py-4 rounded-2xl hover:scale-105 transition-transform disabled:opacity-50 disabled:grayscale shadow-xl">
                      {isGenLoading ? 'جارِ الرسم...' : 'رسم الصورة ✨'}
                    </button>
                    {genError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm text-center font-bold animate-slide-in">{genError}</div>}
                 </div>
                 <div className="bg-black/40 rounded-3xl flex items-center justify-center min-h-[300px] border border-white/5 relative overflow-hidden shadow-inner">
                    {isGenLoading ? <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-yellow-400"></div> : null}
                    {genResult ? <img src={genResult} alt="Generated" className="rounded-2xl max-h-[500px] animate-fade-in-scale-up border border-white/10" /> : !isGenLoading && <p className="text-gray-600 font-bold">ستظهر الصورة هنا</p>}
                 </div>
               </div>
            </div>
          )}

          {activeTab === 'studio' && (
            <div className="glass-panel p-6 rounded-3xl animate-fade-in space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-yellow-400 font-serif">الدردشة والذكاء التحليلي</h2>
                <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  <span className="text-xs text-gray-400 font-bold">وضع الاستجابة السريعة (Lite)</span>
                  <input type="checkbox" checked={useFastMode} onChange={e => setUseFastMode(e.target.checked)} className="accent-yellow-400" />
                </label>
              </div>
              <div className="h-[400px] overflow-y-auto mb-4 flex flex-col gap-4 p-4 bg-black/40 rounded-2xl scroll-smooth shadow-inner border border-white/5">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`p-4 rounded-2xl max-w-[85%] animate-slide-in ${msg.role === 'user' ? 'bg-yellow-500/10 mr-auto border border-yellow-500/20' : 'bg-blue-500/10 ml-auto border border-blue-500/20 shadow-lg'}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                    {msg.audio && (
                      <audio src={msg.audio} controls className="mt-2 h-8 w-full scale-90" />
                    )}
                  </div>
                ))}
                {isChatLoading && <div className="animate-pulse text-yellow-400 text-sm font-bold p-2">جارِ التفكير...</div>}
              </div>
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-yellow-400 shadow-inner" placeholder="اسأل أي شيء..." />
                <button onClick={handleChat} className="gold-gradient text-black px-6 rounded-xl font-black shadow-lg hover:scale-105 transition-transform">إرسال</button>
              </div>
            </div>
          )}

          {activeTab === 'maps' && (
            <div className="glass-panel p-8 rounded-3xl animate-fade-in space-y-6">
              <h2 className="text-2xl font-black text-yellow-400 font-serif">خرائط وخدمات محلية (Grounding)</h2>
              <div className="flex gap-2">
                <input 
                  value={mapsInput} 
                  onChange={e => setMapsInput(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleMapsSearch()}
                  placeholder="ابحث عن أماكن قريبة (مثال: مطاعم إيطالية في حلب)..." 
                  className="flex-grow bg-white/5 border border-white/10 rounded-xl px-4 py-4 outline-none focus:border-yellow-400 shadow-inner" 
                />
                <button onClick={handleMapsSearch} disabled={isMapsLoading} className="gold-gradient text-black px-8 rounded-xl font-black shadow-lg hover:scale-105 transition-transform">
                  {isMapsLoading ? 'بحث...' : 'بحث 📍'}
                </button>
              </div>
              {mapsResult && (
                <div className="bg-black/40 p-6 rounded-2xl border border-white/5 text-gray-200 whitespace-pre-wrap leading-relaxed animate-slide-in shadow-inner">
                  {mapsResult}
                </div>
              )}
            </div>
          )}

          {activeTab === 'video' && (
            needsApiKey && !hasSelectedKey && !isCheckingKey ?
            <ApiKeySelector onSelect={handleSelectKey} onBack={() => setActiveTab('editor')} /> :
            <div className="glass-panel p-10 rounded-3xl animate-fade-in space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-yellow-400 font-serif">إنتاج فيديو Veo</h2>
                <p className="text-gray-400 mt-2 font-bold">حوّل وصفك إلى فيديو سينمائي مذهل خلال دقائق</p>
              </div>
              
              {!isVideoLoading && !videoResult && (
                <div className="max-w-xl mx-auto space-y-4">
                  <textarea 
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 h-32 outline-none focus:border-yellow-400 shadow-inner" 
                    placeholder="مثال: قطة ترتدي نظارات شمسية وتقود سيارة رياضية في مدينة مستقبلية..." 
                  />
                  <button 
                    onClick={handleGenerateVideo} 
                    disabled={!videoPrompt.trim()}
                    className="w-full gold-gradient text-black px-12 py-4 rounded-2xl font-black text-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale shadow-xl"
                  >
                    بدء الإنتاج الذكي 🎬
                  </button>
                </div>
              )}

              {isVideoLoading && (
                 <div className="text-center p-12 w-full space-y-6">
                   <div className="w-24 h-24 mx-auto relative">
                      <div className="absolute inset-0 border-8 border-yellow-400/10 rounded-full"></div>
                      <div className="absolute inset-0 border-8 border-yellow-400 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">🎬</div>
                   </div>
                   <div className="space-y-2">
                     <p className="text-yellow-400 font-black text-2xl animate-pulse">يتم الآن الإنتاج...</p>
                     <p className="text-gray-400 text-sm font-bold">{loadingMessage}</p>
                   </div>
                </div>
              )}

              {videoResult && (
                <div className="space-y-4 text-center">
                  <video src={videoResult} controls autoPlay loop className="w-full max-w-2xl mx-auto rounded-2xl shadow-2xl border border-white/20 animate-fade-in-scale-up" />
                  <button
                    onClick={() => { setVideoResult(null); setVideoPrompt(''); setVideoError(null); }}
                    className="text-yellow-400 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                  >
                    إنشاء فيديو آخر
                  </button>
                </div>
              )}
              
              {videoError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm text-center animate-slide-in shadow-lg max-w-xl mx-auto font-bold">
                  {videoError}
                </div>
              )}
            </div>
          )}

          {activeTab === 'tts' && (
            <div className="glass-panel p-10 rounded-3xl animate-fade-in space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-yellow-400 font-serif">تحويل النص إلى صوت (TTS)</h2>
                <p className="text-gray-400 mt-2 font-bold">أدخل نصك، اختر صوتاً، واستمع إلى السحر.</p>
              </div>
              
              <div className="max-w-2xl mx-auto space-y-4">
                <textarea 
                  value={ttsInput}
                  onChange={(e) => setTtsInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 h-40 outline-none focus:border-yellow-400 shadow-inner" 
                  placeholder="اكتب النص الذي تريد تحويله إلى كلام هنا..." 
                />
                <div>
                  <label className="text-xs text-gray-400 block mb-2 font-bold">اختر الصوت</label>
                  <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm focus:border-yellow-400 outline-none">
                    <option value="Kore">Kore (أنثى)</option>
                    <option value="Puck">Puck (ذكر)</option>
                    <option value="Charon">Charon (ذكر)</option>
                    <option value="Fenrir">Fenrir (أنثى)</option>
                    <option value="Zephyr">Zephyr (أنثى)</option>
                  </select>
                </div>
                <button 
                  onClick={handleGenerateSpeech} 
                  disabled={isTtsLoading || !ttsInput.trim()}
                  className="w-full gold-gradient text-black px-12 py-4 rounded-2xl font-black text-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale shadow-xl"
                >
                  {isTtsLoading ? 'جارِ إنشاء الصوت...' : 'إنشاء الصوت 🎤'}
                </button>
              </div>

              {isTtsLoading && (
                <div className="text-center p-8 w-full space-y-4">
                  <div className="animate-pulse text-yellow-400 text-xl font-bold">
                    ... يرجى الانتظار قليلاً ...
                  </div>
                </div>
              )}

              {ttsResultUrl && (
                <div className="text-center space-y-4 animate-slide-in">
                  <h3 className="text-lg font-black text-green-400 uppercase tracking-widest">تم إنشاء الصوت بنجاح!</h3>
                  <audio src={ttsResultUrl} controls className="mx-auto w-full max-w-md shadow-2xl rounded-full" />
                </div>
              )}
              
              {ttsError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm text-center animate-slide-in shadow-lg max-w-xl mx-auto font-bold">
                  {ttsError}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-black/50 border-t border-white/10 py-8 px-4 text-center">
        <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">© 2024 Jumaa Creative Studio | استوديو الإبداع الذكي</p>
      </footer>
    </div>
  );
};

export default App;