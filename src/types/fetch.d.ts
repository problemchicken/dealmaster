interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface Response {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  body?: ReadableStream<Uint8Array> | null;
}

declare function fetch(input: string, init?: RequestInit): Promise<Response>;
