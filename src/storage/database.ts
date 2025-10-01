import type {SQLResultSet, SQLTransaction, WebSQLDatabase} from 'expo-sqlite';

type SQLiteModule = typeof import('expo-sqlite') | null;

type TransactionCallback = (transaction: SQLTransaction) => void;

type SqlArguments = readonly (string | number | null)[];

let sqliteModule: SQLiteModule = null;

try {
  const requiredModule = require('expo-sqlite');
  if (
    requiredModule &&
    typeof requiredModule.openDatabase === 'function'
  ) {
    sqliteModule = requiredModule as SQLiteModule;
  } else if (
    requiredModule?.default &&
    typeof requiredModule.default.openDatabase === 'function'
  ) {
    sqliteModule = requiredModule.default as SQLiteModule;
  }
} catch {
  sqliteModule = null;
}

let dbInstance: WebSQLDatabase | null = null;
let initialized = false;

const ensureDatabase = (): WebSQLDatabase => {
  if (!sqliteModule) {
    throw new Error('expo-sqlite is not available in this environment');
  }
  if (!dbInstance) {
    dbInstance = sqliteModule.openDatabase('dealmaster-chat-v2');
  }
  return dbInstance;
};

export const database = {
  get isAvailable(): boolean {
    return sqliteModule != null;
  },
  get raw(): WebSQLDatabase | null {
    return dbInstance;
  },
  ensure(): WebSQLDatabase {
    return ensureDatabase();
  },
  executeSql(query: string, params: SqlArguments = []): Promise<SQLResultSet> {
    if (!sqliteModule) {
      return Promise.reject(
        new Error('expo-sqlite is not available in this environment'),
      );
    }

    return new Promise<SQLResultSet>((resolve, reject) => {
      ensureDatabase().transaction(
        transaction => {
          transaction.executeSql(
            query,
            [...params],
            (_tx, result) => {
              resolve(result);
            },
            (_tx, error) => {
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
  },
  transaction(callback: TransactionCallback): Promise<void> {
    if (!sqliteModule) {
      return Promise.reject(
        new Error('expo-sqlite is not available in this environment'),
      );
    }

    return new Promise<void>((resolve, reject) => {
      ensureDatabase().transaction(
        transaction => {
          callback(transaction);
        },
        error => {
          reject(error);
        },
        () => {
          resolve();
        },
      );
    });
  },
  async initialize(): Promise<void> {
    if (!sqliteModule || initialized) {
      return;
    }

    await this.executeSql(
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT,
        auto_title TEXT NOT NULL,
        last_message_preview TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    );

    await this.executeSql(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        message_index INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES chat_sessions(id)
      )`,
    );

    await this.executeSql(
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_session
        ON chat_messages (session_id, message_index)`,
    );

    initialized = true;
  },
};

export type {SQLResultSet, SQLTransaction, WebSQLDatabase} from 'expo-sqlite';
