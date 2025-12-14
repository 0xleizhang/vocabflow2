import { AlertCircle, Play, Square, Trash2, TrendingUp } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { PronunciationFeedback } from '../types';

interface FeedbackPanelProps {
  feedbackList: PronunciationFeedback[];
  onClear: () => void;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600 bg-green-50';
  if (score >= 60) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

const getScoreBorderColor = (score: number): string => {
  if (score >= 80) return 'border-green-200';
  if (score >= 60) return 'border-yellow-200';
  return 'border-red-200';
};

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ feedbackList, onClear }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSpeakWord = (word: string) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn("Text-to-speech not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;

    utterance.onerror = (e) => {
      console.error("TTS Error:", e);
    };

    synth.speak(utterance);
  };

  const handlePlayRecording = (feedback: PronunciationFeedback) => {
    if (!feedback.audioUrl) return;

    // If already playing this one, stop it
    if (playingId === feedback.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingId(null);
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Play the new audio
    const audio = new Audio(feedback.audioUrl);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
    };

    audioRef.current = audio;
    setPlayingId(feedback.id);
    audio.play();
  };

  if (feedbackList.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
        <TrendingUp size={48} className="mb-4 opacity-50" />
        <p className="text-center text-sm">
          点击左侧句子开始测试发音
        </p>
        <p className="text-center text-xs mt-2 opacity-75">
          录音将自动结束
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-700 text-sm">发音反馈</h3>
        <button
          onClick={onClear}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="清除所有反馈"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Feedback List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {feedbackList.map((feedback, index) => (
          <div
            key={feedback.id}
            className={`bg-white rounded-lg border ${getScoreBorderColor(feedback.score)} shadow-sm overflow-hidden`}
          >
            {/* Score Header */}
            <div className={`px-3 py-2 flex items-center justify-between ${getScoreColor(feedback.score)}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{feedback.score}</span>
                {feedback.audioUrl && (
                  <button
                    onClick={() => handlePlayRecording(feedback)}
                    className={`p-1.5 rounded-full transition-colors ${
                      playingId === feedback.id
                        ? 'bg-white/50 text-current'
                        : 'hover:bg-white/30 text-current/70 hover:text-current'
                    }`}
                    title={playingId === feedback.id ? "停止播放" : "播放录音"}
                  >
                    {playingId === feedback.id ? (
                      <Square size={14} fill="currentColor" />
                    ) : (
                      <Play size={14} fill="currentColor" />
                    )}
                  </button>
                )}
              </div>
              <span className="text-xs opacity-75">#{feedbackList.length - index}</span>
            </div>

            {/* Content */}
            <div className="p-3 space-y-2">
              {/* Original sentence */}
              <p className="text-xs text-slate-500 line-clamp-2 italic">
                "{feedback.sentence}"
              </p>

              {/* Feedback */}
              <p className="text-sm text-slate-700">
                {feedback.feedback}
              </p>

              {/* Errors */}
              {feedback.errors.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-xs text-red-500 mb-1.5">
                    <AlertCircle size={12} />
                    <span>需要注意</span>
                  </div>
                  <div className="space-y-1">
                    {feedback.errors.map((error, errIndex) => (
                      <div key={errIndex} className="flex items-start gap-2 text-xs">
                        <button
                          onClick={() => handleSpeakWord(error.word)}
                          className="font-mono font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors cursor-pointer"
                          title="点击发音"
                        >
                          {error.word}
                        </button>
                        <span className="text-slate-600 flex-1">
                          {error.issue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackPanel;
