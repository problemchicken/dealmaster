import {addMessage, getMessagesForChat, updateChatTimestamp} from '../storage/chatRepository';
import {MessageRecord} from '../storage/types';
import {estimateTokenSize, summarizeMessages} from './summarizer';

const TOKEN_LIMIT = 1800;
const RECENT_MESSAGE_COUNT = 8;

export type GenerateChatOptions = {
  responder?: (messages: MessageRecord[]) => Promise<string>;
};

const defaultResponder = async (messages: MessageRecord[]) => {
  const lastUser = [...messages].reverse().find(message => message.role === 'user');
  if (!lastUser) {
    return '你好！今天想聊些什麼？';
  }
  const context = messages
    .filter(message => message.role !== 'summary')
    .slice(-3)
    .map(message => (message.role === 'user' ? `你說：「${message.content}」` : `我回覆：「${message.content}」`))
    .join(' ');
  return `收到你的訊息：「${lastUser.content}」。我會記得先前的脈絡：${context}`;
};

const injectSummaryIfNeeded = async (
  chatId: number,
  messages: MessageRecord[],
): Promise<{context: MessageRecord[]; summary?: MessageRecord}> => {
  const tokenSize = estimateTokenSize(messages);
  if (tokenSize <= TOKEN_LIMIT) {
    return {context: messages};
  }

  const historical = messages.slice(0, Math.max(0, messages.length - RECENT_MESSAGE_COUNT));
  const recent = messages.slice(-RECENT_MESSAGE_COUNT);
  const summaryContent = summarizeMessages(historical, {targetLength: 280});
  const summaryMessage: MessageRecord = {
    id: -1,
    chat_id: chatId,
    role: 'system',
    content: `以下為較早對話的摘要：\n${summaryContent}`,
    created_at: new Date().toISOString(),
  };
  return {
    context: [summaryMessage, ...recent],
    summary: summaryMessage,
  };
};

export const generateChat = async (
  chatId: number,
  userMessage: string,
  options?: GenerateChatOptions,
) => {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return;
  }

  await addMessage(chatId, 'user', trimmed);
  const messages = await getMessagesForChat(chatId);
  const {context} = await injectSummaryIfNeeded(chatId, messages);
  const responder = options?.responder ?? defaultResponder;
  const assistantReply = await responder(context);
  await addMessage(chatId, 'assistant', assistantReply);
};

export const buildContextForPreview = async (chatId: number) => {
  const messages = await getMessagesForChat(chatId);
  const {context} = await injectSummaryIfNeeded(chatId, messages);
  return context;
};

export const summarizeChatToDate = async (chatId: number) => {
  const messages = await getMessagesForChat(chatId);
  const summary = summarizeMessages(messages, {targetLength: 280});
  const storedSummary = await addMessage(chatId, 'summary', summary);
  await updateChatTimestamp(chatId);
  return storedSummary;
};

