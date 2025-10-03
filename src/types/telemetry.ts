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
