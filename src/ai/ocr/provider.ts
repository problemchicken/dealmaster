import stubProvider from './stubProvider';

export type OcrResult = {
  text: string;
  meta?: Record<string, any>;
};

export interface OcrProvider {
  extractTextFromImage(localUri: string): Promise<OcrResult>;
}

let provider: OcrProvider = stubProvider;

export const setOcrProvider = (next: OcrProvider) => {
  provider = next;
};

export const getOcrProvider = (): OcrProvider => provider;
