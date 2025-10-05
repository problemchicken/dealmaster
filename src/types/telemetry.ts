export type TelemetryPlatform = 'ios' | 'android';

export type TelemetryProvider = string;

export type NormalizedErrorCode =
  | 'permission_denied'
  | 'timeout'
  | 'network_failure'
  | 'quota_exhausted'
  | 'native_module_unavailable'
  | 'no_speech_detected'
  | 'no_text_detected'
  | 'transient_native_failure';

export interface BaseTelemetryProps {
  platform: TelemetryPlatform;
  provider: TelemetryProvider;
}

// STT events
export type SttTelemetryEvent =
  | 'stt_open'
  | 'stt_partial'
  | 'stt_final'
  | 'stt_error'
  | 'stt_permission_denied'
  | 'stt_send';

export interface SttOpenTelemetryPayload extends BaseTelemetryProps {
  locale?: string | null;
  native_flag?: boolean;
}

export interface SttPartialTelemetryPayload extends BaseTelemetryProps {
  sequence_id: number;
  text_length: number;
  partial_transcript: string;
}

export interface SttFinalTelemetryPayload extends BaseTelemetryProps {
  duration_ms?: number;
  text_length: number;
  transcript: string;
}

export interface SttErrorTelemetryPayload extends BaseTelemetryProps {
  error_code: NormalizedErrorCode;
  message?: string;
  native_flag?: boolean;
  retry_count?: number;
  will_retry?: boolean;
}

export interface SttPermissionDeniedTelemetryPayload extends BaseTelemetryProps {
  error_code: Extract<NormalizedErrorCode, 'permission_denied'>;
  native_flag?: boolean;
}

export interface SttSendTelemetryPayload extends BaseTelemetryProps {
  duration_ms?: number;
  text_length: number;
  transcript?: string;
}

export type SttTelemetryPayloadMap = {
  stt_open: SttOpenTelemetryPayload;
  stt_partial: SttPartialTelemetryPayload;
  stt_final: SttFinalTelemetryPayload;
  stt_error: SttErrorTelemetryPayload;
  stt_permission_denied: SttPermissionDeniedTelemetryPayload;
  stt_send: SttSendTelemetryPayload;
};

export type SttTelemetryPayload = SttTelemetryPayloadMap[SttTelemetryEvent];

export type SttTelemetryPayloadFor<Event extends SttTelemetryEvent> =
  SttTelemetryPayloadMap[Event];

// OCR events
export type OcrTelemetryEvent =
  | 'ocr_open'
  | 'ocr_extract_ok'
  | 'ocr_extract_empty'
  | 'ocr_quota_blocked'
  | 'ocr_native_fallback';

export interface OcrOpenTelemetryPayload extends BaseTelemetryProps {
  native_flag: boolean;
}

export interface OcrExtractOkTelemetryPayload extends BaseTelemetryProps {
  native_flag: boolean;
  duration_ms?: number;
  text_length: number;
}

export interface OcrExtractEmptyTelemetryPayload extends BaseTelemetryProps {
  native_flag: boolean;
  duration_ms?: number;
  text_length: number;
  error_code?: NormalizedErrorCode;
}

export interface OcrQuotaBlockedTelemetryPayload extends BaseTelemetryProps {
  native_flag?: boolean;
  error_code: Extract<NormalizedErrorCode, 'quota_exhausted'>;
}

export interface OcrNativeFallbackTelemetryPayload extends BaseTelemetryProps {
  native_flag: boolean;
  duration_ms?: number;
  error_code: Extract<
    NormalizedErrorCode,
    'timeout' | 'native_module_unavailable' | 'transient_native_failure'
  >;
}

export type OcrTelemetryPayloadMap = {
  ocr_open: OcrOpenTelemetryPayload;
  ocr_extract_ok: OcrExtractOkTelemetryPayload;
  ocr_extract_empty: OcrExtractEmptyTelemetryPayload;
  ocr_quota_blocked: OcrQuotaBlockedTelemetryPayload;
  ocr_native_fallback: OcrNativeFallbackTelemetryPayload;
};

export type OcrTelemetryPayload = OcrTelemetryPayloadMap[OcrTelemetryEvent];

export type OcrTelemetryPayloadFor<Event extends OcrTelemetryEvent> =
  OcrTelemetryPayloadMap[Event];
