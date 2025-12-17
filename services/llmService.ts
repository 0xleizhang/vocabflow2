import { Language } from '../i18n/translations';
import { Annotation, LLMProvider, PronunciationFeedback } from '../types';
import * as geminiService from './geminiService';
import * as openaiService from './openaiService';

// TTS audio result type (re-export)
export interface TTSAudioResult {
  data: ArrayBuffer;
  mimeType: string;
}

/**
 * Unified interface for fetching TTS audio from any provider
 */
export const fetchTTSAudio = async (
  text: string,
  apiKey: string,
  provider: LLMProvider,
  voice?: string
): Promise<TTSAudioResult> => {
  if (provider === 'openai') {
    return openaiService.fetchTTSAudio(text, apiKey, voice || 'alloy');
  } else {
    return geminiService.fetchTTSAudio(text, apiKey, voice || 'Puck');
  }
};

/**
 * Unified interface for fetching word annotations from any provider
 */
export const fetchWordAnnotation = async (
  word: string,
  contextSentence: string,
  apiKey: string,
  provider: LLMProvider,
  language: Language = 'zh'
): Promise<Annotation> => {
  if (provider === 'openai') {
    return openaiService.fetchWordAnnotation(word, contextSentence, apiKey, language);
  } else {
    return geminiService.fetchWordAnnotation(word, contextSentence, apiKey, language);
  }
};

/**
 * Unified interface for analyzing pronunciation from any provider
 */
export const analyzePronunciation = async (
  audioBlob: Blob,
  originalText: string,
  apiKey: string,
  provider: LLMProvider,
  language: Language = 'zh'
): Promise<PronunciationFeedback> => {
  if (provider === 'openai') {
    return openaiService.analyzePronunciation(audioBlob, originalText, apiKey, language);
  } else {
    return geminiService.analyzePronunciation(audioBlob, originalText, apiKey, language);
  }
};

/**
 * Clear TTS cache for specified provider
 */
export const clearTTSCache = (provider: LLMProvider) => {
  if (provider === 'openai') {
    openaiService.clearTTSCache();
  } else {
    geminiService.clearTTSCache();
  }
};

/**
 * Clear annotation cache for specified provider
 */
export const clearAnnotationCache = (provider: LLMProvider) => {
  if (provider === 'openai') {
    openaiService.clearAnnotationCache();
  } else {
    geminiService.clearAnnotationCache();
  }
};
