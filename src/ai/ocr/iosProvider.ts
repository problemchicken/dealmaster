import type {OcrProvider} from './provider';

type VisionKitModule = {
  recognizeTextFromImage: (uri: string) => Promise<unknown>;
};

const loadVisionKitModule = async (): Promise<VisionKitModule | null> => {
  try {
    const visionKitModule = await Promise.resolve().then(() => require('expo-mlkit-ocr'));
    if (visionKitModule && typeof visionKitModule.recognizeTextFromImage === 'function') {
      return visionKitModule as VisionKitModule;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[OCR][iOS] Native VisionKit module unavailable.', error);
    }
  }

  return null;
};

export const createIosProvider = (): OcrProvider => ({
  async extractText(uri: string): Promise<string> {
    try {
      const module = await loadVisionKitModule();
      if (!module) {
        return '';
      }

      // TODO: Wire up actual VisionKit OCR integration when the native module is available.
      const result = await module.recognizeTextFromImage(uri);
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
        console.debug('[OCR][iOS] Failed to extract text.', error);
      }
    }

    return '';
  },
});
