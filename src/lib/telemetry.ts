export type TelemetryProps = Record<string, any>;

export function track(event: string, props?: TelemetryProps): void {
  const payload = props ?? {};
  if (Object.keys(payload).length > 0) {
    console.log(`[telemetry] ${event}`, payload);
  } else {
    console.log(`[telemetry] ${event}`);
  }
}
