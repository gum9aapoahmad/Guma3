import React, { useState, useRef } from 'react';
import { editImageWithGemini } from '../services/geminiService';

export const ImageEditor: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB limit for performance

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError("حجم الصورة كبير جداً. يرجى اختيار صورة أصغر من 4 ميجابايت.");
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError("نوع الملف غير مدعوم. يرجى اختيار ملف صورة صالح.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        setSelectedImage(base64Data);
        setMimeType(file.type);
        setFileName(file.name);
        setGeneratedImages([]);
      };
      reader.onerror = () => {
        setError("فشل في قراءة الملف. حاول مرة أخرى.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage(null);
    setMimeType('');
    setFileName('');
    setGeneratedImages([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if (!selectedImage) {
      setError('يرجى اختيار صورة أولاً.');
      return;
    }

    if (!prompt.trim()) {
      setError('يرجى كتابة وصف للتعديل المطلوب.');
      return;
    }

    if (prompt.trim().length < 3) {
      setError('الوصف قصير جداً. يرجى تقديم تفاصيل أكثر.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const result = await editImageWithGemini(selectedImage, mimeType, prompt);
      
      if (result.error) {
        setError(result.error);
      } else if (result.imageUrls && result.imageUrls.length > 0) {
        setGeneratedImages(result.imageUrls);
        setCurrentImageIndex(0);
      } else {
        setError("حدث خطأ غير متوقع. لم يتم استلام نتيجة من الذكاء الاصطناعي.");
      }
    } catch (err) {
      // Updated error message as per user request to be more informative and in English
      setError("We encountered a problem processing your request. Please check your internet connection and try again. If the problem persists, contact support.");
    } finally {
      setLoading(false);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex(prev => (prev + 1) % generatedImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(prev => (prev - 1 + generatedImages.length) % generatedImages.length);
  };


  return (
    <section id="ai-editor" className="py-20 px-4 bg-black/20 relative overflow-hidden">
      {/* Decorative background effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block animate-bounce mb-4">
             <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">إبداع بلا حدود</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-black mb-4 font-serif">
            <span className="text-gradient">استوديو الذكاء الاصطناعي</span>
          </h2>
          <p className="text-gray-300 text-xl max-w-2xl mx-auto leading-relaxed">
            قم برفع صورة واطلب تعديلها باستخدام أحدث تقنيات Gemini 2.5.
            <br/>
            <span className="text-sm text-yellow-400 mt-2 block">مثال: "أضف خلفية غروب شمس"، "اجعل الصورة بنمط كرتوني"</span>
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-white/10 shadow-2xl transition-all duration-500">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            
            {/* Input & Preview Section */}
            <div className="space-y-6">
              <div 
                className={`group relative border-2 border-dashed rounded-2xl transition-all duration-300 ${selectedImage ? 'border-green-500/50 bg-green-500/5 p-4' : 'border-white/20 p-10 cursor-pointer hover:border-yellow-400/50 hover:bg-white/5'}`}
                onClick={() => !selectedImage && fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                {selectedImage ? (
                  <div className="animate-slide-in">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-green-400 font-bold text-sm">تأكيد الصورة المختارة</span>
                      </div>
                      <button 
                        onClick={handleRemoveImage}
                        className="text-gray-400 hover:text-red-400 transition-all p-2 bg-black/40 rounded-full hover:bg-red-500/20"
                        title="حذف الصورة"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/40 group/preview transition-all duration-500">
                      <img 
                        src={`data:${mimeType};base64,${selectedImage}`} 
                        alt="Preview" 
                        className="max-h-80 mx-auto object-contain transition-transform group-hover/preview:scale-[1.03] duration-700"
                      />
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/70 backdrop-blur-md text-xs text-gray-200 truncate text-center font-mono">
                        {fileName}
                      </div>
                    </div>

                    <div className="mt-5 flex justify-center">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors font-bold flex items-center gap-2 px-4 py-2 border border-yellow-400/30 rounded-full hover:bg-yellow-400/5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        تغيير الصورة
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 text-gray-400 group-hover:text-yellow-400 transition-all duration-500 group-hover:scale-110">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-200 font-black text-xl mb-2">ارفع الصورة هنا</p>
                    <p className="text-gray-500 text-sm">JPG, PNG أو WEBP (الحد الأقصى 4 ميجابايت)</p>
                  </div>
                )}
              </div>

              <div className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
                <label className="block text-gray-300 font-bold mb-3 text-sm flex items-center gap-2" htmlFor="prompt">
                  <span className="w-6 h-6 rounded-full bg-yellow-400 text-black flex items-center justify-center text-xs">٢</span>
                  صف التعديلات التي تريدها
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="مثال: اجعل الصورة تبدو في الفضاء، غير لون القميص للأخضر، أضف طابعاً قديماً..."
                  className="w-full bg-black/50 border border-white/20 rounded-2xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all resize-none h-36 shadow-inner"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !selectedImage || !prompt.trim()}
                className={`w-full py-5 rounded-2xl font-black text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-2xl
                  ${loading || !selectedImage || !prompt.trim() 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed grayscale' 
                    : 'gold-gradient text-black glow-effect hover:shadow-yellow-400/20'
                  }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-6 w-6 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>جارِ المعالجة السحرية...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">✨</span>
                    <span>بدء التعديل الذكي</span>
                  </>
                )}
              </button>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm text-center animate-slide-in shadow-lg">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-black uppercase tracking-widest">تنبيه</span>
                  </div>
                  {error}
                </div>
              )}
            </div>

            {/* Result Area */}
            <div className="h-full min-h-[450px] bg-black/40 rounded-3xl border border-white/10 flex flex-col items-center justify-center relative overflow-hidden group shadow-inner">
              {generatedImages.length > 0 ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 animate-fade-in-scale-up">
                  <div className="mb-4 text-green-400 font-black flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    اكتملت المعالجة!
                  </div>
                  <div className="relative group/result w-full">
                    <img
                      key={currentImageIndex}
                      src={generatedImages[currentImageIndex]}
                      alt={`AI Generated Result ${currentImageIndex + 1}`}
                      className="max-w-full max-h-[480px] rounded-2xl shadow-2xl mx-auto border border-white/20 transition-all duration-300 animate-fade-in"
                    />

                    {generatedImages.length > 1 && (
                      <>
                        <button onClick={prevImage} aria-label="الصورة السابقة" className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/70 transition-all opacity-0 group-hover/result:opacity-100 focus:opacity-100">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        <button onClick={nextImage} aria-label="الصورة التالية" className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full hover:bg-black/70 transition-all opacity-0 group-hover/result:opacity-100 focus:opacity-100">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                        <div className="absolute top-4 right-4 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-md">
                          {currentImageIndex + 1} / {generatedImages.length}
                        </div>
                      </>
                    )}
                    
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover/result:opacity-100 transition-all duration-500 flex items-center justify-center rounded-2xl">
                       <a 
                        href={generatedImages[currentImageIndex]}
                        download={`jumaa-ai-edit-${currentImageIndex + 1}.png`}
                        className="bg-white text-black font-black py-4 px-10 rounded-full hover:bg-yellow-400 transition-all shadow-2xl flex items-center gap-3 transform translate-y-4 group-hover/result:translate-y-0"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        تحميل النتيجة النهائية
                      </a>
                    </div>
                  </div>
                  
                  {generatedImages.length > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      {generatedImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          aria-label={` والانتقال للصورة ${index + 1}`}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentImageIndex ? 'bg-yellow-400 scale-125' : 'bg-gray-600 hover:bg-gray-400'}`}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col items-center gap-2">
                     <p className="text-gray-400 text-xs text-center font-semibold italic">
                      {generatedImages.length > 1 ? `تم إنشاء ${generatedImages.length} صور. تصفح النتائج!` : 'بإمكانك دائماً المحاولة مرة أخرى بوصف مختلف'}
                    </p>
                    <button 
                      onClick={() => setGeneratedImages([])}
                      className="text-xs text-yellow-500/70 hover:text-yellow-400 transition-colors uppercase tracking-widest font-black"
                    >
                      بدء تعديل جديد
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-12 w-full">
                  {loading ? (
                    <div className="space-y-6">
                       <div className="w-24 h-24 mx-auto relative">
                          <div className="absolute inset-0 border-8 border-yellow-400/10 rounded-full"></div>
                          <div className="absolute inset-0 border-8 border-yellow-400 rounded-full border-t-transparent animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center text-2xl animate-pulse">🎨</div>
                       </div>
                       <div className="space-y-2">
                         <p className="text-yellow-400 font-black text-2xl animate-pulse">يتم الآن الرسم...</p>
                         <p className="text-gray-500 text-sm">نقوم بتحليل صورتك وإضافة اللمسات السحرية</p>
                       </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-24 h-24 mx-auto mb-6 bg-white/5 rounded-full flex items-center justify-center transition-all duration-500 group-hover:bg-white/10">
                        <svg className="w-12 h-12 text-gray-500 group-hover:text-yellow-400/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <h4 className="text-gray-300 text-2xl font-black mb-2 font-serif">معرض النتائج</h4>
                      <p className="text-gray-500 text-base max-w-xs mx-auto">ارفع صورتك واكتب وصفاً لنريك سحر الذكاء اصطناعي</p>
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};