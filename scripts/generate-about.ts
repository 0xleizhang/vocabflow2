import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Change {
  area: string;
  description: string;
  improvements: string[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  commit: string;
  author: string;
  type: string;
  summary: string;
  changes: Change[];
}

interface ChangelogData {
  project: string;
  description: string;
  repository: string;
  changelog: ChangelogEntry[];
  features_summary: {
    core_features: string[];
    technical_stack: Record<string, string>;
    development_highlights: string[];
  };
}

// Convert date to ISO string for frontend processing
function getDateTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString();
}

// Read YAML file
const yamlPath = path.resolve(__dirname, '../change-logs.yaml');
const yamlContent = fs.readFileSync(yamlPath, 'utf8');
const data = yaml.load(yamlContent) as ChangelogData;

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - ${data.project}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Inter', sans-serif;
        }
        
        .timeline-line {
            position: absolute;
            left: 31px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(to bottom, #e2e8f0, #cbd5e1);
        }
        
        .timeline-dot {
            position: absolute;
            left: 24px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10;
        }
        
        .type-feature { background: #10b981; }
        .type-refactor { background: #3b82f6; }
        .type-initial { background: #8b5cf6; }
        
        .animate-fade-in {
            animation: fadeIn 0.6s ease-out forwards;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .feature-badge {
            transition: all 0.2s ease;
        }
        
        .feature-badge:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
    </style>
    <script>
        // Format relative time based on timestamp
        function formatRelativeTime(isoString) {
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            // If more than 1 day, show the actual date
            if (diffDay >= 1) {
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
            } else if (diffHour > 0) {
                return \`\${diffHour} hour\${diffHour > 1 ? 's' : ''} ago\`;
            } else if (diffMin > 0) {
                return \`\${diffMin} minute\${diffMin > 1 ? 's' : ''} ago\`;
            } else {
                return 'just now';
            }
        }

        // Initialize relative times when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            const timeElements = document.querySelectorAll('[data-timestamp]');
            timeElements.forEach(el => {
                const timestamp = el.getAttribute('data-timestamp');
                el.textContent = formatRelativeTime(timestamp);
            });
        });
    </script>
</head>
<body class="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
    <div class="max-w-6xl mx-auto px-4 py-12">
        <!-- Header -->
        <div class="mb-12 animate-fade-in">
            <a href="/" class="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors">
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                </svg>
                Back to App
            </a>
            
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                </div>
                <div>
                    <h1 class="text-4xl font-bold text-slate-900">${data.project}</h1>
                    <p class="text-slate-600 mt-1">${data.description}</p>
                </div>
            </div>
            
            <a href="https://github.com/${data.repository}" target="_blank" 
               class="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 transition-colors">
                <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                ${data.repository}
            </a>
        </div>

        <!-- Support Section -->
        <div class="mb-12 animate-fade-in" style="animation-delay: 0.1s;">
            <div class="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl shadow-md p-8 border-2 border-pink-200 max-w-3xl mx-auto hover:shadow-lg transition-shadow">
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-500 rounded-full mb-4">
                        <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <h2 class="text-2xl font-bold text-slate-900 mb-3">支持项目发展</h2>
                    <p class="text-slate-600 mb-6 max-w-xl mx-auto">如果这个项目对你有帮助，欢迎通过爱发电支持开发者继续改进和维护</p>
                    <a href="https://afdian.com/a/leixdev" target="_blank" 
                       class="inline-flex items-center px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-rose-600 transform hover:scale-105 transition-all shadow-lg hover:shadow-xl">
                        <svg class="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
                        </svg>
                        <span class="text-lg">打赏支持</span>
                    </a>
                </div>
            </div>
        </div>

        <!-- Features Summary -->
        <div class="mb-12 animate-fade-in" style="animation-delay: 0.2s;">
            <div class="bg-white rounded-xl shadow-sm p-6 border border-slate-200 max-w-3xl mx-auto">
                <h2 class="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                    <svg class="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Core Features
                </h2>
                <ul class="space-y-2">
                    ${data.features_summary.core_features.map(feature => `
                    <li class="flex items-start text-sm text-slate-700">
                        <svg class="w-4 h-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                        </svg>
                        ${feature}
                    </li>
                    `).join('')}
                </ul>
            </div>
        </div>

        <!-- Timeline -->
        <div class="bg-white rounded-xl shadow-sm p-8 border border-slate-200 animate-fade-in" style="animation-delay: 0.3s;">
            <h2 class="text-2xl font-bold text-slate-900 mb-8 flex items-center">
                <svg class="w-6 h-6 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Development Timeline
            </h2>
            
            <div class="relative pl-16">
                <div class="timeline-line"></div>
                
                ${data.changelog.map((entry, index) => `
                <div class="relative mb-12 last:mb-0 animate-fade-in" style="animation-delay: ${0.3 + index * 0.1}s;">
                    <div class="timeline-dot type-${entry.type}"></div>
                    
                    <div class="bg-slate-50 rounded-lg p-6 border border-slate-200 hover:border-slate-300 transition-all hover:shadow-md">
                        <div class="flex items-start justify-between mb-3">
                            <div class="flex items-center gap-3">
                                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                    entry.type === 'feature' ? 'bg-green-100 text-green-700' :
                                    entry.type === 'refactor' ? 'bg-blue-100 text-blue-700' :
                                    'bg-purple-100 text-purple-700'
                                }">
                                    ${entry.type}
                                </span>
                                <h3 class="text-xl font-semibold text-slate-900">${entry.version}</h3>
                            </div>
                            <div class="text-right text-sm">
                                <div class="text-slate-600" data-timestamp="${getDateTimestamp(entry.date)}">-</div>
                            </div>
                        </div>
                        
                        <p class="text-slate-700 mb-4 font-medium">${entry.summary}</p>
                        
                        ${entry.changes.map(change => `
                        <div class="mb-4 last:mb-0">
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                                </svg>
                                <h4 class="font-semibold text-slate-800">${change.area}</h4>
                            </div>
                            <p class="text-sm text-slate-600 mb-2 ml-6">${change.description}</p>
                            ${change.improvements.length > 0 ? `
                            <ul class="ml-6 space-y-1">
                                ${change.improvements.map(improvement => `
                                <li class="text-sm text-slate-600 flex items-start">
                                    <span class="text-indigo-400 mr-2">•</span>
                                    <span>${improvement}</span>
                                </li>
                                `).join('')}
                            </ul>
                            ` : ''}
                        </div>
                        `).join('')}
                    </div>
                </div>
                `).join('')}
            </div>
        </div>

        <!-- Development Highlights -->
        <div class="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100 animate-fade-in" style="animation-delay: 0.5s;">
            <h2 class="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                </svg>
                Development Highlights
            </h2>
            <div class="grid md:grid-cols-3 gap-3">
                ${data.features_summary.development_highlights.map(highlight => `
                <div class="feature-badge bg-white rounded-lg p-3 text-sm text-slate-700 border border-indigo-100">
                    ${highlight}
                </div>
                `).join('')}
            </div>
        </div>

        <!-- Footer -->
        <div class="mt-12 text-center text-sm text-slate-500 animate-fade-in" style="animation-delay: 0.6s;">
            <p>Built with ❤️ by ${data.changelog[0]?.author || 'the team'}</p>
            <p class="mt-1">Last updated: <span data-timestamp="${data.changelog[0]?.date ? getDateTimestamp(data.changelog[0].date) : new Date().toISOString()}">-</span></p>
        </div>
    </div>
</body>
</html>`;

// Write HTML file to public folder
const outputPath = path.resolve(__dirname, '../public/about.html');
const publicDir = path.resolve(__dirname, '../public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(outputPath, html, 'utf8');
console.log('✅ About page generated successfully at public/about.html');
