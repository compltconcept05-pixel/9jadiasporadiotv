import { GoogleGenAI } from "@google/genai";

export const getAIClient = (apiKeyOverride?: string) => {
  // Use override if provided, otherwise fallback to Vite env var, then Node process.env
  let apiKey = apiKeyOverride;

  if (!apiKey) {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    } else if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.VITE_GEMINI_API_KEY;
    }
  }

  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    console.error('❌ Gemini API key is missing or invalid! Add your key to .env.local');
    throw new Error('Gemini API key not configured');
  }

  return new GoogleGenAI({ apiKey });
};

/**
 * Generic retry wrapper for API calls to handle rate limits and temporary failures.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
    if (retries > 0 && (isRateLimit || error?.status >= 500)) {
      const waitTime = delay * 2;
      console.warn(`⏳ API Busy (429). Retrying in ${waitTime}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return withRetry(fn, retries - 1, waitTime);
    }
    // If rate limit persists, throw a user-friendly error
    if (isRateLimit) {
      throw new Error("System is busy (Rate Limit Exceeded). Please wait a minute and try again.");
    }
    throw error;
  }
}

export async function generateText(prompt: string, systemInstruction: string) {
  return withRetry(async () => {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        topK: 64,
        topP: 0.95,
      },
    });
    return response.text || "";
  });
}
