import {
  Alert,
  NativeEventEmitter,
  NativeModules,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import {track} from '../services/telemetry';
import type {SttTelemetryPayload} from '../types/telemetry';

type SpeechNativeModule = {
  startTranscribing(locale?: string): Promise<string | null | undefined>;
  stopTranscribing(): Promise<string | null | undefined>;
};

type NativeResultEvent = {
  type: 'result';
  text: string;
  isFinal: boolean;
  locale?: string;
  durationMs?: number;
};

type NativeErrorEvent = {
  type: 'error';
  errorCode?: string;
  message?: string;
};

type NativePermissionEvent = {
  type: 'permission_denied';
  message?: string;
};

type NativeEvent = NativeResultEvent | NativeErrorEvent | NativePermissionEvent;

export type SttResultEvent = NativeResultEvent & {
  locale?: string;
};

export type SttEvent =
  | (SttResultEvent & {type: 'result'})
  | (NativeErrorEvent & {type: 'error'})
  | (NativePermissionEvent & {type: 'permission_denied'});

type Listener = (event: SttEvent) => void;

type LocalePreference = 'zh-TW' | 'en-US';

const LINKING_ERROR =
  "The native SpeechModule is not available. Make sure you've run `expo prebuild -p ios` and rebuilt the app.";

const SpeechNative: SpeechNativeModule | undefined =
  NativeModules.SpeechModule as SpeechNativeModule | undefined;

const nativeEmitter =
  Platform.OS === 'ios' && SpeechNative
    ? new NativeEventEmitter(NativeModules.SpeechModule)
    : undefined;

let nativeSubscription: EmitterSubscription | null = null;
let aggregatedText = '';
let isListening = false;
let currentLocale: string | undefined;
let sessionStartTimestamp: number | null = null;
let lastFinalDuration: number | undefined;
let lastFinalText: string | null = null;
const listeners = new Set<Listener>();

const ensureNativeSubscription = () => {
  if (!nativeEmitter || nativeSubscription) {
    return;
  }

  nativeSubscription = nativeEmitter.addListener('stt.onResult', handleNativeEvent);
};

const handleNativeEvent = (event: NativeEvent) => {
  if (event.type === 'result') {
    aggregatedText = event.text ?? '';
    const locale = event.locale ?? currentLocale;
    const payload: SttEvent = {
      ...event,
      text: aggregatedText,
      locale,
    };

    if (event.isFinal) {
      isListening = false;
      lastFinalText = aggregatedText;
      lastFinalDuration = event.durationMs ?? (sessionStartTimestamp ? Date.now() - sessionStartTimestamp : undefined);
      sessionStartTimestamp = null;
      track(
        'stt_final',
        buildTelemetryPayload(locale, lastFinalDuration, aggregatedText.length),
      );
    } else {
      track(
        'stt_partial',
        buildTelemetryPayload(locale, undefined, aggregatedText.length),
      );
    }

    emitToListeners(payload);
    return;
  }

  if (event.type === 'permission_denied') {
    isListening = false;
    sessionStartTimestamp = null;
    track('stt_permission_denied', buildTelemetryPayload(currentLocale));
    emitToListeners(event);
    return;
  }

  if (event.type === 'error') {
    isListening = false;
    sessionStartTimestamp = null;
    track('stt_error', {
      ...buildTelemetryPayload(currentLocale),
      error_code: event.errorCode,
      message: event.message,
    });
    emitToListeners(event);
  }
};

const emitToListeners = (event: SttEvent) => {
  listeners.forEach(listener => {
    listener(event);
  });
};

const buildTelemetryPayload = (
  locale?: string,
  durationMs?: number,
  chars?: number,
): SttTelemetryPayload => ({
  platform: Platform.OS,
  locale,
  duration_ms: durationMs,
  chars,
});

const resolveDefaultLocale = (): LocalePreference => {
  if (Platform.OS === 'ios') {
    const settings = (NativeModules.SettingsManager?.settings ?? {}) as Record<string, unknown>;
    const appleLocale = settings.AppleLocale as string | undefined;
    const appleLanguages = settings.AppleLanguages as string[] | undefined;
    const locale = appleLocale ?? appleLanguages?.[0];
    if (locale && locale.toLowerCase().startsWith('zh')) {
      return 'zh-TW';
    }
  } else {
    const locale = (NativeModules.I18nManager?.localeIdentifier as string | undefined)?.toLowerCase();
    if (locale && locale.startsWith('zh')) {
      return 'zh-TW';
    }
  }
  return 'en-US';
};

export const androidTodoStart = () => {
  if (Platform.OS !== 'android') {
    return;
  }
  Alert.alert('語音輸入', 'Android 版本的語音輸入即將推出，敬請期待！');
  track('stt_open', buildTelemetryPayload(undefined));
};

export const androidTodoStop = () => {
  if (Platform.OS !== 'android') {
    return;
  }
  track('stt_final', buildTelemetryPayload(undefined));
};

export const addSttListener = (listener: Listener) => {
  listeners.add(listener);
  ensureNativeSubscription();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && nativeSubscription) {
      nativeSubscription.remove();
      nativeSubscription = null;
    }
  };
};

export const startTranscription = async (locale?: string) => {
  if (Platform.OS === 'android') {
    androidTodoStart();
    return null;
  }

  if (!SpeechNative) {
    throw new Error(LINKING_ERROR);
  }

  ensureNativeSubscription();

  const resolvedLocale = locale ?? resolveDefaultLocale();
  aggregatedText = '';
  isListening = true;
  lastFinalText = null;
  lastFinalDuration = undefined;
  currentLocale = resolvedLocale;
  sessionStartTimestamp = Date.now();

  track('stt_open', buildTelemetryPayload(resolvedLocale));
  const result = await SpeechNative.startTranscribing(resolvedLocale);
  if (result) {
    currentLocale = result;
  }
  return currentLocale ?? resolvedLocale;
};

export const stopTranscription = async () => {
  if (Platform.OS === 'android') {
    androidTodoStop();
    return '';
  }

  if (!SpeechNative) {
    throw new Error(LINKING_ERROR);
  }

  try {
    const finalText = await SpeechNative.stopTranscribing();
    if (isListening && lastFinalText === null) {
      const duration = sessionStartTimestamp ? Date.now() - sessionStartTimestamp : undefined;
      const text = typeof finalText === 'string' ? finalText : aggregatedText;
      track('stt_final', buildTelemetryPayload(currentLocale, duration, text.length));
      lastFinalDuration = duration;
      lastFinalText = text;
    }
    isListening = false;
    sessionStartTimestamp = null;
    if (typeof finalText === 'string') {
      lastFinalText = finalText;
      return finalText;
    }
    lastFinalText = aggregatedText;
    return aggregatedText;
  } catch (error) {
    isListening = false;
    sessionStartTimestamp = null;
    throw error;
  }
};

export const isTranscribing = () => isListening;

export const getLastFinalResult = () => {
  if (!lastFinalText) {
    return null;
  }
  return {
    text: lastFinalText,
    durationMs: lastFinalDuration,
    locale: currentLocale,
  };
};
