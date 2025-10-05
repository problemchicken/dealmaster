/* eslint-disable no-bitwise */

const SAMPLE_RATE = 16000;
const DURATION_SECONDS = 1.5;
const FREQUENCY = 440;
const AMPLITUDE = 0.3;

const createSampleWavBytes = (): Uint8Array => {
  const totalSamples = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
  const headerSize = 44;
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    offset += value.length;
  };

  const writeUInt32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };

  const writeUInt16 = (value: number) => {
    view.setUint16(offset, value, true);
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
    view.setInt16(headerSize + i * bytesPerSample, Math.round(sample * 0x7fff), true);
  }

  return new Uint8Array(buffer);
};

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const toBase64 = (bytes: Uint8Array): string => {
  let result = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f] +
      BASE64_CHARS[(chunk >> 12) & 0x3f] +
      BASE64_CHARS[(chunk >> 6) & 0x3f] +
      BASE64_CHARS[chunk & 0x3f];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f] +
      BASE64_CHARS[(chunk >> 12) & 0x3f] +
      '==';
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f] +
      BASE64_CHARS[(chunk >> 12) & 0x3f] +
      BASE64_CHARS[(chunk >> 6) & 0x3f] +
      '=';
  }

  return result;
};

let cachedBase64: string | null = null;

export const getSampleCommandAudioBase64 = (): string => {
  if (cachedBase64) {
    return cachedBase64;
  }
  const bytes = createSampleWavBytes();
  cachedBase64 = toBase64(bytes);
  return cachedBase64;
};

export const sampleCommandAudioBase64 = getSampleCommandAudioBase64();
