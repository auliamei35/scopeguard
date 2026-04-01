// src/lib/gemini.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Singleton client
let _gemini: ReturnType<typeof createGoogleGenerativeAI> | null = null;

export function getGeminiClient() {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    _gemini = createGoogleGenerativeAI({ apiKey });
  }
  return _gemini;
}

export function getGeminiModel() {
  return getGeminiClient()('gemini-2.5-flash');
}