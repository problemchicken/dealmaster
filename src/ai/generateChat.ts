import {useAiSettingsStore} from '../store/useAiSettingsStore';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type AbortSignalLike = {
  readonly aborted: boolean;
};

export type GenerateChatOptions = {
  model: string;
  stream?: boolean;
  temperature?: number;
  signal?: AbortSignalLike | null;
  onToken?: (token: string) => void;
};

export type GenerateChatResult = {
  message: ChatMessage;
  finishReason: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

type ProviderResponse = {
  choices: Array<{
    message?: ChatMessage;
    finish_reason?: string | null;
    delta?: Partial<ChatMessage> & {content?: string};
  }>;
  usage?: GenerateChatResult['usage'];
};

const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_TEMPERATURE = 0.3;
const MAX_ATTEMPTS = 2;

const GPT5_BASE_URL = process.env.GPT5_API_URL ?? 'https://api.openai.com/v1';
const GPT5_API_KEY_ENV = process.env.GPT5_API_KEY;

type NormalizedError = {
  message: string;
  code: string;
  status?: number;
  retryable: boolean;
};

class GPT5Provider {
  constructor(private readonly apiKey: string) {}

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async generate(messages: ChatMessage[], options: GenerateChatOptions): Promise<GenerateChatResult> {
    const payload = {
      model: options.model ?? DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      stream: options.stream ?? false,
    };

    const response = await fetch(`${GPT5_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
      signal: options.signal ?? undefined,
    });

    if (!response.ok) {
      const errorPayload = await safeJson(response);
      const errorCode =
        (errorPayload as {error?: {code?: string}})?.error?.code ?? `${response.status}`;
      throw createError(
        response.status,
        errorCode,
        (errorPayload as {error?: {message?: string}})?.error?.message,
      );
    }

    if (payload.stream) {
      return this.handleStream(response, options.onToken);
    }

    const data = (await response.json()) as ProviderResponse;
    const firstChoice = data.choices?.[0];
    const message = firstChoice?.message ?? {role: 'assistant', content: ''};

    return {
      message,
      finishReason: firstChoice?.finish_reason ?? null,
      usage: data.usage,
    };
  }

  private async handleStream(
    response: Response,
    onToken?: (token: string) => void,
  ): Promise<GenerateChatResult> {
    const reader = (response.body as unknown as {getReader?: () => any} | null)?.getReader?.();
    const decoder = new TextDecoder('utf-8');
    let aggregated = '';
    let finishReason: string | null = null;
    let usage: GenerateChatResult['usage'];

    if (!reader) {
      const fallback = (await response.json()) as ProviderResponse;
      const firstChoice = fallback.choices?.[0];
      const message = firstChoice?.message ?? {role: 'assistant', content: ''};

      return {
        message,
        finishReason: firstChoice?.finish_reason ?? null,
        usage: fallback.usage,
      };
    }

    for (;;) {
      const {value, done} = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, {stream: true});
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }

        const jsonString = trimmed.replace(/^data:\s*/, '');
        if (jsonString === '[DONE]') {
          reader.releaseLock();
          return {
            message: {role: 'assistant', content: aggregated},
            finishReason,
            usage,
          };
        }

        try {
          const parsed = JSON.parse(jsonString) as ProviderResponse;
          const choice = parsed.choices?.[0];
          const token = choice?.delta?.content;
          if (token) {
            aggregated += token;
            onToken?.(token);
          }

          if (choice?.finish_reason) {
            finishReason = choice.finish_reason;
          }

          if (parsed.usage) {
            usage = parsed.usage;
          }
        } catch (error) {
          console.warn('[AI] Failed to parse streaming chunk', error);
        }
      }
    }

    return {
      message: {role: 'assistant', content: aggregated},
      finishReason,
      usage,
    };
  }
}

const friendlyMessages: Record<number, string> = {
  401: 'The GPT-5 API key is invalid. Please update it in Settings.',
  408: 'The GPT-5 service timed out. Please try again in a moment.',
  429: 'You have hit the GPT-5 quota. Try again later or review your plan.',
  500: 'GPT-5 had a temporary issue. Please retry shortly.',
  502: 'GPT-5 is temporarily unavailable. Please retry shortly.',
  503: 'GPT-5 is temporarily unavailable. Please retry shortly.',
  504: 'The GPT-5 service timed out. Please try again in a moment.',
};

function createError(status: number, code: string, detail?: string): Error {
  const message = friendlyMessages[status] ?? detail ?? 'Unable to reach GPT-5 right now. Please retry later.';
  const error = new Error(message) as Error & {code?: string; status?: number};
  error.code = code;
  error.status = status;
  return error;
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    const status = (error as Error & {status?: number}).status;
    const code = (error as Error & {code?: string}).code ?? error.name ?? 'unknown_error';
    const message = error.message || 'Unable to reach GPT-5 right now. Please retry later.';
    const retryable = status
      ? status >= 500 || status === 408
      : true;
    return {
      message,
      code: `${code}`,
      status,
      retryable,
    };
  }

  return {
    message: 'Unable to reach GPT-5 right now. Please retry later.',
    code: 'unknown_error',
    retryable: true,
  };
}

function resolveApiKey(): string {
  const storedKey = useAiSettingsStore.getState().apiKey;
  const apiKey = storedKey || GPT5_API_KEY_ENV;
  if (!apiKey) {
    throw new Error('A GPT-5 API key is required. Please set it in Settings.');
  }
  return apiKey;
}

export async function generateChat(
  messages: ChatMessage[],
  options: GenerateChatOptions,
): Promise<GenerateChatResult> {
  const apiKey = resolveApiKey();
  const provider = new GPT5Provider(apiKey);
  const attempts = MAX_ATTEMPTS;
  const start = Date.now();
  let attempt = 0;
  let lastError: NormalizedError | null = null;

  while (attempt < attempts) {
    attempt += 1;
    try {
      const result = await provider.generate(messages, options);
      console.log('[AI] generateChat success', {durationMs: Date.now() - start});
      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      lastError = normalized;
      console.error('[AI] generateChat error', {
        durationMs: Date.now() - start,
        code: normalized.code,
        status: normalized.status,
        attempt,
      });

      if (!normalized.retryable || attempt >= attempts) {
        throw new Error(normalized.message);
      }
    }
  }

  throw new Error(lastError?.message ?? 'Unable to reach GPT-5 right now. Please retry later.');
}
