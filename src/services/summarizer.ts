import {MessageRecord} from '../storage/types';

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const toSentences = (text: string): string[] => {
  return text
    .replace(/\s+/g, ' ')
    .split(/[.!?\n]+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
};

const buildBulletSummary = (messages: MessageRecord[], maxSentences: number) => {
  const bullets: string[] = [];
  for (const message of messages) {
    const content = message.content.trim();
    if (!content) {
      continue;
    }
    const sentences = toSentences(content);
    if (sentences.length === 0) {
      continue;
    }
    const snippet = sentences.slice(0, 1).join(' ').slice(0, 140).trim();
    bullets.push(`• ${snippet}`);
    if (bullets.length >= maxSentences) {
      break;
    }
  }
  return bullets.join('\n');
};

export const summarizeMessages = (
  messages: MessageRecord[],
  options?: {targetLength?: number},
): string => {
  if (messages.length === 0) {
    return '目前尚未有可供摘要的歷史訊息。';
  }

  const targetLength = options?.targetLength ?? 260;
  const maxSentences = clamp(Math.ceil(targetLength / 70), 3, 6);
  const bulletSummary = buildBulletSummary(messages, maxSentences);
  const joined = bulletSummary || messages.map(m => m.content).join(' ');
  const trimmed = joined.slice(0, clamp(targetLength, 200, 320));
  return trimmed.endsWith('…') || trimmed.length < targetLength
    ? trimmed
    : `${trimmed}…`;
};

export const estimateTokenSize = (messages: MessageRecord[]): number => {
  return messages.reduce((total, message) => {
    const approxTokens = Math.ceil(message.content.split(/\s+/).filter(Boolean).length * 1.3);
    return total + approxTokens;
  }, 0);
};

