import type {OcrProvider} from './provider';

type MlKitModule = {
  recognize: (uri: string) => Promise<unknown>;
};

const loadMlKitModule = async (): Promise<MlKitModule | null> => {
  try {
    const mlkitModule = await Promise.resolve().then(() => require('expo-mlkit-ocr'));
    if (mlkitModule && typeof mlkitModule.recognize === 'function') {
      return mlkitModule as MlKitModule;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[OCR][Android] Native ML Kit module unavailable.', error);
    }
  }

  return null;
};

export const createAndroidProvider = (): OcrProvider => ({
  async extractText(uri: string): Promise<string> {
    try {
      const module = await loadMlKitModule();
      if (!module) {
        return '';
      }

      // TODO: Hook up ML Kit text recognition when the native module is available.
      const result = await module.recognize(uri);
      if (
        result &&
        typeof result === 'object' &&
        'text' in result &&
        typeof (result as {text?: unknown}).text === 'string'
      ) {
        return (result as {text: string}).text;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[OCR][Android] Failed to extract text.', error);
      }
    }

    return '';
  },
});
