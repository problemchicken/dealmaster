import type {
  NormalizedErrorCode,
  SttTelemetryEvent,
  SttTelemetryPayloadFor,
  SpeechPipelineTelemetryEvent,
  SpeechPipelineTelemetryPayloadFor,
} from '../types/telemetry';

declare const __DEV__: boolean;

export type TelemetryPayload = object | undefined;

export const track = (event: string, payload?: TelemetryPayload): void => {
  try {
    // In production this can be replaced with a real analytics sink.
    console.log(`[telemetry] ${event}`, payload ?? {});
  } catch (error) {
    // Swallow logging errors to avoid interrupting user flows.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Failed to emit telemetry event', error);
    }
  }
};

const FALLBACK_ERROR_CODE: NormalizedErrorCode = 'transient_native_failure';

const NORMALIZED_ERROR_CODE_MAP: Record<string, NormalizedErrorCode> = {
  permission_denied: 'permission_denied',
  denied: 'permission_denied',
  unauthorized: 'permission_denied',
  not_authorized: 'permission_denied',
  access_denied: 'permission_denied',
  insufficient_permissions: 'permission_denied',
  microphone_permission_denied: 'permission_denied',
  microphone_denied: 'permission_denied',
  speech_recognition_permission_denied: 'permission_denied',
  timeout: 'timeout',
  timed_out: 'timeout',
  speech_timeout: 'timeout',
  recognizer_timeout: 'timeout',
  operation_timed_out: 'timeout',
  canceled: 'timeout',
  cancelled: 'timeout',
  cancel: 'timeout',
  network_failure: 'network_failure',
  network: 'network_failure',
  network_error: 'network_failure',
  network_timeout: 'network_failure',
  connection_error: 'network_failure',
  connection_failure: 'network_failure',
  quota_exhausted: 'quota_exhausted',
  quota_exceeded: 'quota_exhausted',
  rate_limited: 'quota_exhausted',
  limit_reached: 'quota_exhausted',
  native_module_unavailable: 'native_module_unavailable',
  module_unavailable: 'native_module_unavailable',
  service_unavailable: 'native_module_unavailable',
  recognizer_unavailable: 'native_module_unavailable',
  unavailable: 'native_module_unavailable',
  not_available: 'native_module_unavailable',
  unsupported_locale: 'native_module_unavailable',
  no_speech_detected: 'no_speech_detected',
  no_speech: 'no_speech_detected',
  no_input: 'no_speech_detected',
  no_match: 'no_speech_detected',
  no_text_detected: 'no_text_detected',
  no_text: 'no_text_detected',
  empty_text: 'no_text_detected',
  empty_result: 'no_text_detected',
  transient_native_failure: 'transient_native_failure',
  temporary_failure: 'transient_native_failure',
  internal_error: 'transient_native_failure',
  error: 'transient_native_failure',
  server_error: 'transient_native_failure',
  permission_request_failed: 'transient_native_failure',
  '1': 'network_failure',
  '2': 'network_failure',
  '3': 'transient_native_failure',
  '4': 'transient_native_failure',
  '5': 'transient_native_failure',
  '6': 'timeout',
  '7': 'no_speech_detected',
  '8': 'transient_native_failure',
  '9': 'permission_denied',
};

const sanitizeErrorCode = (raw: string): string => {
  if (!raw) {
    return '';
  }

  let sanitized = raw
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  const prefixes = ['error_', 'err_', 'code_', 'stt_'];
  for (const prefix of prefixes) {
    if (sanitized.startsWith(prefix)) {
      sanitized = sanitized.slice(prefix.length);
      break;
    }
  }

  if (sanitized === '') {
    return raw.trim().toLowerCase();
  }

  return sanitized;
};

export const normalizeTelemetryErrorCode = (
  code: unknown,
): NormalizedErrorCode => {
  if (code == null) {
    return FALLBACK_ERROR_CODE;
  }

  const key = sanitizeErrorCode(String(code));
  if (!key) {
    return FALLBACK_ERROR_CODE;
  }

  return NORMALIZED_ERROR_CODE_MAP[key] ?? FALLBACK_ERROR_CODE;
};

export const trackSttEvent = <E extends SttTelemetryEvent>(
  event: E,
  payload: SttTelemetryPayloadFor<E>,
): void => {
  track(event, payload);
};

export const trackSpeechPipelineEvent = <E extends SpeechPipelineTelemetryEvent>(
  event: E,
  payload: SpeechPipelineTelemetryPayloadFor<E>,
): void => {
  track(event, payload);
};
