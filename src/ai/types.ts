export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionChunk {
  choices?: Array<{
    delta?: Partial<ChatMessage>;
    message?: ChatMessage;
  }>;
}
