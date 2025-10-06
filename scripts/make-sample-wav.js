#!/usr/bin/env node
/* eslint-env node */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 16000;
const DURATION_SECONDS = Number(process.env.SPEECH_SAMPLE_DURATION || 1.5);
const FREQUENCY = 440;
const AMPLITUDE = 0.3;

const to16BitPCM = sample => {
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped * 0x7fff);
};

const createWavBuffer = (durationSeconds = DURATION_SECONDS) => {
  const totalSamples = Math.floor(SAMPLE_RATE * durationSeconds);
  const headerSize = 44;
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = Buffer.alloc(headerSize + dataSize);
  let offset = 0;

  const writeString = value => {
    buffer.write(value, offset, value.length, 'ascii');
    offset += value.length;
  };

  const writeUInt32 = value => {
    buffer.writeUInt32LE(value, offset);
    offset += 4;
  };

  const writeUInt16 = value => {
    buffer.writeUInt16LE(value, offset);
    offset += 2;
  };

  writeString('RIFF');
  writeUInt32(36 + dataSize);
  writeString('WAVE');
  writeString('fmt ');
  writeUInt32(16);
  writeUInt16(1);
  writeUInt16(1);
  writeUInt32(SAMPLE_RATE);
  writeUInt32(SAMPLE_RATE * bytesPerSample);
  writeUInt16(bytesPerSample);
  writeUInt16(16);
  writeString('data');
  writeUInt32(dataSize);

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / SAMPLE_RATE;
    const sample = Math.sin(2 * Math.PI * FREQUENCY * t) * AMPLITUDE;
    buffer.writeInt16LE(to16BitPCM(sample), headerSize + i * bytesPerSample);
  }

  return buffer;
};

const ensureSampleWav = targetPath => {
  const absolutePath = targetPath
    ? path.resolve(process.cwd(), targetPath)
    : path.resolve(__dirname, '..', 'tmp', 'sample-command.wav');

  const buffer = createWavBuffer();
  fs.mkdirSync(path.dirname(absolutePath), {recursive: true});
  fs.writeFileSync(absolutePath, buffer);
  return absolutePath;
};

if (require.main === module) {
  const target = process.argv[2];
  const output = ensureSampleWav(target);
  console.log(`Sample WAV generated at ${output}`);
}

module.exports = {
  createWavBuffer,
  ensureSampleWav,
};
