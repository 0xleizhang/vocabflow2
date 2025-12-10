import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordToken } from '../types';
import { fetchWordAnnotation } from '../services/geminiService';
import { Word } from './Word';
import { Play, Pause, Square, FastForward, Rewind, MousePointer2, Languages, Ear } from 'lucide-react';
import { Button } from './Button';

interface ReaderProps {
  rawText: string;
  apiKey: string;
  onMissingKey: () => void;
}

export const Reader: React.FC<ReaderProps> = ({ rawText, apiKey, onMissingKey }) => {
  const [tokens, setTokens] = useState<WordToken[]>([]);
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [sentences, setSentences] = useState<string[]>([]);
  
  // Interaction Mode: 'translate' (lookup word) or 'play' (start TTS)
  const [interactionMode, setInteractionMode] = useState<'translate' | 'play'>('translate');

  // Refs for audio control
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPausedRef = useRef(false);

  // Parse text into tokens and sentences on mount or when rawText changes
  useEffect(() => {
    // 1. Split into tokens
    const splitRegex = /([a-zA-Z0-9'’-]+)/g;
    const parts = rawText.split(splitRegex);
    
    let tempSentenceIndex = 0;
    const tempSentences: string[] = [""];

    const newTokens: WordToken[] = parts.map((part, index) => {
      const isWord = /^[a-zA-Z0-9]/.test(part);
      
      // Assign current sentence index
      const token: WordToken = {
        id: `token-${index}`,
        text: part,
        isWord: isWord,
        status: 'idle',
        sentenceIndex: tempSentenceIndex
      };

      // Build the sentence string for the player
      tempSentences[tempSentenceIndex] += part;

      // Simple heuristic: if token contains . ? or !, move to next sentence
      // We check !isWord because punctuation usually falls into the non-word parts
      if (!isWord && /[.?!]+(\s|$)/.test(part)) {
        tempSentenceIndex++;
        tempSentences[tempSentenceIndex] = "";
      }

      return token;
    });

    // Cleanup empty last sentence if exists
    const finalSentences = tempSentences.filter(s => s.trim().length > 0);

    setTokens(newTokens);
    setSentences(finalSentences);
    stopPlayback(); // Reset playback if text changes
  }, [rawText]);

  // --- Playback Logic ---

  const stopPlayback = useCallback(() => {
    synthRef.current.cancel();
    setIsPlaying(false);
    setCurrentSentenceIndex(-1);
    isPausedRef.current = false;
  }, []);

  const playSentence = useCallback((index: number) => {
    if (index >= sentences.length) {
      stopPlayback();
      return;
    }

    // Cancel previous
    synthRef.current.cancel();

    const text = sentences[index];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = playbackRate;
    
    utterance.onstart = () => {
      setCurrentSentenceIndex(index);
    };

    utterance.onend = () => {
       // Automatically play next
       // Check if we are still 'playing' state (user didn't click stop)
       if (!isPausedRef.current) {
          playSentence(index + 1);
       }
    };

    utterance.onerror = (e) => {
      // Ignore errors caused by canceling (e.g. when clicking another sentence or stop)
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }

      console.error("TTS Error", e);
      // Skip to next on error
      playSentence(index + 1);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [sentences, playbackRate, stopPlayback]);

  const togglePlay = () => {
    if (isPlaying) {
      // Pause
      synthRef.current.pause();
      isPausedRef.current = true;
      setIsPlaying(false); // UI state
    } else {
      // Play
      if (isPausedRef.current) {
        // Resume
        synthRef.current.resume();
        isPausedRef.current = false;
        setIsPlaying(true);
      } else {
        // Start from beginning or current index
        const startIndex = currentSentenceIndex === -1 ? 0 : currentSentenceIndex;
        setIsPlaying(true);
        playSentence(startIndex);
      }
    }
  };

  // Adjust rate and restart current sentence if playing to apply effect immediately
  const handleRateChange = (newRate: number) => {
    setPlaybackRate(newRate);
    if (isPlaying && currentSentenceIndex !== -1) {
       playSentence(currentSentenceIndex);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      synthRef.current.cancel();
    };
  }, []);


  // --- Combined Click Handler ---
  const handleWordClick = useCallback(async (e: React.MouseEvent, tokenIndex: number) => {
    const token = tokens[tokenIndex];
    if (!token) return;

    // CHECK INTENT:
    // 1. If Interaction Mode is 'play' OR
    // 2. If user is holding Ctrl/Command key (Shortcut)
    // THEN -> Play Sentence
    const isModifierPressed = e.ctrlKey || e.metaKey;
    const shouldPlay = interactionMode === 'play' || isModifierPressed;

    if (shouldPlay) {
      if (token.sentenceIndex >= 0 && token.sentenceIndex < sentences.length) {
          setIsPlaying(true);
          isPausedRef.current = false;
          playSentence(token.sentenceIndex);
      }
      return;
    }

    // OTHERWISE -> Translate (Original Logic)
    if (!token.isWord) return;

    if (!apiKey) {
      onMissingKey();
      return;
    }

    if (token.status === 'success' || token.status === 'loading') return;

    setTokens(prev => prev.map((t, i) => 
      i === tokenIndex ? { ...t, status: 'loading' } : t
    ));

    try {
      const start = Math.max(0, tokenIndex - 15);
      const end = Math.min(tokens.length, tokenIndex + 15);
      const contextString = tokens.slice(start, end).map(t => t.text).join('');

      const annotation = await fetchWordAnnotation(token.text, contextString, apiKey);

      setTokens(prev => prev.map((t, i) => 
        i === tokenIndex 
          ? { ...t, status: 'success', annotation } 
          : t
      ));
    } catch (error) {
      setTokens(prev => prev.map((t, i) => 
        i === tokenIndex ? { ...t, status: 'error' } : t
      ));
      setTimeout(() => {
        setTokens(prev => prev.map((t, i) => 
            i === tokenIndex && t.status === 'error' ? { ...t, status: 'idle' } : t
          ));
      }, 3000);
    }
  }, [tokens, apiKey, onMissingKey, interactionMode, sentences, playSentence]);

  if (!rawText.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>No text to display.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-32 relative">
      <div className="p-4 md:p-8 bg-white shadow-sm rounded-xl min-h-[50vh] relative">
        <div className="prose prose-lg prose-slate max-w-none font-serif leading-loose text-slate-800">
          <p className="whitespace-pre-wrap">
            {tokens.map((token, index) => {
              const isSentenceActive = token.sentenceIndex === currentSentenceIndex;
              
              if (!token.isWord) {
                // Also highlight punctuation if sentence is active
                return (
                    <span 
                        key={token.id} 
                        className={`transition-colors duration-300 ${isSentenceActive ? 'bg-brand-100/80' : 'text-slate-500'} cursor-text`}
                        onClick={(e) => handleWordClick(e, index)}
                    >
                        {token.text}
                    </span>
                );
              }

              return (
                <Word 
                  key={token.id}
                  token={token}
                  onClick={(e) => handleWordClick(e, index)}
                  isHighlighted={isSentenceActive}
                  interactionMode={interactionMode}
                />
              );
            })}
          </p>
        </div>
        
        <div className="mt-8 pt-4 border-t border-slate-100 text-center text-sm text-slate-400 font-sans">
          Click to {interactionMode === 'translate' ? 'translate' : 'read'} • 
          <span className="hidden md:inline ml-1">Hold Ctrl+Click to {interactionMode === 'translate' ? 'read' : 'translate'}</span>
        </div>
      </div>

      {/* Floating Audio Player Control Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-4">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-2 md:p-3 flex items-center justify-between ring-1 ring-black/5 gap-4">
            
            {/* 1. Mode Switcher (Left Side) */}
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
               <button 
                 onClick={() => setInteractionMode('translate')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'translate' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Translate Mode"
               >
                 <Languages size={16} />
                 <span className="hidden sm:inline">Translate</span>
               </button>
               <button 
                 onClick={() => setInteractionMode('play')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'play' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Read Mode"
               >
                 <Ear size={16} />
                 <span className="hidden sm:inline">Read</span>
               </button>
            </div>

            {/* Separator */}
            <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

            {/* 2. Playback Controls (Center/Right) */}
            <div className="flex flex-1 items-center justify-between gap-2 md:gap-4">
                {/* Speed */}
                <div className="flex items-center space-x-0.5">
                    <button 
                        onClick={() => handleRateChange(Math.max(0.7, playbackRate - 0.1))}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <Rewind size={16} />
                    </button>
                    <span className="text-xs font-mono font-medium text-slate-600 w-8 text-center select-none">
                        {playbackRate.toFixed(1)}x
                    </span>
                    <button 
                        onClick={() => handleRateChange(Math.min(2.0, playbackRate + 0.1))}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <FastForward size={16} />
                    </button>
                </div>

                {/* Play/Stop */}
                <div className="flex items-center gap-2">
                     <button 
                        onClick={stopPlayback}
                        className="p-2 md:p-2.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Stop"
                     >
                        <Square size={16} fill="currentColor" />
                     </button>

                     <button 
                        onClick={togglePlay}
                        className="p-3 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg hover:shadow-brand-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center"
                        title={isPlaying ? "Pause" : "Play Full Text"}
                     >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                     </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};