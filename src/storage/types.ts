export type ChatRecord = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRecord = {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant' | 'system' | 'summary';
  content: string;
  created_at: string;
};

