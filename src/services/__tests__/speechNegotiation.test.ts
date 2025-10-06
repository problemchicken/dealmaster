import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {AxiosError} from 'axios';
import {submitSpeechNegotiationSample} from '../speechNegotiation';

const mockPost: jest.Mock = jest.fn();
const mockTrackSpeechPipelineEvent = jest.fn();
const mockNormalizeTelemetryErrorCode = jest.fn((code: string) => code);

jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
}));

jest.mock('../api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

jest.mock('../telemetry', () => ({
  trackSpeechPipelineEvent: (...args: unknown[]) =>
    mockTrackSpeechPipelineEvent(...args),
  normalizeTelemetryErrorCode: (code: string) =>
    mockNormalizeTelemetryErrorCode(code),
}));

describe('submitSpeechNegotiationSample', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invokes backend endpoint and emits success telemetry', async () => {
    const strategy = {
      tone: 'neutral',
      emotionScore: 0.6,
      strategy: 'Stay calm and outline next steps.',
      reply: 'Final reply',
      matchedKeywords: [],
    } as const;

    mockPost.mockImplementationOnce(async () => ({
      data: {transcript: 'hello world', strategy},
    }));

    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockImplementationOnce(() => 1000);
    dateSpy.mockImplementationOnce(() => 1600);

    const result = await submitSpeechNegotiationSample({
      audioBase64: 'base64data',
    });

    expect(result).toEqual({transcript: 'hello world', strategy});

    expect(mockPost).toHaveBeenCalledWith('/api/speech-endpoint', {
      audioBase64: 'base64data',
    });

    expect(mockTrackSpeechPipelineEvent).toHaveBeenCalledWith(
      'speech_pipeline_complete',
      expect.objectContaining({
        platform: 'ios',
        provider: 'speech_pipeline',
        total_duration_ms: 600,
        endpoint_latency_ms: 600,
        error_rate: 0,
        transcript_length: 11,
      }),
    );

    dateSpy.mockRestore();
  });

  it('tracks telemetry when the endpoint rejects', async () => {
    const axiosError = new Error('network failure') as AxiosError & {
      isAxiosError: true;
    };
    axiosError.isAxiosError = true;
    axiosError.code = 'ECONNABORTED';

    mockPost.mockImplementationOnce(async () => {
      throw axiosError;
    });

    const dateSpy = jest.spyOn(Date, 'now');
    dateSpy.mockImplementationOnce(() => 2000);
    dateSpy.mockImplementationOnce(() => 2600);

    await expect(
      submitSpeechNegotiationSample({audioBase64: 'broken'}),
    ).rejects.toThrow('network failure');

    expect(mockNormalizeTelemetryErrorCode).toHaveBeenCalledWith(
      'ECONNABORTED',
    );

    expect(mockTrackSpeechPipelineEvent).toHaveBeenCalledWith(
      'speech_pipeline_complete',
      expect.objectContaining({
        total_duration_ms: 600,
        endpoint_latency_ms: 600,
        error_rate: 1,
        error_code: 'ECONNABORTED',
        error_message: 'network failure',
      }),
    );

    dateSpy.mockRestore();
  });
});
