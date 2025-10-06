import type {
  OcrExtractEmptyTelemetryPayload,
  OcrExtractOkTelemetryPayload,
  OcrNativeFallbackTelemetryPayload,
  OcrOpenTelemetryPayload,
  OcrQuotaBlockedTelemetryPayload,
  SpeechPipelineCompleteTelemetryPayload,
  SttErrorTelemetryPayload,
  SttFinalTelemetryPayload,
  SttOpenTelemetryPayload,
  SttPartialTelemetryPayload,
  SttPermissionDeniedTelemetryPayload,
  SttSendTelemetryPayload,
} from '../../src/types/telemetry';

export const sttOpenExamples: SttOpenTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'native',
    locale: 'en-US',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'native',
    locale: 'zh-TW',
    native_flag: true,
  },
  {
    platform: 'ios',
    provider: 'whisper',
    locale: 'ja-JP',
  },
];

export const sttPartialExamples: SttPartialTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'native',
    sequence_id: 1,
    text_length: 6,
    partial_transcript: 'hello',
  },
  {
    platform: 'android',
    provider: 'native',
    sequence_id: 2,
    text_length: 14,
    partial_transcript: '需要更多資料',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    sequence_id: 3,
    text_length: 9,
    partial_transcript: '注文は',
  },
];

export const sttFinalExamples: SttFinalTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'native',
    duration_ms: 1850,
    text_length: 24,
    transcript: 'Hello, I would like to order coffee.',
  },
  {
    platform: 'android',
    provider: 'native',
    duration_ms: 2200,
    text_length: 12,
    transcript: '需要更多資料',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    duration_ms: 3100,
    text_length: 18,
    transcript: '注文はコーヒーです',
  },
];

export const sttErrorExamples: SttErrorTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'native',
    error_code: 'network_failure',
    message: 'SFSpeechRecognizerErrorCode.network',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'native',
    error_code: 'timeout',
    message: 'RecognizerTimeoutError',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    error_code: 'no_speech_detected',
  },
];

export const sttPermissionDeniedExamples: SttPermissionDeniedTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'native',
    error_code: 'permission_denied',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'native',
    error_code: 'permission_denied',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    error_code: 'permission_denied',
  },
];

export const sttSendExamples: SttSendTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'native',
    duration_ms: 2100,
    text_length: 24,
    transcript: 'Hello, I would like to order coffee.',
  },
  {
    platform: 'android',
    provider: 'native',
    duration_ms: 2350,
    text_length: 12,
    transcript: '需要更多資料',
  },
  {
    platform: 'ios',
    provider: 'whisper',
    duration_ms: 3200,
    text_length: 18,
    transcript: '注文はコーヒーです',
  },
];

export const speechPipelineCompleteExamples: SpeechPipelineCompleteTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'speech_pipeline',
    total_duration_ms: 1250,
    endpoint_latency_ms: 900,
    error_rate: 0,
    transcript_length: 42,
  },
  {
    platform: 'ios',
    provider: 'speech_pipeline',
    total_duration_ms: 980,
    endpoint_latency_ms: 780,
    error_rate: 1,
    error_code: 'network_failure',
    error_message: 'ECONNRESET',
  },
];

export const ocrOpenExamples: OcrOpenTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
  },
];

export const ocrExtractOkExamples: OcrExtractOkTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    duration_ms: 180,
    text_length: 54,
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
    duration_ms: 240,
    text_length: 36,
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    duration_ms: 420,
    text_length: 28,
  },
];

export const ocrExtractEmptyExamples: OcrExtractEmptyTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    duration_ms: 160,
    text_length: 0,
    error_code: 'no_text_detected',
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
    duration_ms: 210,
    text_length: 0,
    error_code: 'no_text_detected',
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    duration_ms: 400,
    text_length: 0,
    error_code: 'native_module_unavailable',
  },
];

export const ocrQuotaBlockedExamples: OcrQuotaBlockedTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    error_code: 'quota_exhausted',
  },
  {
    platform: 'android',
    provider: 'mlkit',
    error_code: 'quota_exhausted',
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    error_code: 'quota_exhausted',
  },
];

export const ocrNativeFallbackExamples: OcrNativeFallbackTelemetryPayload[] = [
  {
    platform: 'ios',
    provider: 'visionKit',
    native_flag: true,
    duration_ms: 300,
    error_code: 'timeout',
  },
  {
    platform: 'android',
    provider: 'mlkit',
    native_flag: true,
    duration_ms: 360,
    error_code: 'transient_native_failure',
  },
  {
    platform: 'ios',
    provider: 'stub',
    native_flag: false,
    duration_ms: 500,
    error_code: 'native_module_unavailable',
  },
];
