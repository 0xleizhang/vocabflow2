import { ExternalLink, Eye, EyeOff, Key, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { LLMProvider } from '../types';
import { Button } from './Button';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, provider: LLMProvider) => void;
  existingKey?: string;
  existingProvider?: LLMProvider;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  existingKey = '',
  existingProvider = 'gemini'
}) => {
  const [key, setKey] = useState(existingKey);
  const [provider, setProvider] = useState<LLMProvider>(existingProvider);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setKey(existingKey);
    setProvider(existingProvider);
  }, [existingKey, existingProvider, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSave(key.trim(), provider);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800">
            <Key className="w-5 h-5 text-brand-600" />
            <h2 className="font-semibold text-lg">Configure API Key</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              AI Provider
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  provider === 'gemini'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Google Gemini
              </button>
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  provider === 'openai'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                OpenAI
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700">
              {provider === 'gemini' ? 'Google Gemini API Key' : 'OpenAI API Key'}
            </label>
            <div className="relative">
              <input
                id="apiKey"
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={provider === 'gemini' ? 'AIzaSy...' : 'sk-proj-...'}
                className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none font-mono text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Your key is stored locally in your browser and sent directly to {provider === 'gemini' ? 'Google' : 'OpenAI'} servers.
            </p>
          </div>

          {/* Provider-specific help */}
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-start gap-2">
            <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Don't have a key? Get one for free at{' '}
              {provider === 'gemini' ? (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-blue-900 font-medium"
                >
                  Google AI Studio
                </a>
              ) : (
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-blue-900 font-medium"
                >
                  OpenAI Platform
                </a>
              )}
            </p>
          </div>

          <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg">
            <p className="font-medium mb-1">🚀 不想自己配置 API Key？</p>
            <p className="text-amber-700">
              我们正在开发免配置版本，直接使用无需任何设置。想要第一时间体验？请{' '}
              <a
                href="https://wj.qq.com/s2/25220840/c68c/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-amber-900 font-medium"
              >
                填写表单
              </a>
              {' '}告诉我们您的想法，我们会优先为您开放使用权限！
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!key.trim()}>
              Save Key
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};