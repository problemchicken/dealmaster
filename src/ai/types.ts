export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionChunkChoice {
  delta?: Partial<ChatMessage> & {content?: string};
  message?: ChatMessage;
}

export interface ChatCompletionChunk {
  choices?: ChatCompletionChunkChoice[];
}
