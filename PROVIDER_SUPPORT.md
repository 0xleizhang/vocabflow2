# API Provider Support - 多Provider支持

## 概述

已成功扩展Philingo以支持多个AI Provider（提供商），现在除了Google Gemini外，还支持OpenAI。

## 主要修改

### 1. 类型定义 (`types.ts`)
- 添加了 `LLMProvider` 类型：`'gemini' | 'openai'`

### 2. OpenAI服务 (`services/openaiService.ts`)
新建文件，实现了与Gemini Service相同的接口：
- `fetchTTSAudio()` - 使用OpenAI TTS-1模型生成语音
- `fetchWordAnnotation()` - 使用GPT-4o-mini进行单词注释
- `analyzePronunciation()` - 使用Whisper进行语音转文字，GPT-4o-mini进行发音分析
- 包含完整的localStorage缓存机制

### 3. 统一服务接口 (`services/llmService.ts`)
新建文件，提供统一的API接口：
- 根据provider参数自动路由到对应的服务
- 所有主要功能都支持provider选择
- 简化了调用代码

### 4. API Key配置界面 (`components/ApiKeyModal.tsx`)
更新功能：
- 添加Provider选择按钮（Gemini / OpenAI）
- 动态显示对应provider的配置信息
- 显示对应的API Key获取链接
- 同时保存API Key和Provider选择

### 5. 主应用 (`App.tsx`)
更新功能：
- 添加provider状态管理
- 从localStorage加载和保存provider配置
- 将provider传递给Reader组件
- 更新UI文本使其provider无关

### 6. 阅读器组件 (`components/Reader.tsx`)
更新功能：
- 接收provider参数
- 所有API调用都传递provider参数
- 使用统一的llmService接口

## 使用方法

### 配置API Key

1. 点击右上角的设置图标（或钥匙图标）
2. 选择AI Provider：
   - **Google Gemini**: 在[Google AI Studio](https://aistudio.google.com/app/apikey)获取免费API Key
   - **OpenAI**: 在[OpenAI Platform](https://platform.openai.com/api-keys)获取API Key
3. 输入API Key并保存

### OpenAI功能对应

| 功能        | Gemini模型                   | OpenAI模型              |
| ----------- | ---------------------------- | ----------------------- |
| TTS语音合成 | gemini-2.5-flash-preview-tts | TTS-1 (alloy voice)     |
| 单词注释    | gemini-2.5-flash             | GPT-4o-mini             |
| 发音分析    | gemini-2.5-flash (多模态)    | Whisper-1 + GPT-4o-mini |

## 技术细节

### 缓存机制
- 每个provider都有独立的缓存空间
- 切换provider不会清除另一个provider的缓存
- 缓存键前缀：
  - Gemini TTS: `vocabflow_tts_`
  - OpenAI TTS: `vocabflow_openai_tts_`
  - Gemini Annotation: `vocabflow_annotation_`
  - OpenAI Annotation: `vocabflow_openai_annotation_`

### 存储结构
```javascript
localStorage:
- 'gemini_api_key': API Key（向后兼容）
- 'llm_provider': 'gemini' | 'openai'
```

## 注意事项

1. **安全性**: OpenAI客户端使用 `dangerouslyAllowBrowser: true`，这仅适用于原型开发。生产环境应该使用后端代理。

2. **成本**: 
   - Gemini有较慷慨的免费额度
   - OpenAI API按使用量计费

3. **功能差异**:
   - Gemini的发音分析是直接分析音频
   - OpenAI使用Whisper转录后再分析，可能在某些场景下效果不同

## 依赖包

新增依赖：
```json
{
  "openai": "^4.x.x"
}
```

已安装完成。
