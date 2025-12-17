import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Language } from '../i18n/translations';
import { Annotation, PronunciationFeedback, WordError } from '../types';
import { getTargetLanguageCode } from './i18nService';

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

// LocalStorage cache entry (stores base64 for persistence)
interface TTSCacheEntry {
  base64: string;
  mimeType: string;
  timestamp: number;
}

// LocalStorage key prefix
const TTS_CACHE_PREFIX = 'vocabflow_tts_';
const TTS_CACHE_INDEX_KEY = 'vocabflow_tts_index';

// Max cache size (limit to ~20 entries to stay within localStorage limits)
const MAX_TTS_CACHE_SIZE = 20;

// In-memory cache for fast access during session
const memoryCache = new Map<string, TTSAudioResult>();

// Generate a cache key from text
function getCacheKey(text: string): string {
  // Use a simple hash to create shorter keys
  let hash = 0;
  const str = text.trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return TTS_CACHE_PREFIX + Math.abs(hash).toString(36);
}

// Get cache index (list of cached keys with timestamps)
function getCacheIndex(): { key: string; text: string; timestamp: number }[] {
  try {
    const index = localStorage.getItem(TTS_CACHE_INDEX_KEY);
    return index ? JSON.parse(index) : [];
  } catch {
    return [];
  }
}

// Save cache index
function saveCacheIndex(index: { key: string; text: string; timestamp: number }[]): void {
  try {
    localStorage.setItem(TTS_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn("Failed to save TTS cache index:", e);
  }
}

// Get cached TTS from localStorage
function getFromLocalStorage(text: string): TTSAudioResult | null {
  const cacheKey = getCacheKey(text);

  // Check memory cache first
  if (memoryCache.has(text.trim())) {
    return memoryCache.get(text.trim())!;
  }

  try {
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;

    const entry: TTSCacheEntry = JSON.parse(stored);
    const data = base64ToArrayBuffer(entry.base64);
    const result: TTSAudioResult = { data, mimeType: entry.mimeType };

    // Store in memory cache for faster subsequent access
    memoryCache.set(text.trim(), result);

    return result;
  } catch (e) {
    console.warn("Failed to read TTS from localStorage:", e);
    return null;
  }
}

// Save TTS to localStorage
function saveToLocalStorage(text: string, result: TTSAudioResult): void {
  const cacheKey = getCacheKey(text);
  const textKey = text.trim();

  // Store in memory cache
  memoryCache.set(textKey, result);

  try {
    // Convert ArrayBuffer to base64
    const base64 = arrayBufferToBase64(result.data);
    const entry: TTSCacheEntry = {
      base64,
      mimeType: result.mimeType,
      timestamp: Date.now()
    };

    // Update index
    let index = getCacheIndex();

    // Remove existing entry for this text if present
    index = index.filter(e => e.text !== textKey);

    // Manage cache size - remove oldest entries if full
    while (index.length >= MAX_TTS_CACHE_SIZE) {
      const oldest = index.shift();
      if (oldest) {
        localStorage.removeItem(oldest.key);
        memoryCache.delete(oldest.text);
      }
    }

    // Add new entry
    index.push({ key: cacheKey, text: textKey, timestamp: Date.now() });

    // Save to localStorage
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    saveCacheIndex(index);

    console.log("TTS cached to localStorage:", textKey.slice(0, 30) + "...");
  } catch (e) {
    console.warn("Failed to save TTS to localStorage (quota exceeded?):", e);
    // If storage fails, at least we have it in memory
  }
}

/**
 * Fetch TTS audio from Gemini API with caching (persisted to localStorage)
 * Returns audio data with mimeType
 */
export const fetchTTSAudio = async (text: string, apiKey: string, voice: string = 'Puck'): Promise<TTSAudioResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Include voice in cache key
  const cacheKey = `${text}_${voice}`;
  
  // Check cache first (memory + localStorage)
  const cached = getFromLocalStorage(cacheKey);
  if (cached) {
    console.log("TTS cache hit:", text.trim().slice(0, 30) + "...");
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
              voiceName: voice
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

      // Store in cache with voice-specific key (memory + localStorage)
      saveToLocalStorage(cacheKey, result);

      return result;
    }

    throw new Error("No audio data in response");
  } catch (error) {
    console.error("Error fetching TTS audio:", error);
    throw error;
  }
};

/**
 * Clear the TTS cache (both memory and localStorage)
 */
export const clearTTSCache = () => {
  // Clear memory cache
  memoryCache.clear();

  // Clear localStorage cache
  const index = getCacheIndex();
  for (const entry of index) {
    localStorage.removeItem(entry.key);
  }
  localStorage.removeItem(TTS_CACHE_INDEX_KEY);

  console.log("TTS cache cleared (memory + localStorage)");
};

// ============================================
// Word Annotation Cache (localStorage)
// ============================================

const ANNOTATION_CACHE_PREFIX = 'vocabflow_annotation_';
const ANNOTATION_CACHE_INDEX_KEY = 'vocabflow_annotation_index';
const MAX_ANNOTATION_CACHE_SIZE = 500; // Can store many more annotations than audio

// In-memory cache for fast access during session
const annotationMemoryCache = new Map<string, Annotation>();

// Get annotation cache key (word in lowercase)
function getAnnotationCacheKey(word: string): string {
  return ANNOTATION_CACHE_PREFIX + word.toLowerCase().trim();
}

// Get annotation cache index
function getAnnotationCacheIndex(): { key: string; word: string; timestamp: number }[] {
  try {
    const index = localStorage.getItem(ANNOTATION_CACHE_INDEX_KEY);
    return index ? JSON.parse(index) : [];
  } catch {
    return [];
  }
}

// Save annotation cache index
function saveAnnotationCacheIndex(index: { key: string; word: string; timestamp: number }[]): void {
  try {
    localStorage.setItem(ANNOTATION_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn("Failed to save annotation cache index:", e);
  }
}

// Get cached annotation from localStorage
function getAnnotationFromCache(word: string): Annotation | null {
  const wordKey = word.toLowerCase().trim();
  const cacheKey = getAnnotationCacheKey(word);

  // Check memory cache first
  if (annotationMemoryCache.has(wordKey)) {
    return annotationMemoryCache.get(wordKey)!;
  }

  try {
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;

    const annotation: Annotation = JSON.parse(stored);

    // Store in memory cache for faster subsequent access
    annotationMemoryCache.set(wordKey, annotation);

    return annotation;
  } catch (e) {
    console.warn("Failed to read annotation from localStorage:", e);
    return null;
  }
}

// Save annotation to localStorage
function saveAnnotationToCache(word: string, annotation: Annotation): void {
  const wordKey = word.toLowerCase().trim();
  const cacheKey = getAnnotationCacheKey(word);

  // Store in memory cache
  annotationMemoryCache.set(wordKey, annotation);

  try {
    // Update index
    let index = getAnnotationCacheIndex();

    // Remove existing entry for this word if present
    index = index.filter(e => e.word !== wordKey);

    // Manage cache size - remove oldest entries if full
    while (index.length >= MAX_ANNOTATION_CACHE_SIZE) {
      const oldest = index.shift();
      if (oldest) {
        localStorage.removeItem(oldest.key);
        annotationMemoryCache.delete(oldest.word);
      }
    }

    // Add new entry
    index.push({ key: cacheKey, word: wordKey, timestamp: Date.now() });

    // Save to localStorage
    localStorage.setItem(cacheKey, JSON.stringify(annotation));
    saveAnnotationCacheIndex(index);

    console.log("Annotation cached:", wordKey);
  } catch (e) {
    console.warn("Failed to save annotation to localStorage:", e);
  }
}

/**
 * Clear the annotation cache (both memory and localStorage)
 */
export const clearAnnotationCache = () => {
  annotationMemoryCache.clear();

  const index = getAnnotationCacheIndex();
  for (const entry of index) {
    localStorage.removeItem(entry.key);
  }
  localStorage.removeItem(ANNOTATION_CACHE_INDEX_KEY);

  console.log("Annotation cache cleared");
};

export const fetchWordAnnotation = async (word: string, contextSentence: string, apiKey: string, language: Language = 'zh'): Promise<Annotation> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Check cache first
  const cached = getAnnotationFromCache(word);
  if (cached) {
    console.log("Annotation cache hit:", word);
    return cached;
  }

  // Initialize the client dynamically with the user-provided key
  const ai = new GoogleGenAI({ apiKey });

  try {
    const targetLang = getTargetLanguageCode(language);
    const prompt = `
      Analyze the English word "${word}" in context: "${contextSentence}".

      Provide comprehensive information:
      1. IPA phonetic transcription (British or American)
      2. Concise definition in ${targetLang} (max 10 chars) for this context - translate to ${targetLang}
      3. English dictionary definition (concise, 1 sentence in English)
      4. Syllable breakdown (e.g., "hel-lo", "com-mu-ni-ca-tion")
      5. Word roots in English with explanations (e.g., "dict (say, speak)")
      6. Affixes in English with explanations (e.g., "pre- (before), -ion (noun suffix)")
      7. 2-4 synonyms in ENGLISH words (e.g., "happy, joyful, cheerful")
      8. Synonym analysis in ${targetLang} (brief explanation of differences between synonyms in ${targetLang})
      9. Antonyms in ENGLISH words (optional, if clear antonyms exist)
      10. Associated words in ENGLISH (optional, thematically related English words)
      11. Common phrases in English (optional, 2-3 common collocations or phrases)

      IMPORTANT: Field 2 (definition) and field 8 (synonym analysis) should be in ${targetLang}. All other fields must be in English.
      Return complete JSON. Use empty string "" for missing text fields, empty array [] for missing list fields.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ipa: { type: Type.STRING, description: "IPA phonetic transcription" },
            definition: { type: Type.STRING, description: "Concise Chinese definition" },
            definitionEn: { type: Type.STRING, description: "English dictionary definition" },
            syllables: { type: Type.STRING, description: "Syllable breakdown" },
            roots: { type: Type.STRING, description: "Word roots" },
            affixes: { type: Type.STRING, description: "Prefixes and suffixes" },
            synonyms: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of synonyms" 
            },
            synonymAnalysis: { type: Type.STRING, description: "Synonym analysis in Chinese" },
            antonyms: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "List of antonyms" 
            },
            associations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Associated words for memory" 
            },
            phrases: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Common phrases or collocations" 
            },
          },
          required: ["ipa", "definition", "definitionEn", "syllables", "roots", "affixes", "synonyms", "synonymAnalysis", "antonyms", "associations", "phrases"],
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No response from AI");
    }

    const annotation = JSON.parse(jsonText) as Annotation;

    // Save to cache
    saveAnnotationToCache(word, annotation);

    return annotation;

  } catch (error) {
    console.error("Error fetching annotation:", error);
    throw error;
  }
};

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Analyze pronunciation by comparing user's audio against the original text
 * Returns feedback with score, comments, and error words
 */
export const analyzePronunciation = async (
  audioBlob: Blob,
  originalText: string,
  apiKey: string,
  language: Language = 'zh'
): Promise<PronunciationFeedback> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = arrayBufferToBase64(arrayBuffer);

    const targetLang = getTargetLanguageCode(language);
    const prompt = `You are an English pronunciation coach. Listen to this audio recording where a student reads the following text:

"${originalText}"

Analyze the pronunciation and provide feedback in JSON format with:
1. score: A number from 0-100 rating the overall pronunciation quality
2. feedback: A brief overall comment in ${targetLang} (1-2 sentences)
3. errors: An array of words that had pronunciation issues, each with:
   - word: the mispronounced word (must match exactly a word in the original text)
   - issue: a brief description of the issue in ${targetLang} (e.g., for Chinese: "元音发音不准", "重音位置错误", "尾音不清晰")

Be encouraging but honest. If the pronunciation is good, return an empty errors array.
Focus on significant errors that affect comprehension.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: audioBlob.type || 'audio/webm',
                data: base64Audio
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Pronunciation score 0-100" },
            feedback: { type: Type.STRING, description: "Overall feedback in Chinese" },
            errors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING, description: "The mispronounced word" },
                  issue: { type: Type.STRING, description: "Description of the issue in Chinese" }
                },
                required: ["word", "issue"]
              }
            }
          },
          required: ["score", "feedback", "errors"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(jsonText) as { score: number; feedback: string; errors: WordError[] };

    return {
      id: `feedback-${Date.now()}`,
      sentence: originalText,
      timestamp: new Date(),
      score: result.score,
      feedback: result.feedback,
      errors: result.errors || []
    };

  } catch (error) {
    console.error("Error analyzing pronunciation:", error);
    throw error;
  }
};