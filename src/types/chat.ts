import type {ChatMessage} from '../ai/types';

export const DEFAULT_SESSION_TITLE = 'New Chat';

export interface ChatSessionMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Title explicitly provided by the user. When present it should take
   * precedence over the auto generated title.
   */
  title: string | null;
  /**
   * Auto generated summary of the conversation. Used as a fallback title
   * when the user has not provided one.
   */
  autoTitle: string;
  /**
   * Cached preview of the latest non-system message in the conversation.
   */
  lastMessagePreview: string | null;
}

export interface ChatSessionDetail extends ChatSessionMetadata {
  messages: ChatMessage[];
}

export type ChatSessionListItem = ChatSessionMetadata;

export interface ChatScreenParams {
  sessionId?: string;
  title?: string;
}
