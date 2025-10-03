import type {SttTelemetryEvent, SttTelemetryPayload} from '../types/telemetry';

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

export const trackSttEvent = (
  event: SttTelemetryEvent,
  payload: SttTelemetryPayload,
): void => {
  track(event, payload);
};
