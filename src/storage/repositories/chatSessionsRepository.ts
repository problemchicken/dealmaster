import type {SQLTransaction} from '../database';
import {database} from '../database';
import type {ChatMessage} from '../../ai/types';
import type {
  ChatSessionDetail,
  ChatSessionListItem,
  ChatSessionMetadata,
} from '../../types/chat';
import {DEFAULT_SESSION_TITLE} from '../../types/chat';

type CreateSessionInput = {
  title: string | null;
  autoTitle: string;
  lastMessagePreview: string | null;
};

type ReplaceMessagesInput = {
  autoTitle: string;
  lastMessagePreview: string | null;
  updatedAt: number;
};

type MemorySession = ChatSessionDetail;

const memorySessions = new Map<string, MemorySession>();

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const toMetadata = (session: MemorySession): ChatSessionMetadata => ({
  id: session.id,
  title: session.title,
  autoTitle: session.autoTitle,
  lastMessagePreview: session.lastMessagePreview,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

let initialized = false;

const ensureInitialized = async () => {
  if (initialized) {
    return;
  }
  if (database.isAvailable) {
    await database.initialize();
  }
  initialized = true;
};

const mapRowToMetadata = (row: Record<string, unknown>): ChatSessionMetadata => ({
  id: String(row.id),
  title:
    typeof row.title === 'string' && row.title.trim().length > 0
      ? row.title
      : null,
  autoTitle:
    typeof row.auto_title === 'string' && row.auto_title.trim().length > 0
      ? row.auto_title
      : DEFAULT_SESSION_TITLE,
  lastMessagePreview:
    typeof row.last_message_preview === 'string' &&
    row.last_message_preview.trim().length > 0
      ? row.last_message_preview
      : null,
  createdAt: Number(row.created_at) || Date.now(),
  updatedAt: Number(row.updated_at) || Date.now(),
});

const readRows = <T>(
  result: {rows: {length: number; item: (index: number) => any}},
  mapper: (row: Record<string, unknown>) => T,
): T[] => {
  const rows = result.rows;
  const items: T[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    items.push(mapper(rows.item(index) as Record<string, unknown>));
  }
  return items;
};

const getSessionMetadata = async (
  sessionId: string,
): Promise<ChatSessionMetadata | null> => {
  if (database.isAvailable) {
    await ensureInitialized();
    const result = await database.executeSql(
      `SELECT id, title, auto_title, last_message_preview, created_at, updated_at
        FROM chat_sessions WHERE id = ? LIMIT 1`,
      [sessionId],
    );
    if (result.rows.length === 0) {
      return null;
    }
    return mapRowToMetadata(result.rows.item(0) as Record<string, unknown>);
  }

  const session = memorySessions.get(sessionId);
  if (!session) {
    return null;
  }
  return toMetadata(session);
};

const getSessionDetail = async (
  sessionId: string,
): Promise<ChatSessionDetail | null> => {
  if (database.isAvailable) {
    await ensureInitialized();
    const sessionResult = await database.executeSql(
      `SELECT id, title, auto_title, last_message_preview, created_at, updated_at
        FROM chat_sessions WHERE id = ? LIMIT 1`,
      [sessionId],
    );
    if (sessionResult.rows.length === 0) {
      return null;
    }
    const metadata = mapRowToMetadata(
      sessionResult.rows.item(0) as Record<string, unknown>,
    );
    const messagesResult = await database.executeSql(
      `SELECT role, content FROM chat_messages WHERE session_id = ?
        ORDER BY message_index ASC`,
      [sessionId],
    );
    const messages = readRows(messagesResult, row => ({
      role: String(row.role) as ChatMessage['role'],
      content: String(row.content ?? ''),
    }));
    return {...metadata, messages};
  }

  const session = memorySessions.get(sessionId);
  return session ? {...session, messages: [...session.messages]} : null;
};

const createSession = async (
  input: CreateSessionInput,
): Promise<ChatSessionDetail> => {
  const now = Date.now();
  const sessionId = createId();
  const metadata: ChatSessionMetadata = {
    id: sessionId,
    title: input.title,
    autoTitle:
      input.autoTitle.trim().length > 0
        ? input.autoTitle
        : DEFAULT_SESSION_TITLE,
    lastMessagePreview: input.lastMessagePreview,
    createdAt: now,
    updatedAt: now,
  };

  if (database.isAvailable) {
    await ensureInitialized();
    await database.executeSql(
      `INSERT INTO chat_sessions (id, title, auto_title, last_message_preview, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        metadata.id,
        metadata.title,
        metadata.autoTitle,
        metadata.lastMessagePreview,
        metadata.createdAt,
        metadata.updatedAt,
      ],
    );
  } else {
    memorySessions.set(metadata.id, {...metadata, messages: []});
  }

  return {...metadata, messages: []};
};

const listSessions = async (): Promise<ChatSessionListItem[]> => {
  if (database.isAvailable) {
    await ensureInitialized();
    const result = await database.executeSql(
      `SELECT id, title, auto_title, last_message_preview, created_at, updated_at
        FROM chat_sessions ORDER BY updated_at DESC`,
    );
    return readRows(result, mapRowToMetadata);
  }

  return Array.from(memorySessions.values())
    .map(session => toMetadata(session))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

const replaceMessages = async (
  sessionId: string,
  messages: ChatMessage[],
  input: ReplaceMessagesInput,
): Promise<ChatSessionMetadata | null> => {
  if (database.isAvailable) {
    await ensureInitialized();
    const db = database.ensure();
    await new Promise<void>((resolve, reject) => {
      db.transaction(
        transaction => {
          persistMessagesTransaction(transaction, sessionId, messages, input);
        },
        error => {
          reject(error);
        },
        () => {
          resolve();
        },
      );
    });
    return getSessionMetadata(sessionId);
  }

  const existing = memorySessions.get(sessionId);
  if (!existing) {
    return null;
  }
  const updatedSession: MemorySession = {
    ...existing,
    messages: [...messages],
    autoTitle: input.autoTitle,
    lastMessagePreview: input.lastMessagePreview,
    updatedAt: input.updatedAt,
  };
  memorySessions.set(sessionId, updatedSession);
  return toMetadata(updatedSession);
};

const persistMessagesTransaction = (
  transaction: SQLTransaction,
  sessionId: string,
  messages: ChatMessage[],
  input: ReplaceMessagesInput,
) => {
  transaction.executeSql('DELETE FROM chat_messages WHERE session_id = ?', [
    sessionId,
  ]);
  messages.forEach((message, index) => {
    transaction.executeSql(
      `INSERT INTO chat_messages (session_id, role, content, created_at, message_index)
        VALUES (?, ?, ?, ?, ?)`,
      [sessionId, message.role, message.content, input.updatedAt, index],
    );
  });
  transaction.executeSql(
    `UPDATE chat_sessions
      SET auto_title = ?, last_message_preview = ?, updated_at = ?
      WHERE id = ?`,
    [input.autoTitle, input.lastMessagePreview, input.updatedAt, sessionId],
  );
};

const deleteSession = async (sessionId: string): Promise<void> => {
  if (database.isAvailable) {
    await ensureInitialized();
    await database.transaction(transaction => {
      transaction.executeSql('DELETE FROM chat_messages WHERE session_id = ?', [
        sessionId,
      ]);
      transaction.executeSql('DELETE FROM chat_sessions WHERE id = ?', [
        sessionId,
      ]);
    });
    return;
  }

  memorySessions.delete(sessionId);
};

export const chatSessionsRepository = {
  initialize: ensureInitialized,
  createSession,
  getSession: getSessionDetail,
  listSessions,
  replaceMessages,
  deleteSession,
  getSessionMetadata,
};
