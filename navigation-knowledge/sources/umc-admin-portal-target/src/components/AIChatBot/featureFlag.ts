export const aiChatbotEnabled =
  import.meta.env.VITE_AI_CHATBOT_ENABLED ?? import.meta.env.VITE_FF_AI_ENABLED ?? "false";

export const openAiChatBotEvent = "nma-ai-chatbot:open";

export function requestOpenAiChatBot() {
  if (aiChatbotEnabled !== "true") return false;
  window.dispatchEvent(new Event(openAiChatBotEvent));
  return true;
}
