export type NegotiationTone =
  | 'aggressive'
  | 'urgent'
  | 'budgetFocused'
  | 'collaborative'
  | 'uncertain'
  | 'neutral';

export interface NegotiationStrategyReply {
  tone: NegotiationTone;
  emotionScore: number;
  strategy: string;
  reply: string;
  matchedKeywords: string[];
}

interface StrategyRule {
  tone: NegotiationTone;
  keywords: string[];
  emotionScore: number;
  strategy: string;
  baseReply: string;
  weight: number;
}

const STRATEGY_RULES: StrategyRule[] = [
  {
    tone: 'aggressive',
    keywords: [
      'unacceptable',
      'demand',
      '怒',
      '憤怒',
      'angry',
      'furious',
      'threat',
      '威脅',
      'complain',
      '抱怨',
      '立刻',
      '馬上',
      'right now',
      'now',
      '立即',
      '不能接受',
    ],
    emotionScore: 0.25,
    strategy: '先緩和情緒，再將對話導回具體可行的解決方案。',
    baseReply:
      '我理解您目前的壓力與不滿，我們會保持冷靜並聚焦在讓雙方都能接受的解決方案。',
    weight: 3,
  },
  {
    tone: 'urgent',
    keywords: [
      'urgent',
      'asap',
      'deadline',
      '今天',
      '儘快',
      '盡快',
      '趕緊',
      '緊急',
      'soon',
      '快速',
      'time-sensitive',
    ],
    emotionScore: 0.45,
    strategy: '確認截止時間並提供階段性承諾，建立對進度的信心。',
    baseReply:
      '感謝您提醒時程壓力，我們會立即檢視資源並回覆可行的時間表。',
    weight: 2.5,
  },
  {
    tone: 'budgetFocused',
    keywords: [
      'budget',
      '價格',
      'cost',
      '成本',
      '折扣',
      'discount',
      '便宜',
      '降價',
      '優惠',
      'afford',
      'quote',
      '太貴',
      'price',
    ],
    emotionScore: 0.55,
    strategy: '提出不同價值組合與替代方案，凸顯投資報酬。',
    baseReply:
      '我理解成本考量的重要性，我們可以一起評估彈性條件與替代方案。',
    weight: 2.2,
  },
  {
    tone: 'collaborative',
    keywords: [
      '合作',
      '一起',
      '夥伴',
      '共贏',
      'win-win',
      'partnership',
      'collaborate',
      'together',
      '協力',
      'mutual',
      'support',
    ],
    emotionScore: 0.8,
    strategy: '維持共贏語氣並擴大合作面向以鞏固關係。',
    baseReply:
      '很高興聽到您願意合作，我們可以針對共同目標擬定明確的行動計畫。',
    weight: 2,
  },
  {
    tone: 'uncertain',
    keywords: [
      '不確定',
      '不太清楚',
      '疑問',
      '困惑',
      'unsure',
      'maybe',
      'not sure',
      'doubt',
      '猶豫',
      'clarify',
      'question',
    ],
    emotionScore: 0.5,
    strategy: '提供更多資料並邀請對方分享真正的顧慮。',
    baseReply:
      '感謝您分享疑慮，我們可以一步步釐清重點並補充所需資訊。',
    weight: 1.8,
  },
];

const DEFAULT_REPLY: NegotiationStrategyReply = {
  tone: 'neutral',
  emotionScore: 0.6,
  strategy: '透過提問了解更多需求後，再提出相對應的方案。',
  reply:
    '謝謝您的回覆，讓我們持續對齊彼此的需求並找出最合適的選項。\n\n情緒分數：0.60｜建議策略：透過提問了解更多需求後，再提出相對應的方案。',
  matchedKeywords: [],
};

const escapeRegExp = (value: string): string =>
  value.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');

const collectMatches = (message: string, keywords: string[]): string[] => {
  const matches: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();
    if (!trimmed) {
      continue;
    }

    const hasLatinCharacters = /[a-z]/i.test(trimmed);
    if (hasLatinCharacters) {
      const pattern = new RegExp(`\\b${escapeRegExp(trimmed.toLowerCase())}\\b`, 'i');
      if (pattern.test(message)) {
        matches.push(keyword);
      }
      continue;
    }

    const pattern = new RegExp(escapeRegExp(trimmed), 'i');
    if (pattern.test(message)) {
      matches.push(keyword);
    }
  }

  return matches;
};

const formatEmotionScore = (score: number): string => score.toFixed(2);

export const generateNegotiationReply = (
  message: string,
): NegotiationStrategyReply => {
  if (!message.trim()) {
    return DEFAULT_REPLY;
  }

  let bestRule: StrategyRule | null = null;
  let bestMatches: string[] = [];
  let bestScore = 0;

  for (const rule of STRATEGY_RULES) {
    const matches = collectMatches(message, rule.keywords);
    if (matches.length === 0) {
      continue;
    }

    const score = matches.length * rule.weight;
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
      bestMatches = matches;
    }
  }

  if (!bestRule) {
    return DEFAULT_REPLY;
  }

  const formattedScore = formatEmotionScore(bestRule.emotionScore);
  const reply = `${bestRule.baseReply}\n\n情緒分數：${formattedScore}｜建議策略：${bestRule.strategy}`;

  return {
    tone: bestRule.tone,
    emotionScore: bestRule.emotionScore,
    strategy: bestRule.strategy,
    reply,
    matchedKeywords: bestMatches,
  };
};
