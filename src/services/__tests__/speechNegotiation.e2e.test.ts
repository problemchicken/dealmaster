import http from 'http';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {ensureSampleWav} from '../../../scripts/make-sample-wav';

jest.mock('react-native', () => ({
  Platform: {OS: 'ios'},
}));

const createServer = (
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<{server: http.Server; url: string}> =>
  new Promise(resolve => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        resolve({server, url: `http://127.0.0.1:${address.port}`});
      }
    });
  });

afterEach(() => {
  delete process.env.API_URL;
  jest.resetModules();
  jest.clearAllMocks();
});

describe('speech negotiation E2E', () => {
  it('succeeds against a mock backend and records telemetry', async () => {
    const telemetryEvents: Array<{event: string; payload: unknown}> = [];

    const samplePath = ensureSampleWav(
      path.resolve(__dirname, '../../../..', 'tmp', 'sample-command.wav'),
    );
    const audioBase64 = fs.readFileSync(samplePath).toString('base64');

    const {server, url} = await createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/api/speech-endpoint') {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        if (!parsed.audioBase64) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error_code: 'invalid_payload',
              message: 'audioBase64 is required',
            }),
          );
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            transcript: 'demo transcript',
            strategy: {
              tone: 'collaborative',
              emotionScore: 0.75,
              strategy: '保持正向合作語氣，提出具體下一步。',
              reply: '合作無間',
              matchedKeywords: ['合作'],
            },
          }),
        );
      });
    });

    jest.doMock('../telemetry', () => {
      const actual = jest.requireActual('../telemetry') as typeof import('../telemetry');
      return {
        ...actual,
        trackSpeechPipelineEvent: (event: string, payload: unknown) => {
          telemetryEvents.push({event, payload});
        },
      };
    });

    jest.doMock('../api', () => {
      const client = axios.create({
        baseURL: url,
        proxy: false,
      });
      return {api: client};
    });

    const {submitSpeechNegotiationSample} = jest.requireActual<typeof import('../speechNegotiation')>('../speechNegotiation');

    try {
      const result = await submitSpeechNegotiationSample({
        audioBase64,
      });

      expect(result.transcript).toBe('demo transcript');
      expect(result.strategy.tone).toBe('collaborative');
      expect(telemetryEvents).toHaveLength(1);
      const telemetry = telemetryEvents[0];
      expect(telemetry.event).toBe('speech_pipeline_complete');
      const payload = telemetry.payload as {total_duration_ms: number; error_rate: number};
      expect(payload.total_duration_ms).toBeGreaterThanOrEqual(0);
      expect(payload.error_rate).toBe(0);
    } finally {
      server.close();
    }
  });

  it('tracks error telemetry when backend fails', async () => {
    const telemetryEvents: Array<{event: string; payload: unknown}> = [];

    const {server, url} = await createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/speech-endpoint') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            JSON.parse(body || '{}');
          } catch (error) {
            console.error('Failed to parse mock request body', error);
          }
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({error_code: 'quota_exhausted', message: 'quota'}));
        });
        return;
      }
      res.statusCode = 404;
      res.end('not found');
    });

    jest.doMock('../telemetry', () => {
      const actual = jest.requireActual('../telemetry') as typeof import('../telemetry');
      return {
        ...actual,
        trackSpeechPipelineEvent: (event: string, payload: unknown) => {
          telemetryEvents.push({event, payload});
        },
      };
    });

    jest.doMock('../api', () => {
      const client = axios.create({
        baseURL: url,
        proxy: false,
      });
      return {api: client};
    });

    const {submitSpeechNegotiationSample} = jest.requireActual<typeof import('../speechNegotiation')>('../speechNegotiation');

    try {
      const samplePath = ensureSampleWav(
        path.resolve(__dirname, '../../../..', 'tmp', 'sample-command.wav'),
      );
      const audioBase64 = fs.readFileSync(samplePath).toString('base64');

      await expect(
        submitSpeechNegotiationSample({
          audioBase64,
          metadata: {simulateFailure: true},
        }),
      ).rejects.toThrow();
      expect(telemetryEvents).toHaveLength(1);
      const payload = telemetryEvents[0].payload as {
        total_duration_ms: number;
        error_rate: number;
        error_code?: string;
      };
      expect(payload.error_rate).toBe(1);
      expect(payload.error_code).toBe('quota_exhausted');
      expect(payload.total_duration_ms).toBeGreaterThanOrEqual(0);
    } finally {
      server.close();
    }
  });
});
