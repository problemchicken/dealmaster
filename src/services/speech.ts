declare const __DEV__: boolean;

import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import type {NativeModule} from 'react-native';
import {trackSttEvent} from './telemetry';
import type {SttTelemetryPayload} from '../types/telemetry';

export type SpeechPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

type TranscriptionEvent = {
  text: string;
  isFinal: boolean;
  duration: number;
  chars: number;
};

type ErrorEvent = {
  message?: string;
  error_code?: string;
};

export type SpeechEventPayloadMap = {
  stt_partial: TranscriptionEvent;
  stt_final: TranscriptionEvent;
  stt_error: ErrorEvent;
  stt_permission_denied: Record<string, never>;
};

export type SpeechEventName = keyof SpeechEventPayloadMap;

export type SpeechEventListener<E extends SpeechEventName> = (
  payload: SpeechEventPayloadMap[E],
) => void;

type SpeechNativeModule = NativeModule & {
  startTranscribing: () => Promise<boolean>;
  stopTranscribing: () => Promise<string>;
  cancelTranscribing: () => Promise<string>;
  getPermissionStatus: () => Promise<SpeechPermissionStatus>;
  requestPermission: () => Promise<SpeechPermissionStatus>;
};

const nativeModule: SpeechNativeModule | null =
  (NativeModules.SpeechModule as SpeechNativeModule | undefined) ?? null;

const eventEmitter = nativeModule
  ? new NativeEventEmitter(nativeModule)
  : null;

const listeners: {
  [K in SpeechEventName]: Set<SpeechEventListener<K>>;
} = {
  stt_partial: new Set(),
  stt_final: new Set(),
  stt_error: new Set(),
  stt_permission_denied: new Set(),
};

const basePayload = (): SttTelemetryPayload => ({
  platform: Platform.OS,
});

const toMilliseconds = (durationInSeconds?: number): number | undefined => {
  if (typeof durationInSeconds !== 'number') {
    return undefined;
  }
  return Math.round(durationInSeconds * 1000);
};

const emitTelemetry = <E extends SpeechEventName>(
  event: E,
  payload: SpeechEventPayloadMap[E],
): void => {
  const telemetry: SttTelemetryPayload = basePayload();

  if (event === 'stt_partial' || event === 'stt_final') {
    const data = payload as TranscriptionEvent;
    const durationMs = toMilliseconds(data.duration);
    if (typeof data.chars === 'number') {
      telemetry.chars = data.chars;
    }
    if (typeof durationMs === 'number') {
      telemetry.duration_ms = durationMs;
    }
  }

  if (event === 'stt_error') {
    const errorPayload = payload as ErrorEvent;
    if (typeof errorPayload.error_code === 'string') {
      telemetry.error_code = errorPayload.error_code;
    }
    if (typeof errorPayload.message === 'string') {
      telemetry.message = errorPayload.message;
    }
  }

  trackSttEvent(event, telemetry);
};

const notifyListeners = <E extends SpeechEventName>(
  event: E,
  payload: SpeechEventPayloadMap[E],
): void => {
  listeners[event].forEach(listener => {
    try {
      listener(payload);
    } catch (error) {
      if (__DEV__) {
        console.warn('Speech listener failed', error);
      }
    }
  });
};

const handleNativeEvent = <E extends SpeechEventName>(
  event: E,
  payload: SpeechEventPayloadMap[E],
): void => {
  emitTelemetry(event, payload);
  notifyListeners(event, payload);
};

if (eventEmitter && nativeModule) {
  eventEmitter.addListener('stt_partial', payload => {
    handleNativeEvent('stt_partial', payload as TranscriptionEvent);
  });

  eventEmitter.addListener('stt_final', payload => {
    handleNativeEvent('stt_final', payload as TranscriptionEvent);
  });

  eventEmitter.addListener('stt_error', payload => {
    handleNativeEvent('stt_error', payload as ErrorEvent);
  });

  eventEmitter.addListener('stt_permission_denied', payload => {
    handleNativeEvent('stt_permission_denied', payload as Record<string, never>);
  });
}

const ensureNativeModule = (): SpeechNativeModule => {
  if (!nativeModule) {
    trackSttEvent('stt_error', {
      ...basePayload(),
      message: 'Speech native module is unavailable.',
      error_code: 'module_unavailable',
    });
    throw new Error('Speech native module is unavailable.');
  }
  return nativeModule;
};

export const addSpeechListener = <E extends SpeechEventName>(
  event: E,
  listener: SpeechEventListener<E>,
): (() => void) => {
  const set = listeners[event] as Set<SpeechEventListener<E>>;
  set.add(listener);
  return () => {
    set.delete(listener);
  };
};

export const removeAllSpeechListeners = (): void => {
  (Object.keys(listeners) as SpeechEventName[]).forEach(event => {
    listeners[event].clear();
  });
};

export const isSpeechModuleAvailable = (): boolean => nativeModule != null;

export const open = async (): Promise<boolean> => {
  trackSttEvent('stt_open', basePayload());
  const module = ensureNativeModule();
  return module.startTranscribing();
};

export const stop = async (): Promise<string> => {
  const module = ensureNativeModule();
  return module.stopTranscribing();
};

export const cancel = async (): Promise<string> => {
  const module = ensureNativeModule();
  return module.cancelTranscribing();
};

export const send = async (text: string): Promise<void> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  const payload: SttTelemetryPayload = basePayload();
  payload.chars = trimmed.length;
  trackSttEvent('stt_send', payload);
};

export const getPermissionStatus = async (): Promise<SpeechPermissionStatus> => {
  if (!nativeModule) {
    return 'unavailable';
  }
  try {
    return await nativeModule.getPermissionStatus();
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to query speech permission status', error);
    }
    return 'unavailable';
  }
};

export const requestPermission = async (): Promise<SpeechPermissionStatus> => {
  if (!nativeModule) {
    return 'unavailable';
  }
  try {
    const status = await nativeModule.requestPermission();
    return status;
  } catch (error) {
    trackSttEvent('stt_error', {
      ...basePayload(),
      message: error instanceof Error ? error.message : String(error),
      error_code: 'permission_request_failed',
    });
    return 'unavailable';
  }
};
