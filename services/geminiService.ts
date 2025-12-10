import { GoogleGenAI, Type } from "@google/genai";
import { Annotation } from '../types';

export const fetchWordAnnotation = async (word: string, contextSentence: string, apiKey: string): Promise<Annotation> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Initialize the client dynamically with the user-provided key
  const ai = new GoogleGenAI({ apiKey });

  try {
    const prompt = `
      Analyze the English word "${word}".
      Context: "${contextSentence}".
      
      Provide:
      1. The IPA phonetic transcription (British or American general).
      2. A concise Chinese definition (max 10 chars) suitable for this context.
      
      Return as JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ipa: { type: Type.STRING, description: "IPA phonetic transcription, e.g., /həˈləʊ/" },
            definition: { type: Type.STRING, description: "Concise Chinese definition" },
          },
          required: ["ipa", "definition"],
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("No response from AI");
    }

    return JSON.parse(jsonText) as Annotation;

  } catch (error) {
    console.error("Error fetching annotation:", error);
    throw error;
  }
};