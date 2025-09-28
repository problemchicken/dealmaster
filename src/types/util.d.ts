declare module 'util' {
  class TextDecoder {
    constructor(label?: string, options?: {fatal?: boolean; ignoreBOM?: boolean});
    decode(input?: Uint8Array, options?: {stream?: boolean}): string;
  }
  export {TextDecoder};
}
