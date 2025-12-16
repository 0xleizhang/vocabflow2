import { Analytics } from '@vercel/analytics/react';
import { BookOpen, Check, Compass, Edit3, Info, KeyRound, Link, MessageCircle, Settings } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Button } from './components/Button';
import { Reader } from './components/Reader';
import { LLMProvider, ViewMode } from './types';

// Compress text using base64 encoding (works for most text)
const encodeTextForUrl = (text: string): string => {
  try {
    // Use encodeURIComponent to handle unicode, then base64 encode
    const encoded = btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g,
      (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    return encoded;
  } catch {
    return '';
  }
};

const decodeTextFromUrl = (encoded: string): string | null => {
  try {
    // Decode base64, then decodeURIComponent to restore unicode
    const decoded = decodeURIComponent(
      atob(encoded).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    return decoded;
  } catch {
    return null;
  }
};

// Default placeholder text
const DEFAULT_TEXT = `Welcome to Philingo - Your AI-Powered English Learning Companion

Philingo is an innovative English learning platform designed to help you improve your reading comprehension and pronunciation skills. Whether you're a beginner or advanced learner, our interactive tools make language practice engaging and effective.

Key Features:
• Interactive Reading Practice - Read English texts with instant word definitions and phonetic transcriptions
• AI-Powered Pronunciation Feedback - Get real-time feedback on your spoken English using advanced speech recognition technology
• Personalized Learning - Track your vocabulary mastery and focus on words that need more practice
• Text Generation - Create custom practice materials tailored to your learning goals and interests
• Natural Voice Synthesis - Listen to native-like pronunciation for every word and sentence

How It Works:
Simply paste any English text you want to practice, or generate custom content using AI. Click on any word to see its definition, pronunciation guide, and hear it spoken aloud. Record yourself reading the text and receive instant feedback on your pronunciation accuracy. Build your vocabulary systematically and track your progress over time.

Start your English learning journey today with Philingo - where technology meets language education to create an immersive, personalized learning experience. Practice reading, improve pronunciation, and master English vocabulary at your own pace.`;

const STORAGE_KEY_TEXT = 'vocabflow_input_text';
const STORAGE_KEY_HISTORY = 'philingo_text_history';

export default function App() {
  // Track if text came from URL (should not be saved to localStorage)
  const [isFromUrl, setIsFromUrl] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const [text, setText] = useState<string>(() => {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const textParam = urlParams.get('t');
    if (textParam) {
      const decoded = decodeTextFromUrl(textParam);
      if (decoded) {
        return decoded;
      }
    }
    // Fall back to localStorage
    const cached = localStorage.getItem(STORAGE_KEY_TEXT);
    return cached || DEFAULT_TEXT;
  });
  const [mode, setMode] = useState<ViewMode>('read');
  const [inputText, setInputText] = useState<string>(() => {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const textParam = urlParams.get('t');
    if (textParam) {
      const decoded = decodeTextFromUrl(textParam);
      if (decoded) {
        return decoded;
      }
    }
    // Fall back to localStorage
    const cached = localStorage.getItem(STORAGE_KEY_TEXT);
    return cached || DEFAULT_TEXT;
  });

  // API Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [provider, setProvider] = useState<LLMProvider>('gemini');
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  // Check if text came from URL on mount and save it immediately
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const textParam = urlParams.get('t');
    if (textParam) {
      const decoded = decodeTextFromUrl(textParam);
      if (decoded) {
        setIsFromUrl(true);
        
        // Save to localStorage immediately so it persists on refresh
        localStorage.setItem(STORAGE_KEY_TEXT, decoded);
        
        // Also save to history with duplicate check
        if (decoded.trim() && decoded !== DEFAULT_TEXT) {
          try {
            const historyStr = localStorage.getItem(STORAGE_KEY_HISTORY);
            const history: Array<{text: string, timestamp: number, preview: string}> = historyStr ? JSON.parse(historyStr) : [];
            const preview = decoded.substring(0, 100) + (decoded.length > 100 ? '...' : '');
            
            const existingIndex = history.findIndex(item => item.text === decoded);
            if (existingIndex !== -1) {
              history[existingIndex].timestamp = Date.now();
              history[existingIndex].preview = preview;
            } else {
              history.unshift({
                text: decoded,
                timestamp: Date.now(),
                preview
              });
            }
            
            const trimmedHistory = history.slice(0, 50);
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmedHistory));
          } catch (error) {
            console.error('Failed to save to history:', error);
          }
        }
        
        // Clear URL parameter after reading (optional, keeps URL clean)
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Load key and provider from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const storedProvider = localStorage.getItem('llm_provider') as LLMProvider | null;
    if (storedKey) {
      setApiKey(storedKey);
    }
    if (storedProvider && (storedProvider === 'gemini' || storedProvider === 'openai')) {
      setProvider(storedProvider);
    } else {
        // Optional: Open modal immediately if no key is found
        // setIsKeyModalOpen(true);
    }
  }, []);

  // Create share link
  const handleCreateLink = useCallback(async () => {
    const encoded = encodeTextForUrl(text);
    if (!encoded) return;

    const url = `${window.location.origin}${window.location.pathname}?t=${encoded}`;

    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      // Fallback: show alert with URL
      prompt('Copy this link:', url);
    }
  }, [text]);

  const handleSaveKey = (key: string, selectedProvider: LLMProvider) => {
    localStorage.setItem('gemini_api_key', key);
    localStorage.setItem('llm_provider', selectedProvider);
    setApiKey(key);
    setProvider(selectedProvider);
  };

  const handleSaveText = () => {
    setText(inputText);
    // Always persist current practice text, including texts loaded via URL
    localStorage.setItem(STORAGE_KEY_TEXT, inputText);
    
    // Save to history (independent of URL status)
    if (inputText.trim() && inputText !== DEFAULT_TEXT) {
      try {
        const historyStr = localStorage.getItem(STORAGE_KEY_HISTORY);
        const history: Array<{text: string, timestamp: number, preview: string}> = historyStr ? JSON.parse(historyStr) : [];
        
        // Create preview (first 100 chars)
        const preview = inputText.substring(0, 100) + (inputText.length > 100 ? '...' : '');
        
        // Check if this exact text already exists in history
        const existingIndex = history.findIndex(item => item.text === inputText);
        if (existingIndex !== -1) {
          // Update timestamp and preview of existing entry
          history[existingIndex].timestamp = Date.now();
          history[existingIndex].preview = preview;
        } else {
          // Add new entry at the beginning
          history.unshift({
            text: inputText,
            timestamp: Date.now(),
            preview
          });
        }
        
        // Keep only the last 50 entries
        const trimmedHistory = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmedHistory));
      } catch (error) {
        console.error('Failed to save to history:', error);
      }
    }
    
    setIsFromUrl(false); // After saving, treat as local content
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
        existingProvider={provider}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/explore.html" className="flex items-center space-x-2 text-brand-600 hover:text-brand-700 transition-colors">
            <div className="relative">
              <MessageCircle className="w-6 h-6" />
              <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold text-brand-700">Ph</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Philingo</h1>
            <span className="text-sm text-slate-400 font-normal italic hidden sm:inline">— practice makes perfect</span>
          </a>
          
          <div className="flex items-center space-x-3">
             {/* Explore Button */}
             <a
                href="/explore.html"
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                title="Explore Texts"
             >
                <Compass size={20} />
             </a>

             {/* About Button */}
             <a
                href="/about.html"
                target="_blank"
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                title="About"
             >
                <Info size={20} />
             </a>

             {/* API Key Button */}
             <button
                onClick={() => setIsKeyModalOpen(true)}
                className={`p-2 rounded-full transition-colors ${!apiKey ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-slate-500 hover:bg-slate-100'}`}
                title="Configure API Key"
             >
                {!apiKey ? <KeyRound size={20} className="animate-pulse" /> : <Settings size={20} />}
             </button>

             {/* Create Link Button */}
             {mode === 'read' && (
               <button
                 onClick={handleCreateLink}
                 className={`p-2 rounded-full transition-colors flex items-center gap-1.5 ${
                   linkCopied
                     ? 'bg-green-100 text-green-600'
                     : 'text-slate-500 hover:bg-slate-100'
                 }`}
                 title={linkCopied ? 'Link Copied!' : 'Create Share Link'}
               >
                 {linkCopied ? <Check size={20} /> : <Link size={20} />}
               </button>
             )}

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
                            <p className="text-xs text-amber-700">You need to configure your API Key to use the analysis features.</p>
                        </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setIsKeyModalOpen(true)}>
                        Configure
                    </Button>
                </div>
            )}

            {mode === 'edit' ? (
                <div className="bg-white rounded-xl shadow-sm p-6 max-w-3xl mx-auto animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-900">Input English Text</h2>
                        <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => {
                                // First, normalize the text by removing excessive whitespace
                                const normalized = inputText.replace(/\n\s*\n+/g, '\n').trim();
                                
                                // Split text into sentences and format with one empty line between them
                                const formatted = normalized
                                    .split(/([.!?]+\s*)/)
                                    .reduce((acc, part, i, arr) => {
                                        if (i % 2 === 0 && part.trim()) {
                                            // This is sentence content
                                            const punctuation = arr[i + 1] || '';
                                            return acc + part + punctuation + '\n';
                                        }
                                        return acc;
                                    }, '')
                                    .trim();
                                setInputText(formatted);
                            }}
                        >
                            Format
                        </Button>
                    </div>
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Paste your English text here..."
                        className="w-full h-[600px] p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent font-serif text-lg leading-relaxed resize-none"
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
                        provider={provider}
                        onMissingKey={() => setIsKeyModalOpen(true)}
                    />
                </div>
            )}
        </div>
      </main>
      <Analytics />
    </div>
  );
}