import {getEnvVar} from '../utils/env';
import {
  ChatCompletionChunk,
  ChatCompletionChunkChoice,
  ChatMessage,
} from './types';

export interface GenerateChatOptions {
  messages: ChatMessage[];
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export interface GenerateChatResult {
  message: ChatMessage;
}

const GPT_MODEL = 'gpt-5';
const API_URL = 'https://api.openai.com/v1/chat/completions';

const readApiKey = (): string | undefined =>
  getEnvVar('GPT5_API_KEY') ?? getEnvVar('OPENAI_API_KEY');

type GlobalWithTextDecoder = typeof globalThis & {
  TextDecoder?: typeof TextDecoder;
};

type DecoderInput =
  | ArrayBuffer
  | ArrayBufferView
  | SharedArrayBuffer
  | null
  | undefined;

interface Utf8TextDecoder {
  decode(input?: DecoderInput, options?: {stream?: boolean}): string;
}

let decoderPromise: Promise<Utf8TextDecoder> | null = null;

const getTextDecoder = async (): Promise<Utf8TextDecoder> => {
  if (!decoderPromise) {
    decoderPromise = (async () => {
      const GlobalTextDecoder = (globalThis as GlobalWithTextDecoder).TextDecoder;
      if (GlobalTextDecoder) {
        return new GlobalTextDecoder('utf-8');
      }

      const {TextDecoder: NodeTextDecoder} = await import('util');
      return new NodeTextDecoder('utf-8');
    })();
  }

  return decoderPromise;
};

const isReadableStream = (body: Response['body']): body is ReadableStream =>
  Boolean(body && typeof body.getReader === 'function');

const extractMessageContent = (
  choice: ChatCompletionChunkChoice | undefined,
): string | undefined => {
  if (!choice) {
    return undefined;
  }

  if (typeof choice.delta?.content === 'string') {
    return choice.delta.content;
  }

  if (typeof choice.message?.content === 'string') {
    return choice.message.content;
  }

  return undefined;
};

const emitDelta = (
  chunk: string,
  onToken: ((token: string) => void) | undefined,
  buffer: {text: string},
) => {
  const lines = chunk.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) {
      continue;
    }
    const data = trimmed.replace(/^data:\s*/, '');
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(data) as ChatCompletionChunk;
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        buffer.text += delta;
        onToken?.(delta);
      }
    } catch (error) {
      // Ignore malformed JSON chunks and continue streaming.
    }
  }
};

const parseCompleteResponse = async (response: Response): Promise<ChatMessage> => {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as ChatCompletionChunk;
    const content = extractMessageContent(json.choices?.[0]) ?? '';
    return {role: 'assistant', content};
  } catch (error) {
    return {role: 'assistant', content: text};
  }
};

export const generateChat = async ({
  messages,
  signal,
  onToken,
}: GenerateChatOptions): Promise<GenerateChatResult> => {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error('Missing GPT API key');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GPT_MODEL,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  const buffer = {text: ''};

  const body = response.body;

  if (isReadableStream(body)) {
    const reader = body.getReader();
    const textDecoder = await getTextDecoder();

    while (true) {
      const {value, done} = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      const chunk = textDecoder.decode(value, {stream: true});
      emitDelta(chunk, onToken, buffer);
    }

    return {message: {role: 'assistant', content: buffer.text}};
  }

  const message = await parseCompleteResponse(response);
  if (message.content.length > 0) {
    onToken?.(message.content);
  }
  return {message};
};
