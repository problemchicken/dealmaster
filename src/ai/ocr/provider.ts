export type OcrResult = {
  text: string;
  meta?: Record<string, any>;
};

export interface OcrProvider {
  extractTextFromImage(localUri: string): Promise<OcrResult>;
}
