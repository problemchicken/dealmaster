import {generateNegotiationReply} from '../negotiationStrategy';

describe('generateNegotiationReply', () => {
  it('分類強硬語氣並提供降溫策略', () => {
    const input =
      'This is absolutely unacceptable. I demand a better price right now or we walk away.';
    const result = generateNegotiationReply(input);

    expect(result.tone).toBe('aggressive');
    expect(result.emotionScore).toBeCloseTo(0.25);
    expect(result.strategy).toContain('緩和情緒');
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining(['unacceptable', 'demand', 'right now']),
    );
    expect(result.reply).toContain('情緒分數：0.25');
    expect(result.reply).toContain('建議策略');
  });

  it('辨識合作語氣並維持共贏策略', () => {
    const input =
      'We are excited to build a win-win partnership and move forward together on this project.';
    const result = generateNegotiationReply(input);

    expect(result.tone).toBe('collaborative');
    expect(result.emotionScore).toBeCloseTo(0.8);
    expect(result.strategy).toContain('共贏');
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining(['win-win', 'partnership', 'together']),
    );
    expect(result.reply).toContain('情緒分數：0.80');
  });

  it('針對價格關注給出成本策略', () => {
    const input =
      'Our budget is extremely tight. Can you offer a better price or some discount options?';
    const result = generateNegotiationReply(input);

    expect(result.tone).toBe('budgetFocused');
    expect(result.emotionScore).toBeCloseTo(0.55);
    expect(result.strategy).toContain('價值組合');
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining(['budget', 'price', 'discount']),
    );
    expect(result.reply).toContain('情緒分數：0.55');
  });

  it('沒有關鍵字時回傳中性策略', () => {
    const input = 'Thank you for the update. Let us know the next steps.';
    const result = generateNegotiationReply(input);

    expect(result.tone).toBe('neutral');
    expect(result.emotionScore).toBeCloseTo(0.6);
    expect(result.matchedKeywords).toHaveLength(0);
    expect(result.reply).toContain('情緒分數：0.60');
  });
});
