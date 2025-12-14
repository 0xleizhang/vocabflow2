import { Annotation, TextWordData, WordMastery } from '../types';

const STORAGE_KEY_PREFIX = 'vocabflow_words_';
const MASTERY_THRESHOLD = 3; // Number of correct answers to master a word

// Generate a hash for the text to use as a unique identifier
function hashText(text: string): string {
  let hash = 0;
  const str = text.trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Get the storage key for a text
function getStorageKey(textHash: string): string {
  return STORAGE_KEY_PREFIX + textHash;
}

// Load word data for a specific text
export function loadWordData(text: string): TextWordData | null {
  const textHash = hashText(text);
  const key = getStorageKey(textHash);

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as TextWordData;
  } catch (e) {
    console.warn("Failed to load word data:", e);
    return null;
  }
}

// Save word data for a specific text
function saveWordData(data: TextWordData): void {
  const key = getStorageKey(data.textHash);

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save word data:", e);
  }
}

// Add or update a looked-up word
export function addLookedUpWord(text: string, word: string, annotation: Annotation): void {
  const textHash = hashText(text);
  let data = loadWordData(text);

  if (!data) {
    data = {
      textHash,
      words: [],
      updatedAt: Date.now()
    };
  }

  const wordLower = word.toLowerCase();
  const existingIndex = data.words.findIndex(w => w.word === wordLower);

  if (existingIndex === -1) {
    // Add new word
    data.words.push({
      word: wordLower,
      annotation,
      correctCount: 0
    });
  } else {
    // Update annotation if it changed
    data.words[existingIndex].annotation = annotation;
  }

  data.updatedAt = Date.now();
  saveWordData(data);
}

// Get all looked-up words that are not yet mastered
export function getUnmasteredWords(text: string): WordMastery[] {
  const data = loadWordData(text);
  if (!data) return [];

  return data.words.filter(w => w.correctCount < MASTERY_THRESHOLD);
}

// Get all looked-up words (including mastered)
export function getAllLookedUpWords(text: string): WordMastery[] {
  const data = loadWordData(text);
  if (!data) return [];

  return data.words;
}

// Mark a word as correctly answered
export function markWordCorrect(text: string, word: string): number {
  const data = loadWordData(text);
  if (!data) return 0;

  const wordLower = word.toLowerCase();
  const wordEntry = data.words.find(w => w.word === wordLower);

  if (wordEntry) {
    wordEntry.correctCount++;
    wordEntry.lastCorrect = Date.now();
    data.updatedAt = Date.now();
    saveWordData(data);
    return wordEntry.correctCount;
  }

  return 0;
}

// Reset a word's correct count (when answered wrong)
export function resetWordProgress(text: string, word: string): void {
  const data = loadWordData(text);
  if (!data) return;

  const wordLower = word.toLowerCase();
  const wordEntry = data.words.find(w => w.word === wordLower);

  if (wordEntry) {
    wordEntry.correctCount = 0;
    data.updatedAt = Date.now();
    saveWordData(data);
  }
}

// Check if a word is mastered
export function isWordMastered(text: string, word: string): boolean {
  const data = loadWordData(text);
  if (!data) return false;

  const wordLower = word.toLowerCase();
  const wordEntry = data.words.find(w => w.word === wordLower);

  return wordEntry ? wordEntry.correctCount >= MASTERY_THRESHOLD : false;
}

// Get the mastery threshold
export function getMasteryThreshold(): number {
  return MASTERY_THRESHOLD;
}

// Clear all word data for a text
export function clearWordData(text: string): void {
  const textHash = hashText(text);
  const key = getStorageKey(textHash);
  localStorage.removeItem(key);
}
