import React, { useState } from 'react';
import { Annotation } from '../types';
import { X, Volume2, Loader2 } from 'lucide-react';
import { playPronunciation } from '../services/ttsService';

interface AnnotationBadgeProps {
  word: string;
  annotation: Annotation;
  onClose?: (e: React.MouseEvent) => void;
}

export const AnnotationBadge: React.FC<AnnotationBadgeProps> = ({ word, annotation, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || isPlaying) return;

    try {
      setLoading(true);
      await playPronunciation(word);
      setIsPlaying(true);
      // Reset playing state after a short delay since onend fires immediately
      setTimeout(() => setIsPlaying(false), 500);
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span 
      contentEditable={false} 
      className="inline-flex items-center gap-1.5 px-2 py-1 select-none"
      onClick={(e) => e.stopPropagation()} 
    >
      <button
        onClick={handlePlay}
        disabled={loading}
        className={`p-1 rounded-full transition-colors flex-shrink-0 ${
          loading ? 'cursor-wait text-brand-400' : 'text-brand-500 hover:text-brand-700 hover:bg-brand-50'
        }`}
        title="Listen to pronunciation"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Volume2 size={14} className={isPlaying ? "text-brand-700 fill-brand-700" : ""} />
        )}
      </button>

      <div className="flex flex-col items-start leading-tight">
        <span className="text-slate-500 font-mono text-xs">
          {annotation.ipa}
        </span>
        <span className="text-brand-700 font-bold text-sm">
          {annotation.definition}
        </span>
      </div>

      {onClose && (
        <button 
          onClick={onClose}
          className="ml-1 text-slate-300 hover:text-slate-500 rounded-full p-0.5 hover:bg-slate-100 transition-colors"
          aria-label="Remove annotation"
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
};