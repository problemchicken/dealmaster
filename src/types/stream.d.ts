type ReadableStreamReadResult<T> =
  | {done: true; value?: undefined}
  | {done: false; value: T};

declare class ReadableStreamDefaultReader<T = Uint8Array> {
  read(): Promise<ReadableStreamReadResult<T>>;
  releaseLock(): void;
}

declare class ReadableStream<T = Uint8Array> {
  getReader(): ReadableStreamDefaultReader<T>;
}
