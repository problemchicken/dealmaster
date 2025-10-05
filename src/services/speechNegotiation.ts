import {Platform} from 'react-native';
import {isAxiosError} from 'axios';
import type {NegotiationStrategyReply} from '../ai/negotiationStrategy';
import {api} from './api';
import {
  normalizeTelemetryErrorCode,
  trackSpeechPipelineEvent,
} from './telemetry';
import type {SpeechPipelineTelemetryPayloadFor} from '../types/telemetry';

export interface SpeechNegotiationRequest {
  audioBase64: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface SpeechNegotiationResponse {
  transcript: string;
  strategy: NegotiationStrategyReply;
}

const SPEECH_PIPELINE_PROVIDER = 'speech_pipeline';

const getTelemetryPlatform = (): 'ios' | 'android' =>
  Platform.OS === 'android' ? 'android' : 'ios';

const buildTelemetryPayload = (
  overrides: Partial<SpeechPipelineTelemetryPayloadFor<'speech_pipeline_complete'>>,
): SpeechPipelineTelemetryPayloadFor<'speech_pipeline_complete'> => ({
  platform: getTelemetryPlatform(),
  provider: SPEECH_PIPELINE_PROVIDER,
  duration_ms: overrides.duration_ms ?? 0,
  error_rate: overrides.error_rate ?? 0,
  transcript_length: overrides.transcript_length,
  error_code: overrides.error_code,
  error_message: overrides.error_message,
});

const resolveRawErrorCode = (error: unknown): string => {
  if (isAxiosError(error)) {
    const data = error.response?.data as {error_code?: string} | undefined;
    if (data && typeof data.error_code === 'string' && data.error_code.length > 0) {
      return data.error_code;
    }

    if (typeof error.code === 'string' && error.code.length > 0) {
      return error.code;
    }

    if (typeof error.response?.status === 'number') {
      return String(error.response.status);
    }
  }

  if (
    error &&
    typeof (error as {code?: unknown}).code === 'string' &&
    ((error as {code?: string}).code?.length ?? 0) > 0
  ) {
    return (error as {code: string}).code;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error ?? 'unknown_error');
};

const resolveErrorMessage = (error: unknown): string | undefined => {
  if (isAxiosError(error)) {
    const data = error.response?.data as {message?: string} | undefined;
    if (data && typeof data.message === 'string' && data.message.length > 0) {
      return data.message;
    }

    if (typeof error.message === 'string' && error.message.length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return undefined;
};

export const submitSpeechNegotiationSample = async (
  request: SpeechNegotiationRequest,
): Promise<SpeechNegotiationResponse> => {
  const start = Date.now();

  try {
    const response = await api.post<SpeechNegotiationResponse>(
      '/api/speech-endpoint',
      request,
    );

    const duration = Date.now() - start;
    const transcriptLength = response.data?.transcript?.length ?? 0;

    const telemetryPayload = buildTelemetryPayload({
      duration_ms: duration,
      error_rate: 0,
      transcript_length: transcriptLength > 0 ? transcriptLength : undefined,
    });

    trackSpeechPipelineEvent('speech_pipeline_complete', telemetryPayload);

    return response.data;
  } catch (error) {
    const duration = Date.now() - start;
    const normalizedErrorCode = normalizeTelemetryErrorCode(
      resolveRawErrorCode(error),
    );

    const telemetryPayload = buildTelemetryPayload({
      duration_ms: duration,
      error_rate: 1,
      error_code: normalizedErrorCode,
      error_message: resolveErrorMessage(error),
    });

    trackSpeechPipelineEvent('speech_pipeline_complete', telemetryPayload);

    throw error;
  }
};
