declare const __DEV__: boolean;

import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import type {NativeModule} from 'react-native';
import {
  normalizeTelemetryErrorCode,
  trackSttEvent,
} from './telemetry';
import type {
  BaseTelemetryProps,
  SttTelemetryPayloadFor,
} from '../types/telemetry';

export type SpeechPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

type TranscriptionEvent = {
  text: string;
  isFinal: boolean;
  duration?: number;
};

type ErrorEvent = {
  message?: string;
  error_code: string;
};

type PermissionDeniedEvent = {
  error_code: 'permission_denied';
};

export type SpeechEventPayloadMap = {
  stt_partial: TranscriptionEvent;
  stt_final: TranscriptionEvent;
  stt_error: ErrorEvent;
  stt_permission_denied: PermissionDeniedEvent;
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

const STT_PROVIDER: BaseTelemetryProps['provider'] = 'native';

const getTelemetryPlatform = (): BaseTelemetryProps['platform'] =>
  Platform.OS === 'android' ? 'android' : 'ios';

const basePayload = (): BaseTelemetryProps => ({
  platform: getTelemetryPlatform(),
  provider: STT_PROVIDER,
});

const resolveTextLength = ({text}: TranscriptionEvent): number => text.length;

let partialSequenceId = 0;

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
  switch (event) {
    case 'stt_partial': {
      partialSequenceId += 1;
      const data = payload as TranscriptionEvent;
      const telemetry: SttTelemetryPayloadFor<'stt_partial'> = {
        ...basePayload(),
        sequence_id: partialSequenceId,
        text_length: resolveTextLength(data),
        partial_transcript: data.text,
      };
      trackSttEvent('stt_partial', telemetry);
      return;
    }
    case 'stt_final': {
      const data = payload as TranscriptionEvent;
      const telemetry: SttTelemetryPayloadFor<'stt_final'> = {
        ...basePayload(),
        text_length: resolveTextLength(data),
        transcript: data.text,
      };
      const durationMs = toMilliseconds(data.duration);
      if (typeof durationMs === 'number') {
        telemetry.duration_ms = durationMs;
      }
      trackSttEvent('stt_final', telemetry);
      return;
    }
    case 'stt_error': {
      const errorPayload = payload as ErrorEvent;
      const telemetry: SttTelemetryPayloadFor<'stt_error'> = {
        ...basePayload(),
        error_code: normalizeTelemetryErrorCode(errorPayload.error_code),
        native_flag: true,
      };
      if (typeof errorPayload.message === 'string') {
        telemetry.message = errorPayload.message;
      }
      trackSttEvent('stt_error', telemetry);
      return;
    }
    case 'stt_permission_denied': {
      const telemetry: SttTelemetryPayloadFor<'stt_permission_denied'> = {
        ...basePayload(),
        error_code: 'permission_denied',
        native_flag: true,
      };
      trackSttEvent('stt_permission_denied', telemetry);
      return;
    }
    default:
      trackSttEvent(event, basePayload() as SttTelemetryPayloadFor<E>);
  }
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
    handleNativeEvent('stt_permission_denied', payload as PermissionDeniedEvent);
  });
}

const ensureNativeModule = (): SpeechNativeModule => {
  if (!nativeModule) {
    trackSttEvent('stt_error', {
      ...basePayload(),
      message: 'Speech native module is unavailable.',
      error_code: 'native_module_unavailable',
      native_flag: false,
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
  partialSequenceId = 0;
  trackSttEvent('stt_open', {
    ...basePayload(),
    native_flag: isSpeechModuleAvailable(),
  });
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
  const payload: SttTelemetryPayloadFor<'stt_send'> = {
    ...basePayload(),
    text_length: trimmed.length,
    transcript: trimmed,
  };
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
      error_code: 'transient_native_failure',
      native_flag: true,
    });
    return 'unavailable';
  }
};
