export type OcrTelemetryEvent =
  | 'ocr_open'
  | 'ocr_extract_ok'
  | 'ocr_extract_empty'
  | 'ocr_quota_blocked'
  | 'ocr_native_fallback';

export type OcrPlatform = 'ios' | 'android';
export type OcrProvider = 'visionkit' | 'mlkit' | 'stub';

export interface OcrBaseTelemetryProps {
  platform: OcrPlatform;
  native_flag: boolean;
  provider: OcrProvider;
  duration_ms?: number;
}

export interface OcrExtractTelemetryProps extends OcrBaseTelemetryProps {
  text_length: number;
  duration_ms: number;
  error_code?: string;
}

export type OcrTelemetryPropsMap = {
  ocr_open: OcrBaseTelemetryProps;
  ocr_extract_ok: OcrExtractTelemetryProps;
  ocr_extract_empty: OcrExtractTelemetryProps & {text_length: 0};
  ocr_quota_blocked: OcrBaseTelemetryProps & {error_code?: string};
  ocr_native_fallback: OcrBaseTelemetryProps & {error_code: string};
};

export type OcrTelemetryProps<E extends OcrTelemetryEvent> =
  OcrTelemetryPropsMap[E];
