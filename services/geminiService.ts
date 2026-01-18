import { GoogleGenAI, Type, Modality } from "@google/genai";

export interface GeminiResponse {
  imageUrls?: string[];
  videoUrl?: string;
  text?: string;
  error?: string;
  groundingLinks?: any[];
}

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * Edit image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const editImageWithGemini = async (
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: prompt }
        ]
      }
    });

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
        return { error: "تم حظر المحتوى لأسباب تتعلق بالسلامة." };
    }

    const imageUrls: string[] = [];
    response.candidates?.forEach(candidate => {
        candidate.content?.parts?.forEach(part => {
            if (part.inlineData?.data) {
                imageUrls.push(`data:image/png;base64,${part.inlineData.data}`);
            }
        });
    });

    return { imageUrls, text: response.text };
  } catch (error: any) {
    return { error: `خطأ: ${error.message}` };
  }
};

/**
 * Generate images with Gemini 3 Pro Image Preview (Nano Banana Pro)
 */
export const generateImageWithPro = async (
  prompt: string,
  config: { aspectRatio?: string; imageSize?: "1K" | "2K" | "4K" }
): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: config.aspectRatio || "1:1",
          imageSize: config.imageSize || "1K"
        }
      }
    });

    const imageUrls: string[] = [];
    response.candidates?.forEach(candidate => {
        candidate.content?.parts?.forEach(part => {
            if (part.inlineData?.data) {
                imageUrls.push(`data:image/png;base64,${part.inlineData.data}`);
            }
        });
    });

    return { imageUrls };
  } catch (error: any) {
    return { error: `خطأ في الإنشاء: ${error.message}` };
  }
};

/**
 * Fast responses using gemini-2.5-flash-lite
 */
export const fastChat = async (prompt: string): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-latest',
      contents: prompt
    });
    return { text: response.text };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Analyze content using Gemini 3 Pro Preview with Thinking Budget and Search Grounding
 */
export const analyzeContent = async (
  prompt: string,
  mediaData?: { data: string; mimeType: string }[]
): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    const parts: any[] = [{ text: prompt }];
    mediaData?.forEach(media => {
      parts.push({ inlineData: { data: media.data, mimeType: media.mimeType } });
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        tools: [{ googleSearch: {} }]
      }
    });

    return { 
      text: response.text, 
      groundingLinks: response.candidates?.[0]?.groundingMetadata?.groundingChunks 
    };
  } catch (error: any) {
    return { error: `خطأ: ${error.message}` };
  }
};

/**
 * Maps Grounding using gemini-2.5-flash
 */
export const searchPlaces = async (prompt: string, location?: { lat: number; lng: number }): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    const config: any = { tools: [{ googleMaps: {} }] };
    if (location) {
      config.toolConfig = { retrievalConfig: { latLng: { latitude: location.lat, longitude: location.lng } } };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config
    });

    return { 
      text: response.text,
      groundingLinks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Transcribe Audio using Gemini 3 Flash Preview
 */
export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Audio, mimeType } },
          { text: "يرجى نسخ هذا المقطع الصوتي بدقة." }
        ]
      }
    });
    return { text: response.text };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Generate Video using Veo
 */
export const generateVideo = async (
  prompt: string,
  image?: { data: string; mimeType: string },
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<GeminiResponse> => {
  try {
    const ai = getAI();
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt,
      ...(image ? { image: { imageBytes: image.data, mimeType: image.mimeType } } : {}),
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    });

    while (!operation.done) {
      await new Promise(r => setTimeout(r, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const res = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await res.blob();
    return { videoUrl: URL.createObjectURL(blob) };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Text-to-Speech using Gemini 2.5 Flash Preview TTS
 */
export const textToSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string | undefined> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error", error);
    return undefined;
  }
};