import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Annotation } from '../types';

// Base64 decode helper for audio data
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Convert PCM data to WAV format
function pcmToWav(pcmData: ArrayBuffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.byteLength;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const pcmView = new Uint8Array(pcmData);
  const wavView = new Uint8Array(buffer);
  wavView.set(pcmView, headerSize);

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// TTS audio result type
export interface TTSAudioResult {
  data: ArrayBuffer;
  mimeType: string;
}

// TTS audio cache - stores audio data by text content
const ttsCache = new Map<string, TTSAudioResult>();

// Max cache size to prevent memory issues (cache up to 50 sentences)
const MAX_TTS_CACHE_SIZE = 50;

/**
 * Fetch TTS audio from Gemini API with caching
 * Returns audio data with mimeType
 */
export const fetchTTSAudio = async (text: string, apiKey: string): Promise<TTSAudioResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Check cache first
  const cacheKey = text.trim();
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    console.log("TTS cache hit:", cacheKey.slice(0, 30) + "...");
    return cached;
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: text,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Puck'
            }
          }
        }
      }
    });

    // Extract audio data from response
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData?.data && part?.inlineData?.mimeType) {
      const rawData = base64ToArrayBuffer(part.inlineData.data);
      const mimeType = part.inlineData.mimeType;

      console.log("TTS audio mimeType:", mimeType);

      // Check if it's PCM data and convert to WAV
      let audioData: ArrayBuffer;
      let outputMimeType: string;

      if (mimeType.includes('L16') || mimeType.includes('pcm')) {
        // Parse sample rate from mimeType (e.g., "audio/L16;codec=pcm;rate=24000")
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;

        console.log("Converting PCM to WAV, sampleRate:", sampleRate);
        audioData = pcmToWav(rawData, sampleRate);
        outputMimeType = 'audio/wav';
      } else {
        audioData = rawData;
        outputMimeType = mimeType;
      }

      const result: TTSAudioResult = { data: audioData, mimeType: outputMimeType };

      // Manage cache size - remove oldest entries if full
      if (ttsCache.size >= MAX_TTS_CACHE_SIZE) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) {
          ttsCache.delete(firstKey);
        }
      }

      // Store in cache
      ttsCache.set(cacheKey, result);
      console.log("TTS cached:", cacheKey.slice(0, 30) + "...");

      return result;
    }

    throw new Error("No audio data in response");
  } catch (error) {
    console.error("Error fetching TTS audio:", error);
    throw error;
  }
};

/**
 * Clear the TTS cache (useful when text content changes)
 */
export const clearTTSCache = () => {
  ttsCache.clear();
  console.log("TTS cache cleared");
};

export const fetchWordAnnotation = async (word: string, contextSentence: string, apiKey: string): Promise<Annotation> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Initialize the client dynamically with the user-provided key
  const ai = new GoogleGenAI({ apiKey });

  try {
    const prompt = `
      Analyze the English word "${word}".
      Context: "${contextSentence}".
      
      Provide:
      1. The IPA phonetic transcription (British or American general).
      2. A concise Chinese definition (max 10 chars) suitable for this context.
      
      Return as JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ipa: { type: Type.STRING, description: "IPA phonetic transcription, e.g., /həˈləʊ/" },
            definition: { type: Type.STRING, description: "Concise Chinese definition" },
          },
          required: ["ipa", "definition"],
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No response from AI");
    }

    return JSON.parse(jsonText) as Annotation;

  } catch (error) {
    console.error("Error fetching annotation:", error);
    throw error;
  }
};