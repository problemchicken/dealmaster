// STT events
export type SttTelemetryEvent =
  | 'stt_open'
  | 'stt_partial'
  | 'stt_final'
  | 'stt_error'
  | 'stt_permission_denied'
  | 'stt_send';

export type SttTelemetryPayload = {
  platform: string;
  locale?: string | null;
  duration_ms?: number;
  chars?: number;
  error_code?: string;
  message?: string;
};

// OCR events
export type OcrTelemetryEvent =
  | 'ocr_open'
  | 'ocr_extract_ok'
  | 'ocr_extract_empty'
  | 'ocr_quota_blocked'
  | 'ocr_native_fallback';

export type OcrPlatform = 'ios' | 'android';
export type OcrProvider = 'visionKit' | 'mlkit' | 'stub';

export interface OcrBaseTelemetryProps {
  platform: OcrPlatform;
  provider: OcrProvider;
}
