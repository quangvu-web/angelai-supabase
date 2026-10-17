export const ANGEL_CHAT_PATH = "/functions/v1/angel-chat";

export function angelChatUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}${ANGEL_CHAT_PATH}`;
}
