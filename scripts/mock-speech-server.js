#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.SPEECH_E2E_PORT || 4100);
const artifactDir = path.resolve(
  process.env.SPEECH_E2E_ARTIFACT_DIR ||
    path.join(__dirname, '..', 'artifacts', 'e2e-smoke'),
);
fs.mkdirSync(artifactDir, {recursive: true});

const logPath = path.join(artifactDir, 'mock-server.log');
const telemetryPath = path.join(artifactDir, 'telemetry.json');
const telemetryBuffer = [];

const writeLog = message => {
  const line = `[mock-speech] ${new Date().toISOString()} ${message}`;
  fs.appendFileSync(logPath, `${line}\n`, {encoding: 'utf8'});
  console.log(line);
};

const writeTelemetry = payload => {
  telemetryBuffer.push(payload);
  fs.writeFileSync(telemetryPath, JSON.stringify(telemetryBuffer, null, 2));
};

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  if (!req.url.startsWith('/api/speech-endpoint')) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });
  req.on('end', () => {
    writeLog(`received payload (${body.length} bytes)`);
    let parsed;
    try {
      parsed = body ? JSON.parse(body) : {};
    } catch (error) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error_code: 'invalid_payload',
          message: 'Request body must be valid JSON.',
        }),
      );
      writeTelemetry({
        event: 'speech_pipeline_complete',
        total_duration_ms: 120,
        endpoint_latency_ms: 90,
        error_rate: 1,
        error_code: 'invalid_payload',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const shouldFail = parsed?.metadata?.simulateFailure === true;

    if (shouldFail) {
      res.statusCode = 429;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error_code: 'quota_exhausted',
          message: 'Speech quota exhausted.',
        }),
      );
      writeTelemetry({
        event: 'speech_pipeline_complete',
        total_duration_ms: 450,
        endpoint_latency_ms: 420,
        error_rate: 1,
        error_code: 'quota_exhausted',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const response = {
      transcript: 'simulate power on the lights',
      strategy: {
        tone: 'collaborative',
        emotionScore: 0.82,
        strategy: '保持合作語氣並提出具體的折衷方案。',
        reply: '我們先列出可行步驟，再決定最適合的行動。',
        matchedKeywords: ['合作', 'lights'],
      },
    };
    res.end(JSON.stringify(response));
    writeTelemetry({
      event: 'speech_pipeline_complete',
      total_duration_ms: 380,
      endpoint_latency_ms: 310,
      error_rate: 0,
      transcript_length: response.transcript.length,
      timestamp: new Date().toISOString(),
    });
  });
});

server.listen(port, () => {
  writeLog(`mock speech server listening on ${port}`);
});

const shutdown = () => {
  writeLog('shutting down mock speech server');
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
