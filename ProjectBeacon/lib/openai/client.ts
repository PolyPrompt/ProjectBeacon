import OpenAI from "openai";

import { getEnv } from "@/lib/env";

let openAIClient: OpenAI | null = null;

export function getOpenAIClient() {
  if (openAIClient) {
    return openAIClient;
  }

  const env = getEnv();

  openAIClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openAIClient;
}
