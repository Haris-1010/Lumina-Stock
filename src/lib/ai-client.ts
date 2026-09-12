import "server-only";

import OpenAI from "openai";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export type AIProvider = "gemini" | "groq";

export interface AIClientHandle {
  client: OpenAI;
  model: string;
  provider: AIProvider;
}

/** Returns Gemini 2.5 Flash if GEMINI_API_KEY is set, falls back to GROQ. */
export function getAIClient(): AIClientHandle | null {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return {
      client: new OpenAI({ apiKey: geminiKey, baseURL: GEMINI_BASE_URL }),
      model: process.env.GEMINI_MODEL || GEMINI_MODEL,
      provider: "gemini",
    };
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: process.env.GROQ_BASE_URL || GROQ_BASE_URL,
      }),
      model: process.env.GROQ_MODEL || GROQ_MODEL,
      provider: "groq",
    };
  }

  return null;
}

/** GROQ-only client — used for vision (image scanning) since GROQ has a dedicated vision model. */
export function getGroqClientDirect(): { client: OpenAI; visionModel: string } | null {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    client: new OpenAI({ apiKey, baseURL: process.env.GROQ_BASE_URL || GROQ_BASE_URL }),
    visionModel: process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview",
  };
}
