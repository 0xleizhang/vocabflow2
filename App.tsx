import React, { useState, useEffect } from 'react';
import { Reader } from './components/Reader';
import { Button } from './components/Button';
import { BookOpen, Edit3, Sparkles, Settings, KeyRound } from 'lucide-react';
import { ViewMode } from './types';
import { ApiKeyModal } from './components/ApiKeyModal';

// Default placeholder text
const DEFAULT_TEXT = `The quick brown fox jumps over the lazy dog. 

Learning a new language is a journey of discovery. Every word you learn unlocks a new way of thinking and perceiving the world around you. Don't be afraid to make mistakes; they are the stepping stones to fluency.`;

export default function App() {
  const [text, setText] = useState<string>(DEFAULT_TEXT);
  const [mode, setMode] = useState<ViewMode>('read');
  const [inputText, setInputText] = useState<string>(DEFAULT_TEXT);
  
  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // Load key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    } else {
        // Optional: Open modal immediately if no key is found
        // setIsKeyModalOpen(true);
    }
  }, []);

  const handleSaveKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const handleSaveText = () => {
    setText(inputText);
    setMode('read');
  };

  const handleCancelEdit = () => {
    setInputText(text);
    setMode('read');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <ApiKeyModal 
        isOpen={isKeyModalOpen} 
        onClose={() => setIsKeyModalOpen(false)} 
        onSave={handleSaveKey}
        existingKey={apiKey}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-brand-600">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">VocabFlow</h1>
          </div>
          
          <div className="flex items-center space-x-3">
             {/* API Key Button */}
             <button 
                onClick={() => setIsKeyModalOpen(true)}
                className={`p-2 rounded-full transition-colors ${!apiKey ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Configure API Key"
             >
                {!apiKey ? <KeyRound size={20} className="animate-pulse" /> : <Settings size={20} />}
             </button>

             <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {mode === 'read' ? (
               <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => {
                    setInputText(text);
                    setMode('edit');
                }}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Text
              </Button>
            ) : (
                <div className="flex space-x-2">
                     <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                        Cancel
                     </Button>
                     <Button variant="primary" size="sm" onClick={handleSaveText}>
                        <BookOpen className="w-4 h-4 mr-2" />
                        Start Reading
                     </Button>
                </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {!apiKey && mode === 'read' && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <KeyRound className="text-amber-500" />
                        <div>
                            <p className="text-sm font-medium text-amber-900">API Key Required</p>
                            <p className="text-xs text-amber-700">You need to configure your Gemini API Key to use the analysis features.</p>
                        </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setIsKeyModalOpen(true)}>
                        Configure
                    </Button>
                </div>
            )}

            {mode === 'edit' ? (
                <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl mx-auto animate-in fade-in duration-300">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Input English Text</h2>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Paste your English text here..."
                        className="w-full h-96 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-serif text-lg leading-relaxed resize-none"
                    />
                    <div className="mt-4 flex justify-between items-center text-slate-500 text-sm">
                        <span>Paste an article, a paragraph, or sentences to practice.</span>
                        <span>{inputText.length} chars</span>
                    </div>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-2 duration-500">
                    <Reader 
                        rawText={text} 
                        apiKey={apiKey} 
                        onMissingKey={() => setIsKeyModalOpen(true)}
                    />
                </div>
            )}
        </div>
      </main>
    </div>
  );
}