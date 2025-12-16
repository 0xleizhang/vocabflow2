export type LLMProvider = 'gemini' | 'openai';

export interface Annotation {
  ipa: string;
  definition: string;
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