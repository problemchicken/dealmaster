import {TextDecoder} from 'util';
import {AUTO_SUMMARY_PREFIX} from '../constants/chat';
import {MessageRecord} from '../storage/types';

const CHAT_COMPLETIONS_URL =
  typeof process !== 'undefined' && process.env?.CHAT_COMPLETIONS_URL
    ? process.env.CHAT_COMPLETIONS_URL
    : '';

const CHAT_COMPLETIONS_TOKEN =
  typeof process !== 'undefined' && process.env?.CHAT_COMPLETIONS_TOKEN
    ? process.env.CHAT_COMPLETIONS_TOKEN
    : undefined;

type StreamChunkChoice = {
  delta?: {
    content?: string;
    role?: 'assistant' | 'user' | 'system';
  };
  finish_reason?: string | null;
};

type StreamChunk = {
  choices?: StreamChunkChoice[];
};

type StreamInput = {
  messages: MessageRecord[];
  onToken?: (token: string) => void;
};

const toChatMessagePayload = (message: MessageRecord) => {
  if (message.role === 'summary') {
    const trimmed = message.content.startsWith(AUTO_SUMMARY_PREFIX)
      ? message.content.slice(AUTO_SUMMARY_PREFIX.length).trimStart()
      : message.content;
    return {
      role: 'system' as const,
      content: `Conversation summary so far:\n${trimmed}`,
    };
  }
  if (message.role === 'system') {
    return {
      role: 'system' as const,
      content: message.content,
    };
  }
  if (message.role === 'assistant') {
    return {
      role: 'assistant' as const,
      content: message.content,
    };
  }
  return {
    role: 'user' as const,
    content: message.content,
  };
};

const isStreamingConfigured = () => CHAT_COMPLETIONS_URL.length > 0;

const readStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onToken?: (token: string) => void,
) => {
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let finished = false;
  let buffer = '';

  while (!finished) {
    const {done, value} = await reader.read();
    if (done) {
      finished = true;
    }
    if (!value) {
      continue;
    }
    buffer += decoder.decode(value, {stream: true});
    const segments = buffer.split('\n');
    buffer = segments.pop() ?? '';

    for (const rawLine of segments) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        reader.releaseLock();
        return fullText;
      }
      try {
        const parsed = JSON.parse(payload) as StreamChunk;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onToken?.(delta);
        }
      } catch (error) {
        // ignore malformed chunks but preserve accumulated text
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing.startsWith('data:')) {
    const payload = trailing.slice(5).trim();
    if (payload === '[DONE]') {
      reader.releaseLock();
      return fullText;
    }
    try {
      const parsed = JSON.parse(payload) as StreamChunk;
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onToken?.(delta);
      }
    } catch (error) {
      // ignore malformed trailing payload
    }
  }

  reader.releaseLock();
  return fullText;
};

export const streamChatCompletion = async ({messages, onToken}: StreamInput) => {
  if (!isStreamingConfigured()) {
    throw new Error('Chat completions endpoint is not configured');
  }

  const payload = {
    model: 'gpt-5.0-mini',
    stream: true,
    messages: messages.map(toChatMessagePayload),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (CHAT_COMPLETIONS_TOKEN) {
    headers.Authorization = `Bearer ${CHAT_COMPLETIONS_TOKEN}`;
  }

  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to fetch chat completion (${response.status}): ${errorBody}`,
    );
  }

  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    const fallback = await response.text();
    try {
      const parsed = JSON.parse(fallback) as {choices?: {message?: {content?: string}}[]};
      const content = parsed.choices?.[0]?.message?.content ?? '';
      if (content) {
        onToken?.(content);
      }
      return content;
    } catch (error) {
      return fallback;
    }
  }

  const reader = body.getReader();
  return readStream(reader, onToken);
};

export type ChatMessage = ReturnType<typeof toChatMessagePayload>;
