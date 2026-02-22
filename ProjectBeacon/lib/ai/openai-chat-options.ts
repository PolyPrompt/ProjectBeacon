export function getOpenAIChatRequestTuning(model: string): {
  temperature?: number;
} {
  // GPT-5 chat models reject explicit temperature overrides.
  if (model.toLowerCase().startsWith("gpt-5")) {
    return {};
  }

  return {
    temperature: 0,
  };
}
