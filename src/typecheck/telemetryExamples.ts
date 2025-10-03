import type {
  OcrExtractEmptyTelemetryPayload,
  OcrExtractOkTelemetryPayload,
  OcrNativeFallbackTelemetryPayload,
  OcrOpenTelemetryPayload,
  OcrQuotaBlockedTelemetryPayload,
  SttErrorTelemetryPayload,
  SttFinalTelemetryPayload,
  SttOpenTelemetryPayload,
  SttPartialTelemetryPayload,
  SttPermissionDeniedTelemetryPayload,
  SttSendTelemetryPayload,
} from '../types/telemetry';
import {
  ocrExtractEmptyExamples,
  ocrExtractOkExamples,
  ocrNativeFallbackExamples,
  ocrOpenExamples,
  ocrQuotaBlockedExamples,
  sttErrorExamples,
  sttFinalExamples,
  sttOpenExamples,
  sttPartialExamples,
  sttPermissionDeniedExamples,
  sttSendExamples,
} from '../../docs/examples/telemetryExamples';

type Expect<T> = T;

const expectType = <T>(value: T): Expect<T> => value;

expectType<SttOpenTelemetryPayload[]>(sttOpenExamples);
expectType<SttPartialTelemetryPayload[]>(sttPartialExamples);
expectType<SttFinalTelemetryPayload[]>(sttFinalExamples);
expectType<SttErrorTelemetryPayload[]>(sttErrorExamples);
expectType<SttPermissionDeniedTelemetryPayload[]>(sttPermissionDeniedExamples);
expectType<SttSendTelemetryPayload[]>(sttSendExamples);

expectType<OcrOpenTelemetryPayload[]>(ocrOpenExamples);
expectType<OcrExtractOkTelemetryPayload[]>(ocrExtractOkExamples);
expectType<OcrExtractEmptyTelemetryPayload[]>(ocrExtractEmptyExamples);
expectType<OcrQuotaBlockedTelemetryPayload[]>(ocrQuotaBlockedExamples);
expectType<OcrNativeFallbackTelemetryPayload[]>(ocrNativeFallbackExamples);
