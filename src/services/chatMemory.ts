import type {ChatMessage} from '../ai/types';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

const DEFAULT_SESSION_TITLE = 'New Chat';

type SQLiteModule = typeof import('expo-sqlite') | null;

type SQLResultSet = import('expo-sqlite').SQLResultSet;
type WebSQLDatabase = import('expo-sqlite').WebSQLDatabase;

type Adapter = {
  initialize: () => Promise<void>;
  listSessions: () => Promise<ChatSession[]>;
  createSession: (title?: string) => Promise<ChatSession>;
  getSession: (id: string) => Promise<ChatSession | null>;
  saveMessages: (id: string, messages: ChatMessage[]) => Promise<void>;
  updateSessionTitle: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
};

const createId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const parseMessages = (serialized: unknown): ChatMessage[] => {
  if (typeof serialized !== 'string' || serialized.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(serialized);
    if (Array.isArray(parsed)) {
      return parsed as ChatMessage[];
    }
  } catch {
    // Ignore malformed payloads and reset to an empty conversation.
  }
  return [];
};

let sqliteModule: SQLiteModule = null;
try {
  const requiredModule = require('expo-sqlite');
  if (requiredModule && typeof requiredModule.openDatabase === 'function') {
    sqliteModule = requiredModule as SQLiteModule;
  } else if (
    requiredModule?.default &&
    typeof requiredModule.default.openDatabase === 'function'
  ) {
    sqliteModule = requiredModule.default as SQLiteModule;
  } else {
    sqliteModule = null;
  }
} catch {
  sqliteModule = null;
}

const hasSQLite = sqliteModule != null;

const createSQLiteAdapter = (): Adapter => {
  let database: WebSQLDatabase | null = null;

  const getDatabase = (): WebSQLDatabase => {
    if (!database) {
      database = sqliteModule!.openDatabase('dealmaster-chat');
    }
    return database;
  };

  const runSql = async (
    query: string,
    params: (string | number | null)[] = [],
  ): Promise<SQLResultSet> =>
    new Promise((resolve, reject) => {
      getDatabase().transaction(
        tx => {
          tx.executeSql(
            query,
            params,
            (_transaction, result) => {
              resolve(result);
            },
            (_transaction, error) => {
              reject(error);
              return false;
            },
          );
        },
        error => {
          reject(error);
        },
      );
    });

  const initialize = async () => {
    await runSql(
      'CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, messages TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
    );
  };

  const listSessions = async (): Promise<ChatSession[]> => {
    const result = await runSql(
      'SELECT id, title, messages, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC',
    );
    const rows = result.rows as unknown as {length: number; item: (index: number) => any};
    const sessions: ChatSession[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows.item(index) as Record<string, unknown>;
      sessions.push({
        id: String(row.id),
        title: typeof row.title === 'string' && row.title.length > 0 ? row.title : DEFAULT_SESSION_TITLE,
        createdAt: Number(row.created_at) || Date.now(),
        updatedAt: Number(row.updated_at) || Date.now(),
        messages: parseMessages(row.messages),
      });
    }
    return sessions;
  };

  const getSession = async (id: string): Promise<ChatSession | null> => {
    const result = await runSql(
      'SELECT id, title, messages, created_at, updated_at FROM chat_sessions WHERE id = ? LIMIT 1',
      [id],
    );
    const rows = result.rows as unknown as {length: number; item: (index: number) => any};
    if (rows.length === 0) {
      return null;
    }
    const row = rows.item(0) as Record<string, unknown>;
    return {
      id: String(row.id),
      title:
        typeof row.title === 'string' && row.title.length > 0
          ? row.title
          : DEFAULT_SESSION_TITLE,
      createdAt: Number(row.created_at) || Date.now(),
      updatedAt: Number(row.updated_at) || Date.now(),
      messages: parseMessages(row.messages),
    };
  };

  const createSession = async (title = DEFAULT_SESSION_TITLE): Promise<ChatSession> => {
    const now = Date.now();
    const id = createId();
    await runSql(
      'INSERT INTO chat_sessions (id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, title, JSON.stringify([]), now, now],
    );
    return {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  };

  const saveMessages = async (id: string, messages: ChatMessage[]) => {
    const now = Date.now();
    await runSql('UPDATE chat_sessions SET messages = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(messages),
      now,
      id,
    ]);
  };

  const updateSessionTitle = async (id: string, title: string) => {
    const now = Date.now();
    await runSql('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?', [
      title,
      now,
      id,
    ]);
  };

  const deleteSession = async (id: string) => {
    await runSql('DELETE FROM chat_sessions WHERE id = ?', [id]);
  };

  return {
    initialize,
    listSessions,
    createSession,
    getSession,
    saveMessages,
    updateSessionTitle,
    deleteSession,
  };
};

const createMemoryAdapter = (): Adapter => {
  const sessions = new Map<string, ChatSession>();

  const initialize = async () => {
    // No-op for memory adapter.
    if (sessions.size === 0) {
      // Ensure at least deterministic behavior during tests by touching the map.
      sessions.size;
    }
  };

  const listSessions = async (): Promise<ChatSession[]> =>
    Array.from(sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);

  const createSession = async (title = DEFAULT_SESSION_TITLE): Promise<ChatSession> => {
    const now = Date.now();
    const session: ChatSession = {
      id: createId(),
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    sessions.set(session.id, session);
    return session;
  };

  const getSession = async (id: string): Promise<ChatSession | null> =>
    sessions.get(id) ?? null;

  const saveMessages = async (id: string, messages: ChatMessage[]) => {
    const session = sessions.get(id);
    if (!session) {
      return;
    }
    session.messages = messages;
    session.updatedAt = Date.now();
    sessions.set(id, session);
  };

  const updateSessionTitle = async (id: string, title: string) => {
    const session = sessions.get(id);
    if (!session) {
      return;
    }
    session.title = title;
    session.updatedAt = Date.now();
    sessions.set(id, session);
  };

  const deleteSession = async (id: string) => {
    sessions.delete(id);
  };

  return {
    initialize,
    listSessions,
    createSession,
    getSession,
    saveMessages,
    updateSessionTitle,
    deleteSession,
  };
};

const adapter: Adapter = hasSQLite ? createSQLiteAdapter() : createMemoryAdapter();

const deriveSessionTitle = (messages: ChatMessage[]): string => {
  const firstUserMessage = messages.find(message => message.role === 'user');
  if (!firstUserMessage) {
    return DEFAULT_SESSION_TITLE;
  }
  const normalized = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    return DEFAULT_SESSION_TITLE;
  }
  return normalized.length > 48 ? `${normalized.slice(0, 48)}…` : normalized;
};

export const chatMemory = {
  initialize: adapter.initialize,
  listSessions: adapter.listSessions,
  createSession: adapter.createSession,
  getSession: adapter.getSession,
  deleteSession: adapter.deleteSession,
  async saveConversation(id: string, messages: ChatMessage[]) {
    await adapter.saveMessages(id, messages);
  },
  async updateTitle(id: string, messages: ChatMessage[]) {
    const title = deriveSessionTitle(messages);
    await adapter.updateSessionTitle(id, title);
    return title;
  },
};

export {DEFAULT_SESSION_TITLE};
