import { Check, RotateCcw, Trophy } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getMasteryThreshold,
  getUnmasteredWords,
  markWordCorrect,
  resetWordProgress
} from '../services/wordMasteryService';
import { WordMastery, WordToken } from '../types';

interface WritingModeProps {
  rawText: string;
  tokens: WordToken[];
}

interface BlankState {
  tokenIndex: number;
  word: string;
  userInput: string;
  status: 'blank' | 'correct' | 'incorrect';
  annotation: WordMastery['annotation'];
  correctCount: number;
}

export const WritingMode: React.FC<WritingModeProps> = ({ rawText, tokens }) => {
  const [blanks, setBlanks] = useState<BlankState[]>([]);
  const [allCorrect, setAllCorrect] = useState(false);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const { t } = useLanguage();

  // Initialize blanks from unmastered words
  useEffect(() => {
    const unmasteredWords = getUnmasteredWords(rawText);

    if (unmasteredWords.length === 0) {
      setBlanks([]);
      return;
    }

    // Find token indices for unmastered words
    const newBlanks: BlankState[] = [];
    const usedWords = new Set<string>();

    tokens.forEach((token, index) => {
      if (!token.isWord) return;

      const wordLower = token.text.toLowerCase();
      const mastery = unmasteredWords.find(w => w.word === wordLower);

      // Only create one blank per unique word
      if (mastery && !usedWords.has(wordLower)) {
        usedWords.add(wordLower);
        newBlanks.push({
          tokenIndex: index,
          word: token.text,
          userInput: '',
          status: 'blank',
          annotation: mastery.annotation,
          correctCount: mastery.correctCount
        });
      }
    });

    setBlanks(newBlanks);
    setAllCorrect(false);
  }, [rawText, tokens]);

  // Handle input change with immediate checking
  const handleInputChange = useCallback((tokenIndex: number, value: string) => {
    setBlanks(prev => {
      const newBlanks = prev.map(blank => {
        if (blank.tokenIndex !== tokenIndex) return blank;

        // Already correct - don't change
        if (blank.status === 'correct') return blank;

        const inputLower = value.toLowerCase().trim();
        const wordLower = blank.word.toLowerCase();

        // Check if correct
        if (inputLower === wordLower) {
          const newCount = markWordCorrect(rawText, blank.word);
          return { ...blank, userInput: value, status: 'correct' as const, correctCount: newCount };
        }

        // Check if incorrect (only when input length >= word length or has wrong characters)
        const isIncorrect = inputLower.length > 0 && !wordLower.startsWith(inputLower);

        if (isIncorrect) {
          resetWordProgress(rawText, blank.word);
          return { ...blank, userInput: value, status: 'incorrect' as const, correctCount: 0 };
        }

        // Still typing - show as blank (neutral)
        return { ...blank, userInput: value, status: 'blank' as const };
      });

      // Check if all are correct
      const allDone = newBlanks.every(b => b.status === 'correct');
      setAllCorrect(allDone);

      return newBlanks;
    });
  }, [rawText]);

  // Reset all blanks - re-fetch from localStorage to exclude mastered words
  const handleReset = useCallback(() => {
    const unmasteredWords = getUnmasteredWords(rawText);
    const masteryThreshold = getMasteryThreshold();

    setBlanks(prev => {
      // Filter out words that have been mastered, and reset the rest
      return prev
        .filter(blank => {
          // Check if this word is still unmastered in localStorage
          const mastery = unmasteredWords.find(w => w.word === blank.word.toLowerCase());
          return mastery && mastery.correctCount < masteryThreshold;
        })
        .map(blank => {
          // Get fresh correctCount from localStorage
          const mastery = unmasteredWords.find(w => w.word === blank.word.toLowerCase());
          return {
            ...blank,
            userInput: '',
            status: 'blank' as const,
            correctCount: mastery?.correctCount ?? blank.correctCount
          };
        });
    });
    setAllCorrect(false);
  }, [rawText]);

  // Check if a token should be shown as a blank
  const isBlankToken = useCallback((tokenIndex: number): BlankState | undefined => {
    return blanks.find(b => b.tokenIndex === tokenIndex);
  }, [blanks]);

  // Get the status color class
  const getStatusClass = (status: BlankState['status']): string => {
    switch (status) {
      case 'correct':
        return 'border-green-500 bg-green-50 text-green-700';
      case 'incorrect':
        return 'border-red-500 bg-red-50 text-red-700';
      default:
        return 'border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
    }
  };

  const masteryThreshold = getMasteryThreshold();

  if (blanks.length === 0) {
    return (
      <div className="p-4 md:p-8 bg-white shadow-sm rounded-xl min-h-[50vh] flex flex-col items-center justify-center">
        <Trophy size={64} className="text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">{t.writingMode.noWordsTitle}</h2>
        <p className="text-slate-500 text-center max-w-md whitespace-pre-line">
          {t.writingMode.noWordsMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-white shadow-sm rounded-xl min-h-[50vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-700">{t.writingMode.title}</h2>
          <p className="text-sm text-slate-500">
            {t.writingMode.description.replace('{count}', String(masteryThreshold))}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RotateCcw size={16} />
          {t.writingMode.reset}
        </button>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
          <span>{blanks.filter(b => b.status === 'correct').length} / {blanks.length} {t.writingMode.correct}</span>
          {allCorrect && (
            <span className="flex items-center gap-1 text-green-600">
              <Check size={16} />
              {t.writingMode.allCorrect}
            </span>
          )}
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${(blanks.filter(b => b.status === 'correct').length / blanks.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Text with blanks */}
      <div className="prose prose-lg prose-slate max-w-none font-serif leading-loose text-slate-800">
        <p className="whitespace-pre-wrap">
          {tokens.map((token, index) => {
            const blank = isBlankToken(index);

            if (blank) {
              const inputWidth = Math.max(blank.word.length * 12, 60);

              return (
                <span key={token.id} className="inline-flex items-center align-baseline mx-1">
                  <span className="relative group">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(index, el);
                      }}
                      type="text"
                      value={blank.userInput}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      disabled={blank.status === 'correct'}
                      className={`
                        px-2 py-1 text-center font-serif text-lg rounded-md border-2 outline-none transition-all
                        ${getStatusClass(blank.status)}
                      `}
                      style={{ width: inputWidth }}
                    />
                    {/* Hint tooltip */}
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {blank.annotation.definition} ({blank.annotation.ipa})
                    </span>
                    {/* Correct count badge */}
                    {blank.status === 'correct' && blank.correctCount < masteryThreshold && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-green-500 text-white text-xs font-bold rounded-full">
                        {blank.correctCount}
                      </span>
                    )}
                    {blank.correctCount >= masteryThreshold && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center bg-yellow-500 text-white rounded-full">
                        <Trophy size={12} />
                      </span>
                    )}
                  </span>
                </span>
              );
            }

            // Regular token (not a blank)
            return (
              <span
                key={token.id}
                className={token.isWord ? '' : 'text-slate-500'}
              >
                {token.text}
              </span>
            );
          })}
        </p>
      </div>

      {/* Word list summary */}
      <div className="mt-8 pt-4 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Words to practice:</h3>
        <div className="flex flex-wrap gap-2">
          {blanks.map(blank => (
            <span
              key={blank.tokenIndex}
              className={`
                px-3 py-1 rounded-full text-sm font-medium transition-colors
                ${blank.status === 'correct'
                  ? 'bg-green-100 text-green-700'
                  : blank.status === 'incorrect'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-slate-100 text-slate-600'
                }
              `}
            >
              {blank.status === 'correct' ? blank.word : '???'}
              <span className="ml-1 text-xs opacity-75">
                ({blank.correctCount}/{masteryThreshold})
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WritingMode;
