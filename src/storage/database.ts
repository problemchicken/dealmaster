import SQLite, {SQLiteDatabase} from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let database: SQLiteDatabase | null = null;

const DATABASE_NAME = 'DealMaster.db';

const createTables = async (db: SQLiteDatabase) => {
  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );`,
  );

  await db.executeSql(
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );`,
  );
};

export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (database) {
    return database;
  }

  database = await SQLite.openDatabase({name: DATABASE_NAME, location: 'default'});
  await createTables(database);
  return database;
};

export const closeDatabase = async () => {
  if (database) {
    await database.close();
    database = null;
  }
};

