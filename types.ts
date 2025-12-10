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