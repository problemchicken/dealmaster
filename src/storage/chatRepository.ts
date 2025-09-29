import type {SQLiteDatabase} from 'react-native-sqlite-storage';
import {AUTO_SUMMARY_PREFIX} from '../constants/chat';
import {getDatabase} from './database';
import {ChatRecord, ChatWithLatestMessage, MessageRecord} from './types';

const mapChat = (row: any): ChatRecord => ({
  id: row.id,
  title: row.title,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapMessage = (row: any): MessageRecord => ({
  id: row.id,
  chat_id: row.chat_id,
  role: row.role,
  content: row.content,
  created_at: row.created_at,
});

export const createChat = async (title: string): Promise<ChatRecord> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.executeSql(
    'INSERT INTO chats (title, created_at, updated_at) VALUES (?, ?, ?);',
    [title, now, now],
  );

  const insertedId = result[0].insertId ?? 0;
  const rows = await db.executeSql('SELECT * FROM chats WHERE id = ?;', [insertedId]);
  const item = rows[0].rows.item(0);
  return mapChat(item);
};

export const updateChatTimestamp = async (chatId: number) => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.executeSql('UPDATE chats SET updated_at = ? WHERE id = ?;', [now, chatId]);
};

const getLatestSummaryRow = async (
  db: SQLiteDatabase,
  chatId: number,
) => {
  const result = await db.executeSql(
    'SELECT * FROM messages WHERE chat_id = ? AND role = ? ORDER BY datetime(created_at) DESC LIMIT 1;',
    [chatId, 'summary'],
  );
  if (result[0].rows.length === 0) {
    return undefined;
  }
  return result[0].rows.item(0);
};

export const getChats = async (): Promise<ChatRecord[]> => {
  const db = await getDatabase();
  const result = await db.executeSql('SELECT * FROM chats ORDER BY updated_at DESC;');
  const rows = result[0].rows;
  const items: ChatRecord[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    items.push(mapChat(rows.item(i)));
  }
  return items;
};

export const getChatsWithLatestMessage = async (): Promise<ChatWithLatestMessage[]> => {
  const db = await getDatabase();
  const result = await db.executeSql(
    `SELECT
      c.id,
      c.title,
      c.created_at,
      c.updated_at,
      m.id AS latest_id,
      m.chat_id AS latest_chat_id,
      m.role AS latest_role,
      m.content AS latest_content,
      m.created_at AS latest_created_at
    FROM chats c
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages
      WHERE chat_id = c.id
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    )
    ORDER BY datetime(c.updated_at) DESC;`,
  );

  const rows = result[0].rows;
  const items: ChatWithLatestMessage[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows.item(i);
    const chat = mapChat(row);
    if (row.latest_id != null) {
      const latest = mapMessage({
        id: row.latest_id,
        chat_id: row.latest_chat_id,
        role: row.latest_role,
        content: row.latest_content,
        created_at: row.latest_created_at,
      });
      items.push({...chat, latestMessage: latest});
    } else {
      items.push(chat);
    }
  }
  return items;
};

export const getChatById = async (chatId: number): Promise<ChatRecord | undefined> => {
  const db = await getDatabase();
  const result = await db.executeSql('SELECT * FROM chats WHERE id = ?;', [chatId]);
  if (result[0].rows.length === 0) {
    return undefined;
  }
  return mapChat(result[0].rows.item(0));
};

export const deleteChat = async (chatId: number) => {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM chats WHERE id = ?;', [chatId]);
};

export const addMessage = async (
  chatId: number,
  role: MessageRecord['role'],
  content: string,
): Promise<MessageRecord> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.executeSql(
    'INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?);',
    [chatId, role, content, now],
  );
  await updateChatTimestamp(chatId);
  const insertedId = result[0].insertId ?? 0;
  const rows = await db.executeSql('SELECT * FROM messages WHERE id = ?;', [insertedId]);
  return mapMessage(rows[0].rows.item(0));
};

export const bulkInsertMessages = async (
  chatId: number,
  messages: Array<{role: MessageRecord['role']; content: string; created_at?: string}>,
) => {
  const db = await getDatabase();
  await db.transaction(async tx => {
    for (const message of messages) {
      const createdAt = message.created_at ?? new Date().toISOString();
      await tx.executeSql(
        'INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?);',
        [chatId, message.role, message.content, createdAt],
      );
    }
  });
  await updateChatTimestamp(chatId);
};

export const getMessagesForChat = async (chatId: number): Promise<MessageRecord[]> => {
  const db = await getDatabase();
  const result = await db.executeSql(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY datetime(created_at) ASC;',
    [chatId],
  );
  const rows = result[0].rows;
  const items: MessageRecord[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    items.push(mapMessage(rows.item(i)));
  }
  return items;
};

export const getLatestMessageForChat = async (
  chatId: number,
): Promise<MessageRecord | undefined> => {
  const db = await getDatabase();
  const result = await db.executeSql(
    'SELECT * FROM messages WHERE chat_id = ? ORDER BY datetime(created_at) DESC LIMIT 1;',
    [chatId],
  );
  if (result[0].rows.length === 0) {
    return undefined;
  }
  return mapMessage(result[0].rows.item(0));
};

export const upsertSummaryMessage = async (
  chatId: number,
  content: string,
  options?: {force?: boolean},
): Promise<MessageRecord> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const existing = await getLatestSummaryRow(db, chatId);

  if (existing) {
    const isAutoSummary = typeof existing.content === 'string'
      ? existing.content.startsWith(AUTO_SUMMARY_PREFIX)
      : false;
    if (!options?.force && !isAutoSummary) {
      return mapMessage(existing);
    }

    await db.executeSql('UPDATE messages SET content = ?, created_at = ? WHERE id = ?;', [content, now, existing.id]);
    await updateChatTimestamp(chatId);
    return mapMessage({
      ...existing,
      content,
      created_at: now,
    });
  }

  const result = await db.executeSql(
    'INSERT INTO messages (chat_id, role, content, created_at) VALUES (?, ?, ?, ?);',
    [chatId, 'summary', content, now],
  );
  await updateChatTimestamp(chatId);
  const insertedId = result[0].insertId ?? 0;
  const rows = await db.executeSql('SELECT * FROM messages WHERE id = ?;', [insertedId]);
  return mapMessage(rows[0].rows.item(0));
};


