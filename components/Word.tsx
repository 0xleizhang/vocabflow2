import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { playPronunciation } from '../services/ttsService';
import { InteractionMode, WordError, WordToken } from '../types';

interface WordProps {
  token: WordToken;
  onClick: (e: React.MouseEvent) => void;
  isHighlighted?: boolean;
  interactionMode: InteractionMode;
  onHoverSentence?: (sentenceIndex: number | null) => void;
  pronunciationError?: WordError | null;
}

export const Word: React.FC<WordProps> = ({ token, onClick, isHighlighted = false, interactionMode, onHoverSentence, pronunciationError }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Handle sentence hover in listen/pronounce mode
  const handleMouseEnter = () => {
    setIsHovered(true);
    if ((interactionMode === 'listen' || interactionMode === 'pronounce') && onHoverSentence) {
      onHoverSentence(token.sentenceIndex);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if ((interactionMode === 'listen' || interactionMode === 'pronounce') && onHoverSentence) {
      onHoverSentence(null);
    }
  };

  // Helper booleans
  const isAnnotated = token.status === 'success' && !!token.annotation;
  const isLoading = token.status === 'loading';
  const isError = token.status === 'error';

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await playPronunciation(token.text);
    } catch (error) {
      console.error("Failed to play audio", error);
    }
  };

  // Helper for pronunciation error
  const hasPronunciationError = !!pronunciationError;

  // Determine cursor style based on mode and status
  let cursorClass = '';
  if (interactionMode === 'listen' || interactionMode === 'pronounce') {
    cursorClass = 'cursor-pointer'; // Finger pointer for "Listen" or "Test"
  } else if (interactionMode === 'read') {
    if (isAnnotated) {
      cursorClass = 'cursor-pointer'; // Pointer for playing pronunciation in read mode
    } else if (isLoading) {
      cursorClass = 'cursor-wait';
    } else if (!isError) {
      cursorClass = 'cursor-text hover:cursor-zoom-in'; // Text or Zoom for "Look up"
    }
  } else if (isLoading) {
    cursorClass = 'cursor-wait';
  }

  return (
    <span className={`relative inline-block align-baseline transition-colors duration-300 rounded-sm ${isHighlighted ? 'bg-brand-100/80 pt-0.5 -mt-0.5' : ''}`}>
      {/* The Interactive Word Text */}
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          e.stopPropagation();
          // Allow clicking in listen/test mode, or for word lookup in reading mode
          if (interactionMode === 'listen' || interactionMode === 'pronounce') {
            onClick(e);
          } else if (interactionMode === 'read') {
            // In read mode: if already annotated, play pronunciation; otherwise look up
            if (isAnnotated) {
              handlePlay(e);
            } else if (!isLoading) {
              onClick(e);
            }
          }
        }}
        className={`
          transition-colors duration-200 rounded px-0.5 -mx-0.5 select-text
          ${cursorClass}
          ${isLoading ? 'opacity-50' : ''}
          ${isError ? 'text-red-500 decoration-red-300 underline decoration-wavy' : ''}
          ${hasPronunciationError ? 'text-orange-600 underline decoration-orange-400 decoration-wavy decoration-2 underline-offset-2' : ''}
          ${isAnnotated && !hasPronunciationError ? 'text-brand-800 font-semibold border-b-2 border-brand-200' : ''}
          ${!isAnnotated && !isLoading && !isError && !hasPronunciationError ? 'hover:text-brand-800 hover:bg-black/5' : ''}
          ${(interactionMode === 'listen' || interactionMode === 'pronounce') && !isLoading ? 'hover:underline decoration-brand-300 decoration-2 underline-offset-2' : ''}
        `}
        title={hasPronunciationError ? pronunciationError?.issue : undefined}
      >
        {token.text}
      </span>

      {/* Loading Spinner */}
      {isLoading && (
        <span className="absolute -top-1 -right-1 pointer-events-none">
           <Loader2 className="w-3 h-3 text-brand-500 animate-spin" />
        </span>
      )}

      {/* Inline Pronunciation & IPA (Visible constantly after load) */}
      {isAnnotated && token.annotation && (
        <span className="inline-flex items-center ml-1 align-middle bg-white border border-slate-200 rounded-md px-1.5 py-0.5 select-none h-fit my-0.5 shadow-sm">
           <span className="text-[11px] leading-none text-slate-600 font-mono">
             {token.annotation.ipa}
           </span>
        </span>
      )}

      {/* Hover Tooltip - Definition Only */}
      {isAnnotated && token.annotation && interactionMode === 'read' && (
        <div 
          className={`
            absolute bottom-full left-0 mb-1 z-50 whitespace-nowrap
            transform transition-all duration-200 origin-bottom-left
            ${isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}
          `}
        >
          <div className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg shadow-xl ring-1 ring-white/10">
            {token.annotation.definition}
             {/* Tooltip Arrow */}
            <div className="absolute top-full left-4 -translate-x-1/2 -mt-[4px] text-slate-800">
                <div className="w-2 h-2 bg-slate-800 transform rotate-45"></div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
};

export default Word;