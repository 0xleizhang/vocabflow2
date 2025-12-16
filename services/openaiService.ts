import OpenAI from 'openai';
import { Annotation, PronunciationFeedback, WordError } from '../types';

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
const TTS_CACHE_PREFIX = 'vocabflow_openai_tts_';
const TTS_CACHE_INDEX_KEY = 'vocabflow_openai_tts_index';

// Max cache size
const MAX_TTS_CACHE_SIZE = 20;

// In-memory cache for fast access during session
const memoryCache = new Map<string, TTSAudioResult>();

// Base64 decode helper for audio data
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Generate a cache key from text
function getCacheKey(text: string): string {
  let hash = 0;
  const str = text.trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return TTS_CACHE_PREFIX + Math.abs(hash).toString(36);
}

// Get cache index
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

  if (memoryCache.has(text.trim())) {
    return memoryCache.get(text.trim())!;
  }

  try {
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;

    const entry: TTSCacheEntry = JSON.parse(stored);
    const data = base64ToArrayBuffer(entry.base64);
    const result: TTSAudioResult = { data, mimeType: entry.mimeType };

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

  memoryCache.set(textKey, result);

  try {
    const base64 = arrayBufferToBase64(result.data);
    const entry: TTSCacheEntry = {
      base64,
      mimeType: result.mimeType,
      timestamp: Date.now()
    };

    let index = getCacheIndex();
    index = index.filter(e => e.text !== textKey);

    while (index.length >= MAX_TTS_CACHE_SIZE) {
      const oldest = index.shift();
      if (oldest) {
        localStorage.removeItem(oldest.key);
        memoryCache.delete(oldest.text);
      }
    }

    index.push({ key: cacheKey, text: textKey, timestamp: Date.now() });

    localStorage.setItem(cacheKey, JSON.stringify(entry));
    saveCacheIndex(index);

    console.log("OpenAI TTS cached:", textKey.slice(0, 30) + "...");
  } catch (e) {
    console.warn("Failed to save TTS to localStorage:", e);
  }
}

/**
 * Clear the TTS cache (both memory and localStorage)
 */
export const clearTTSCache = () => {
  memoryCache.clear();

  const index = getCacheIndex();
  for (const entry of index) {
    localStorage.removeItem(entry.key);
  }
  localStorage.removeItem(TTS_CACHE_INDEX_KEY);

  console.log("OpenAI TTS cache cleared");
};

/**
 * Fetch TTS audio from OpenAI API with caching
 */
export const fetchTTSAudio = async (text: string, apiKey: string): Promise<TTSAudioResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Check cache first
  const cached = getFromLocalStorage(text);
  if (cached) {
    console.log("OpenAI TTS cache hit:", text.trim().slice(0, 30) + "...");
    return cached;
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true // Note: In production, use a backend proxy
  });

  try {
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      speed: 1.0
    });

    const arrayBuffer = await mp3Response.arrayBuffer();
    const result: TTSAudioResult = {
      data: arrayBuffer,
      mimeType: 'audio/mpeg'
    };

    saveToLocalStorage(text, result);
    return result;
  } catch (error) {
    console.error("Error fetching OpenAI TTS audio:", error);
    throw error;
  }
};

// ============================================
// Word Annotation Cache
// ============================================

const ANNOTATION_CACHE_PREFIX = 'vocabflow_openai_annotation_';
const ANNOTATION_CACHE_INDEX_KEY = 'vocabflow_openai_annotation_index';
const MAX_ANNOTATION_CACHE_SIZE = 500;

const annotationMemoryCache = new Map<string, Annotation>();

function getAnnotationCacheKey(word: string): string {
  return ANNOTATION_CACHE_PREFIX + word.toLowerCase().trim();
}

function getAnnotationCacheIndex(): { key: string; word: string; timestamp: number }[] {
  try {
    const index = localStorage.getItem(ANNOTATION_CACHE_INDEX_KEY);
    return index ? JSON.parse(index) : [];
  } catch {
    return [];
  }
}

function saveAnnotationCacheIndex(index: { key: string; word: string; timestamp: number }[]): void {
  try {
    localStorage.setItem(ANNOTATION_CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.warn("Failed to save annotation cache index:", e);
  }
}

function getAnnotationFromCache(word: string): Annotation | null {
  const wordKey = word.toLowerCase().trim();
  const cacheKey = getAnnotationCacheKey(word);

  if (annotationMemoryCache.has(wordKey)) {
    return annotationMemoryCache.get(wordKey)!;
  }

  try {
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;

    const annotation: Annotation = JSON.parse(stored);
    annotationMemoryCache.set(wordKey, annotation);
    return annotation;
  } catch (e) {
    console.warn("Failed to read annotation from localStorage:", e);
    return null;
  }
}

function saveAnnotationToCache(word: string, annotation: Annotation): void {
  const wordKey = word.toLowerCase().trim();
  const cacheKey = getAnnotationCacheKey(word);

  annotationMemoryCache.set(wordKey, annotation);

  try {
    let index = getAnnotationCacheIndex();
    index = index.filter(e => e.word !== wordKey);

    while (index.length >= MAX_ANNOTATION_CACHE_SIZE) {
      const oldest = index.shift();
      if (oldest) {
        localStorage.removeItem(oldest.key);
        annotationMemoryCache.delete(oldest.word);
      }
    }

    index.push({ key: cacheKey, word: wordKey, timestamp: Date.now() });

    localStorage.setItem(cacheKey, JSON.stringify(annotation));
    saveAnnotationCacheIndex(index);

    console.log("OpenAI annotation cached:", wordKey);
  } catch (e) {
    console.warn("Failed to save annotation to localStorage:", e);
  }
}

/**
 * Clear the annotation cache
 */
export const clearAnnotationCache = () => {
  annotationMemoryCache.clear();

  const index = getAnnotationCacheIndex();
  for (const entry of index) {
    localStorage.removeItem(entry.key);
  }
  localStorage.removeItem(ANNOTATION_CACHE_INDEX_KEY);

  console.log("OpenAI annotation cache cleared");
};

/**
 * Fetch word annotation using OpenAI API
 */
export const fetchWordAnnotation = async (
  word: string,
  contextSentence: string,
  apiKey: string
): Promise<Annotation> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  const cached = getAnnotationFromCache(word);
  if (cached) {
    console.log("OpenAI annotation cache hit:", word);
    return cached;
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });

  try {
    const prompt = `Analyze the English word "${word}".
Context: "${contextSentence}".

Provide:
1. The IPA phonetic transcription (British or American general).
2. A concise Chinese definition (max 10 chars) suitable for this context.

Return as JSON with fields: ipa, definition`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const jsonText = response.choices[0]?.message?.content;
    if (!jsonText) {
      throw new Error("No response from OpenAI");
    }

    const annotation = JSON.parse(jsonText) as Annotation;
    saveAnnotationToCache(word, annotation);

    return annotation;
  } catch (error) {
    console.error("Error fetching OpenAI annotation:", error);
    throw error;
  }
};

/**
 * Analyze pronunciation using OpenAI Whisper + GPT
 */
export const analyzePronunciation = async (
  audioBlob: Blob,
  originalText: string,
  apiKey: string
): Promise<PronunciationFeedback> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });

  try {
    // First, transcribe the audio using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBlob], "audio.webm", { type: audioBlob.type }),
      model: "whisper-1",
    });

    const transcribedText = transcription.text;

    // Then, use GPT to analyze pronunciation
    const prompt = `You are an English pronunciation coach. The student was supposed to read:
"${originalText}"

But they actually said:
"${transcribedText}"

Analyze the pronunciation and provide feedback in JSON format with:
1. score: A number from 0-100 rating the overall pronunciation quality
2. feedback: A brief overall comment in Chinese (1-2 sentences)
3. errors: An array of words that had pronunciation issues, each with:
   - word: the mispronounced word (must match exactly a word in the original text)
   - issue: a brief description of the issue in Chinese (e.g., "元音发音不准", "重音位置错误", "尾音不清晰")

Be encouraging but honest. If the pronunciation is good, return an empty errors array.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const jsonText = response.choices[0]?.message?.content;
    if (!jsonText) {
      throw new Error("No response from OpenAI");
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
    console.error("Error analyzing pronunciation with OpenAI:", error);
    throw error;
  }
};
