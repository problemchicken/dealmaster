import type {ChatMessage} from '../ai/types';
import {
  DEFAULT_SESSION_TITLE,
  type ChatSessionDetail,
  type ChatSessionListItem,
  type ChatSessionMetadata,
} from '../types/chat';
import {chatSessionsRepository} from '../storage/repositories/chatSessionsRepository';

const MAX_TITLE_LENGTH = 48;
const MAX_PREVIEW_LENGTH = 160;

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();

const stripKnownPrefixes = (value: string): string => {
  const prefixes = [
    /^(?:assistant|deal\s*master|bot|ai)[-:]\s*/i,
    /^\W+/,
  ];
  for (const prefix of prefixes) {
    if (prefix.test(value)) {
      return value.replace(prefix, '').trimStart();
    }
  }
  return value.trimStart();
};

const normalizeSummary = (input: string | null | undefined): string | null => {
  if (typeof input !== 'string') {
    return null;
  }
  const collapsed = collapseWhitespace(input);
  if (collapsed.length === 0) {
    return null;
  }
  const stripped = stripKnownPrefixes(collapsed);
  const normalized = stripped.length > 0 ? stripped : collapsed;
  return normalized.length === 0 ? null : normalized;
};

const truncate = (value: string, length: number): string =>
  value.length > length ? `${value.slice(0, length)}…` : value;

const deriveLastMessagePreview = (messages: ChatMessage[]): string | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'system') {
      continue;
    }
    const normalized = normalizeSummary(message.content);
    if (normalized) {
      return truncate(normalized, MAX_PREVIEW_LENGTH);
    }
  }
  return null;
};

const deriveAutoTitle = (messages: ChatMessage[]): string => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'system') {
      continue;
    }
    const normalized = normalizeSummary(message.content);
    if (normalized) {
      return truncate(normalized, MAX_TITLE_LENGTH);
    }
  }
  return DEFAULT_SESSION_TITLE;
};

const normalizeManualTitle = (title?: string | null): string | null => {
  if (typeof title !== 'string') {
    return null;
  }
  const trimmed = collapseWhitespace(title);
  return trimmed.length > 0 ? trimmed : null;
};

const getDisplayTitle = (
  session: ChatSessionMetadata | ChatSessionDetail,
): string => {
  if (session.title && session.title.trim().length > 0) {
    return session.title;
  }
  if (session.autoTitle && session.autoTitle.trim().length > 0) {
    return session.autoTitle;
  }
  return DEFAULT_SESSION_TITLE;
};

const initialize = async (): Promise<void> => {
  await chatSessionsRepository.initialize();
};

const createSession = async (
  title?: string,
): Promise<ChatSessionDetail> => {
  await initialize();
  const manualTitle = normalizeManualTitle(title);
  const autoTitle = manualTitle ?? DEFAULT_SESSION_TITLE;
  return chatSessionsRepository.createSession({
    title: manualTitle,
    autoTitle,
    lastMessagePreview: null,
  });
};

const listSessions = async (): Promise<ChatSessionListItem[]> => {
  await initialize();
  return chatSessionsRepository.listSessions();
};

const getSession = async (
  sessionId: string,
): Promise<ChatSessionDetail | null> => {
  await initialize();
  return chatSessionsRepository.getSession(sessionId);
};

const saveConversation = async (
  sessionId: string,
  messages: ChatMessage[],
): Promise<ChatSessionMetadata | null> => {
  await initialize();
  const updatedAt = Date.now();
  const autoTitle = deriveAutoTitle(messages);
  const lastMessagePreview = deriveLastMessagePreview(messages);
  const metadata = await chatSessionsRepository.replaceMessages(
    sessionId,
    messages,
    {
      autoTitle,
      lastMessagePreview,
      updatedAt,
    },
  );
  return metadata;
};

const deleteSession = async (sessionId: string): Promise<void> => {
  await initialize();
  await chatSessionsRepository.deleteSession(sessionId);
};

export const chatSessionsService = {
  initialize,
  createSession,
  listSessions,
  getSession,
  saveConversation,
  deleteSession,
  getDisplayTitle,
};

export {DEFAULT_SESSION_TITLE};
