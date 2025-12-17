export type LLMProvider = 'gemini' | 'openai';

// TTS Voice types for each provider
export type GeminiVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Voice display names
export const GEMINI_VOICES: { id: GeminiVoice; name: string }[] = [
  { id: 'Puck', name: 'Puck' },
  { id: 'Charon', name: 'Charon' },
  { id: 'Kore', name: 'Kore' },
  { id: 'Fenrir', name: 'Fenrir' },
  { id: 'Aoede', name: 'Aoede' },
];

export const OPENAI_VOICES: { id: OpenAIVoice; name: string }[] = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'onyx', name: 'Onyx' },
  { id: 'nova', name: 'Nova' },
  { id: 'shimmer', name: 'Shimmer' },
];

export interface Annotation {
  ipa: string;
  definition: string;  // 英汉释义
  definitionEn?: string;  // 英英释义
  syllables?: string;  // 音节拆分，例如: "hel-lo"
  roots?: string;  // 词根
  affixes?: string;  // 词缀
  etymology?: string;  // 词源（保留用于向后兼容）
  synonyms?: string[];  // 近义词列表
  synonymAnalysis?: string;  // 近义词辨析
  antonyms?: string[];  // 反义词（optional）
  associations?: string[];  // 联想词（optional）
  phrases?: string[];  // 常用词组（optional）
}

export interface WordToken {
  id: string;
  text: string;
  isWord: boolean; // true if it's a clickable word, false if punctuation/whitespace
  status: 'idle' | 'loading' | 'success' | 'error';
  annotation?: Annotation;
  sentenceIndex: number; // Added for TTS sentence tracking
}

export type ViewMode = 'edit' | 'read';

export type InteractionMode = 'read' | 'listen' | 'pronounce' | 'write';

// Word mastery tracking for writing mode
export interface WordMastery {
  word: string;           // The word (lowercase)
  annotation: Annotation; // The annotation for this word
  correctCount: number;   // Number of times answered correctly
  lastCorrect?: number;   // Timestamp of last correct answer
}

// Storage structure for a text's looked-up words
export interface TextWordData {
  textHash: string;       // Hash of the text to identify it
  words: WordMastery[];   // All looked-up words for this text
  updatedAt: number;      // Last update timestamp
}

export interface WordError {
  word: string;
  issue: string; // e.g., "发音不准", "重音错误"
}

export interface PronunciationFeedback {
  id: string;
  sentence: string;
  timestamp: Date;
  score: number; // 0-100
  feedback: string;
  errors: WordError[];
  audioUrl?: string; // URL for playback of recorded audio
}