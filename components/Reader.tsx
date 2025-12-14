import { Ear, FastForward, Languages, Loader2, Mic, Pause, PenLine, Play, Repeat, Rewind, SkipForward, Square } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { analyzePronunciation, clearTTSCache, fetchTTSAudio, fetchWordAnnotation } from '../services/geminiService';
import { audioRecorder } from '../services/audioRecordingService';
import { addLookedUpWord } from '../services/wordMasteryService';
import { InteractionMode, PronunciationFeedback, WordError, WordToken } from '../types';
import { FeedbackPanel } from './FeedbackPanel';
import { Word } from './Word';
import { WritingMode } from './WritingMode';

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
  
  // Interaction Mode: 'reading' (lookup word), 'listen' (start TTS), or 'test' (pronunciation test)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('reading');

  // Hover state for listen/test mode
  const [hoveredSentenceIndex, setHoveredSentenceIndex] = useState<number | null>(null);

  // Playback settings
  const [autoPlay, setAutoPlay] = useState(true);  // Auto play next sentence
  const [repeatMode, setRepeatMode] = useState(false);  // Repeat mode
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);  // Loading state for TTS

  // Test mode states
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedbackList, setFeedbackList] = useState<PronunciationFeedback[]>([]);
  const [pronunciationErrors, setPronunciationErrors] = useState<Map<number, WordError>>(new Map());

  // Refs for audio control
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isPausedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoPlayRef = useRef(autoPlay);
  const repeatModeRef = useRef(repeatMode);

  // Keep refs in sync with state
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

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
    clearTTSCache(); // Clear audio cache when text changes
  }, [rawText]);

  // --- Playback Logic ---

  const stopPlayback = useCallback(() => {
    synthRef.current.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentSentenceIndex(-1);
    isPausedRef.current = false;
  }, []);

  // Handle what happens after a sentence finishes playing
  const handlePlaybackEnd = useCallback((index: number) => {
    if (isPausedRef.current) return;

    if (repeatModeRef.current && !autoPlayRef.current) {
      // Only repeat current sentence
      playSentenceInternal(index);
    } else if (autoPlayRef.current) {
      if (index + 1 >= sentences.length) {
        if (repeatModeRef.current) {
          // Repeat entire text from beginning
          playSentenceInternal(0);
        } else {
          stopPlayback();
        }
      } else {
        // Play next sentence
        playSentenceInternal(index + 1);
      }
    } else {
      // No auto, no repeat - stop after current
      setIsPlaying(false);
      setCurrentSentenceIndex(-1);
    }
  }, [sentences.length, stopPlayback]);

  // Play using browser TTS (fallback)
  const playSentenceWithBrowserTTS = useCallback((index: number) => {
    const text = sentences[index];
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = playbackRate;

    utterance.onstart = () => {
      setCurrentSentenceIndex(index);
    };

    utterance.onend = () => {
      handlePlaybackEnd(index);
    };

    utterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') {
        return;
      }
      console.error("TTS Error", e);
      handlePlaybackEnd(index);
    };

    utteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, [sentences, playbackRate, handlePlaybackEnd]);

  // Preload next sentence audio
  const preloadNextSentence = useCallback((currentIndex: number) => {
    if (!apiKey || !autoPlayRef.current) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex < sentences.length) {
      // Fire and forget - just populate the cache
      fetchTTSAudio(sentences[nextIndex], apiKey).catch(() => {
        // Ignore preload errors
      });
    }
  }, [apiKey, sentences]);

  // Play using LLM TTS with fallback to browser TTS
  const playSentenceInternal = useCallback(async (index: number) => {
    if (index >= sentences.length) {
      stopPlayback();
      return;
    }

    // Cancel any previous playback
    synthRef.current.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setCurrentSentenceIndex(index);
    setIsLoadingAudio(true);

    const text = sentences[index];

    // Try LLM TTS first if API key is available
    if (apiKey) {
      try {
        const { data: audioData, mimeType } = await fetchTTSAudio(text, apiKey);

        // Check if we were stopped during the fetch
        if (isPausedRef.current) {
          setIsLoadingAudio(false);
          return;
        }

        // Preload next sentence while current one plays
        preloadNextSentence(index);

        // Create blob and play with correct mimeType
        const blob = new Blob([audioData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackRate;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          handlePlaybackEnd(index);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          console.warn("LLM audio playback failed, falling back to browser TTS");
          playSentenceWithBrowserTTS(index);
        };

        audioRef.current = audio;
        setIsLoadingAudio(false);
        await audio.play();
        return;
      } catch (error) {
        console.warn("LLM TTS failed, falling back to browser TTS:", error);
        setIsLoadingAudio(false);
      }
    }

    // Fallback to browser TTS
    setIsLoadingAudio(false);
    playSentenceWithBrowserTTS(index);
  }, [sentences, playbackRate, apiKey, stopPlayback, handlePlaybackEnd, playSentenceWithBrowserTTS, preloadNextSentence]);

  // Public playSentence function
  const playSentence = useCallback((index: number) => {
    playSentenceInternal(index);
  }, [playSentenceInternal]);

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


  // --- Stop Recording Handler ---
  const handleStopRecording = useCallback(() => {
    audioRecorder.stopRecording();
  }, []);

  // --- Test Mode Handler ---
  const handleTestModeClick = useCallback(async (sentenceIndex: number) => {
    if (!apiKey) {
      onMissingKey();
      return;
    }

    if (isRecording || isAnalyzing) return;

    const sentenceText = sentences[sentenceIndex];
    if (!sentenceText) return;

    try {
      // 1. Play beep to indicate recording start
      await audioRecorder.playBeep();

      // 2. Start recording with VAD
      setIsRecording(true);
      setCurrentSentenceIndex(sentenceIndex);

      const { audioBlob } = await audioRecorder.recordWithVAD(
        () => console.log("Recording started"),
        () => setIsRecording(false)
      );

      // 3. Create audio URL for playback
      const audioUrl = URL.createObjectURL(audioBlob);

      // 4. Analyze pronunciation
      setIsAnalyzing(true);

      const feedback = await analyzePronunciation(audioBlob, sentenceText, apiKey);

      // 5. Add feedback to list with audio URL (newest first)
      setFeedbackList(prev => [{ ...feedback, audioUrl }, ...prev]);

      // 6. Mark error words in the text
      if (feedback.errors.length > 0) {
        const newErrors = new Map(pronunciationErrors);

        // Find token indices for error words in this sentence
        tokens.forEach((token, tokenIndex) => {
          if (token.sentenceIndex === sentenceIndex && token.isWord) {
            const errorMatch = feedback.errors.find(
              err => err.word.toLowerCase() === token.text.toLowerCase()
            );
            if (errorMatch) {
              newErrors.set(tokenIndex, errorMatch);
            }
          }
        });

        setPronunciationErrors(newErrors);
      }

      setIsAnalyzing(false);

    } catch (error) {
      console.error("Test mode error:", error);
      setIsRecording(false);
      setIsAnalyzing(false);
    }
  }, [apiKey, onMissingKey, isRecording, isAnalyzing, sentences, tokens, pronunciationErrors]);

  // --- Combined Click Handler ---
  const handleWordClick = useCallback(async (e: React.MouseEvent, tokenIndex: number) => {
    const token = tokens[tokenIndex];
    if (!token) return;

    const isModifierPressed = e.ctrlKey || e.metaKey;

    // CHECK INTENT:
    // 1. If Interaction Mode is 'test'
    if (interactionMode === 'test') {
      // Ctrl+Click in test mode -> Play sentence (listen)
      if (isModifierPressed) {
        if (token.sentenceIndex >= 0 && token.sentenceIndex < sentences.length) {
          setIsPlaying(true);
          isPausedRef.current = false;
          playSentence(token.sentenceIndex);
        }
        return;
      }
      // Normal click -> Start pronunciation test
      if (token.sentenceIndex >= 0 && token.sentenceIndex < sentences.length) {
        handleTestModeClick(token.sentenceIndex);
      }
      return;
    }

    // 2. If Interaction Mode is 'listen' OR user is holding Ctrl/Command key (in reading mode)
    // THEN -> Play Sentence
    const shouldPlay = interactionMode === 'listen' || isModifierPressed;

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

      // Save to word mastery for writing mode
      addLookedUpWord(rawText, token.text, annotation);

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
  }, [tokens, apiKey, onMissingKey, interactionMode, sentences, playSentence, handleTestModeClick]);

  if (!rawText.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>No text to display.</p>
      </div>
    );
  }

  // Detect Mac for keyboard shortcut hint
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modifierKey = isMac ? '⌘' : 'Ctrl';

  // Clear feedback when switching away from test mode
  const handleClearFeedback = useCallback(() => {
    setFeedbackList([]);
    setPronunciationErrors(new Map());
  }, []);

  // Writing mode has its own component
  if (interactionMode === 'writing') {
    return (
      <div className="w-full mx-auto pb-32 relative max-w-4xl">
        <WritingMode rawText={rawText} tokens={tokens} />

        {/* Floating Control Bar for Writing Mode */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-4">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-2 md:p-3 flex items-center justify-center ring-1 ring-black/5 gap-4">
            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button
                 onClick={() => setInteractionMode('listen')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'listen' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Listen Mode"
               >
                 <Ear size={16} />
                 <span className="hidden sm:inline">Listen</span>
               </button>
               <button
                 onClick={() => setInteractionMode('reading')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'reading' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Reading Mode"
               >
                 <Languages size={16} />
                 <span className="hidden sm:inline">Reading</span>
               </button>
               <button
                 onClick={() => setInteractionMode('test')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'test' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Test Mode - Practice Pronunciation"
               >
                 <Mic size={16} />
                 <span className="hidden sm:inline">Test</span>
               </button>
               <button
                 onClick={() => setInteractionMode('writing')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'writing' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Writing Mode - Fill in the blanks"
               >
                 <PenLine size={16} />
                 <span className="hidden sm:inline">Writing</span>
               </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full mx-auto pb-32 relative ${interactionMode === 'test' ? 'max-w-6xl' : 'max-w-4xl'}`}>
      <div className={`flex gap-4 ${interactionMode === 'test' ? 'flex-col lg:flex-row' : ''}`}>
        {/* Main Text Area */}
        <div className={`p-4 md:p-8 bg-white shadow-sm rounded-xl min-h-[50vh] relative ${interactionMode === 'test' ? 'flex-1' : 'w-full'}`}>
          <div className="prose prose-lg prose-slate max-w-none font-serif leading-loose text-slate-800">
            <p className="whitespace-pre-wrap">
            {tokens.map((token, index) => {
              const isSentenceActive = token.sentenceIndex === currentSentenceIndex;
              const isSentenceHovered = (interactionMode === 'listen' || interactionMode === 'test') && token.sentenceIndex === hoveredSentenceIndex;
              const shouldHighlight = isSentenceActive || isSentenceHovered;
              const tokenError = pronunciationErrors.get(index) || null;

              if (!token.isWord) {
                // Also highlight punctuation if sentence is active or hovered
                return (
                    <span
                        key={token.id}
                        className={`transition-colors duration-300 ${shouldHighlight ? 'bg-brand-100/80' : 'text-slate-500'} ${(interactionMode === 'listen' || interactionMode === 'test') ? 'cursor-pointer' : 'cursor-text'}`}
                        onClick={(e) => handleWordClick(e, index)}
                        onMouseEnter={() => (interactionMode === 'listen' || interactionMode === 'test') && setHoveredSentenceIndex(token.sentenceIndex)}
                        onMouseLeave={() => (interactionMode === 'listen' || interactionMode === 'test') && setHoveredSentenceIndex(null)}
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
                  isHighlighted={shouldHighlight}
                  interactionMode={interactionMode}
                  onHoverSentence={setHoveredSentenceIndex}
                  pronunciationError={tokenError}
                />
              );
            })}
          </p>
        </div>
        
        <div className="mt-8 pt-4 border-t border-slate-100 text-center text-sm text-slate-400 font-sans">
          {isRecording && (
            <span className="inline-flex items-center gap-3 text-red-500">
              <span className="inline-flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                录音中... 请朗读句子
              </span>
              <button
                onClick={handleStopRecording}
                className="px-3 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
              >
                结束录音
              </button>
            </span>
          )}
          {isAnalyzing && (
            <span className="inline-flex items-center gap-3 text-brand-500">
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                分析发音中...
              </span>
              <button
                onClick={() => setIsAnalyzing(false)}
                className="px-3 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
              >
                取消
              </button>
            </span>
          )}
          {!isRecording && !isAnalyzing && (
            <>
              Click to {interactionMode === 'reading' ? 'lookup words' : interactionMode === 'listen' ? 'listen' : 'test pronunciation'} •
              <span className="hidden md:inline ml-1">Hold {modifierKey}+Click to {interactionMode === 'listen' ? 'lookup words' : 'listen'}</span>
            </>
          )}
        </div>
      </div>

        {/* Feedback Panel (Right Side) - Only visible in test mode */}
        {interactionMode === 'test' && (
          <div className="w-full lg:w-80 bg-white shadow-sm rounded-xl overflow-hidden flex-shrink-0">
            <FeedbackPanel
              feedbackList={feedbackList}
              onClear={handleClearFeedback}
            />
          </div>
        )}
      </div>

      {/* Floating Audio Player Control Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-2xl px-4">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-2 md:p-3 flex items-center justify-between ring-1 ring-black/5 gap-4">
            
            {/* 1. Mode Switcher (Left Side) */}
            <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
               <button
                 onClick={() => setInteractionMode('listen')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'listen' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Listen Mode"
               >
                 <Ear size={16} />
                 <span className="hidden sm:inline">Listen</span>
               </button>
               <button
                 onClick={() => setInteractionMode('reading')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'reading' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Reading Mode"
               >
                 <Languages size={16} />
                 <span className="hidden sm:inline">Reading</span>
               </button>
               <button
                 onClick={() => setInteractionMode('test')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'test' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Test Mode - Practice Pronunciation"
               >
                 <Mic size={16} />
                 <span className="hidden sm:inline">Test</span>
               </button>
               <button
                 onClick={() => setInteractionMode('writing')}
                 className={`p-2 rounded-md flex items-center gap-2 text-xs font-semibold transition-all ${interactionMode === 'writing' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 title="Writing Mode - Fill in the blanks"
               >
                 <PenLine size={16} />
                 <span className="hidden sm:inline">Writing</span>
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

                {/* Auto & Repeat Controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setAutoPlay(!autoPlay)}
                        className={`p-1.5 rounded-lg transition-colors ${autoPlay ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                        title={autoPlay ? "Auto: ON - Will play next sentence" : "Auto: OFF - Will stop after current sentence"}
                    >
                        <SkipForward size={16} />
                    </button>
                    <button
                        onClick={() => setRepeatMode(!repeatMode)}
                        className={`p-1.5 rounded-lg transition-colors ${repeatMode ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                        title={repeatMode ? "Repeat: ON - Will loop" : "Repeat: OFF - Will stop at end"}
                    >
                        <Repeat size={16} />
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
                        disabled={isLoadingAudio}
                        className={`p-3 text-white rounded-full shadow-lg transition-all transform flex items-center justify-center ${isLoadingAudio ? 'bg-brand-400 cursor-wait' : 'bg-brand-600 hover:bg-brand-700 hover:shadow-brand-500/30 hover:scale-105 active:scale-95'}`}
                        title={isLoadingAudio ? "Loading audio..." : isPlaying ? "Pause" : "Play Full Text"}
                     >
                        {isLoadingAudio ? <Loader2 size={20} className="animate-spin" /> : isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                     </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};