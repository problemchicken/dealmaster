import {
  addMessage,
  getMessagesForChat,
  updateChatTimestamp,
} from '../storage/chatRepository';
import {MessageRecord} from '../storage/types';
import {estimateTokenSize, summarizeMessages} from './summarizer';
import {streamChatCompletion} from './gptStream';

const TOKEN_LIMIT = 1800;
const RECENT_MESSAGE_COUNT = 8;

export type GenerateChatOptions = {
  responder?: ChatResponder;
  onToken?: (token: string) => void;
  onUserMessage?: (message: MessageRecord) => void;
  onAssistantMessage?: (message: MessageRecord) => void;
};

type ChatResponder = (input: {
  messages: MessageRecord[];
  onToken?: (token: string) => void;
}) => Promise<string>;

const defaultResponder: ChatResponder = async input => {
  return streamChatCompletion(input);
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
    role: 'summary',
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

  const storedUser = await addMessage(chatId, 'user', trimmed);
  options?.onUserMessage?.(storedUser);
  const messages = await getMessagesForChat(chatId);
  const {context} = await injectSummaryIfNeeded(chatId, messages);
  const responder = options?.responder ?? defaultResponder;
  const assistantReply = await responder({
    messages: context,
    onToken: options?.onToken,
  });
  const storedAssistant = await addMessage(chatId, 'assistant', assistantReply);
  options?.onAssistantMessage?.(storedAssistant);
  return {user: storedUser, assistant: storedAssistant};
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

