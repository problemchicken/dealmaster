import type {OcrProvider, OcrResult} from './provider';

let overrideText: string | null = null;

try {
  if (typeof process !== 'undefined' && process.env && typeof process.env.OCR_STUB_TEXT === 'string') {
    overrideText = process.env.OCR_STUB_TEXT;
  }
} catch (err) {
  // Accessing process.env can throw in some environments; ignore.
}

export const setStubText = (value: string | null) => {
  overrideText = value;
};

const getStubText = (): {text: string; source: 'override' | 'global' | 'default'} => {
  if (overrideText != null) {
    return {text: overrideText, source: 'override'};
  }

  if (typeof globalThis !== 'undefined') {
    const injected = (globalThis as Record<string, unknown>).__OCR_STUB_TEXT__;
    if (typeof injected === 'string') {
      return {text: injected, source: 'global'};
    }
  }

  return {text: '', source: 'default'};
};

const stubProvider: OcrProvider = {
  async extractTextFromImage(localUri: string): Promise<OcrResult> {
    const {text, source} = getStubText();
    return {
      text,
      meta: {
        provider: 'stub',
        uri: localUri,
        override: source !== 'default',
        source,
      },
    };
  },
};

export default stubProvider;
