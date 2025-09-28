import {AUTO_SUMMARY_PREFIX} from '../constants/chat';
import {addMessage, getMessagesForChat, upsertSummaryMessage} from '../storage/chatRepository';
import {MessageRecord} from '../storage/types';
import {estimateTokenSize, summarizeMessages} from './summarizer';
import {streamChatCompletion} from './gptStream';

const TOKEN_LIMIT = 1800;
const RECENT_MESSAGE_COUNT = 8;

export {AUTO_SUMMARY_PREFIX};

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
  const existingSummary = [...messages].reverse().find(message => message.role === 'summary');
  const nonSummaryMessages = messages.filter(message => message.role !== 'summary');
  const baseMessages = existingSummary
    ? [existingSummary, ...nonSummaryMessages]
    : nonSummaryMessages;
  const tokenSize = estimateTokenSize(baseMessages);
  if (tokenSize <= TOKEN_LIMIT) {
    return {context: baseMessages, summary: existingSummary};
  }

  const historical = nonSummaryMessages.slice(
    0,
    Math.max(0, nonSummaryMessages.length - RECENT_MESSAGE_COUNT),
  );
  const recent = nonSummaryMessages.slice(-RECENT_MESSAGE_COUNT);
  const summaryContent = summarizeMessages(historical, {targetLength: 280});
  const storedSummary = await upsertSummaryMessage(
    chatId,
    `${AUTO_SUMMARY_PREFIX}\n${summaryContent}`,
  );
  return {
    context: [storedSummary, ...recent],
    summary: storedSummary,
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
  const meaningfulMessages = messages.filter(message => message.role !== 'summary');
  const summary = summarizeMessages(meaningfulMessages, {targetLength: 280});
  const storedSummary = await upsertSummaryMessage(chatId, summary, {force: true});
  return storedSummary;
};

