import { SessionAnalysis, ActionItem, DecisionItem, ImportantPoint, RiskItem } from '../types';

/**
 * Lightweight Client-Side NLP Summarizer & Topic Extractor
 * Operates 100% offline, consumes 0 API tokens / quotas, instant response.
 */
export function generateLocalSummary(transcriptText: string, durationSeconds: number): SessionAnalysis {
  const cleanText = transcriptText.trim();
  if (!cleanText) {
    return {
      title: 'Bản ghi âm trống',
      objective: 'Không có mục tiêu được cung cấp',
      executiveSummary: 'Không tìm thấy nội dung hội thoại.',
      summary: 'Không tìm thấy nội dung hội thoại.',
      decisions: [],
      actionItems: [],
      importantPoints: [],
      risks: [],
      openQuestions: [],
      followUps: [],
      keyTopics: [],
      keyTakeaways: [],
      sentiment: 'Trung tính',
      wordCount: 0,
    };
  }

  // Split into sentences and words
  const rawSentences = cleanText
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const words = cleanText.toLowerCase().match(/\b[\w\u00C0-\u024F\u1EA0-\u1EF9]+\b/g) || [];
  const wordCount = words.length;

  // English + Vietnamese common stop words filter
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'to', 'for', 'of', 'with', 'by',
    'from', 'that', 'this', 'it', 'as', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'but', 'not', 'you', 'we', 'they', 'he', 'she', 'i', 'my', 'your',
    'là', 'và', 'có', 'cho', 'của', 'với', 'trong', 'được', 'người', 'khi', 'này', 'đó', 'thì', 'sẽ',
    'như', 'không', 'về', 'ra', 'đến', 'nhiều', 'cũng', 'đã', 'đang', 'muốn', 'làm', 'vào', 'theo'
  ]);

  // Frequency mapping for word score
  const freqMap: Record<string, number> = {};
  words.forEach((w) => {
    if (!stopWords.has(w) && w.length > 2) {
      freqMap[w] = (freqMap[w] || 0) + 1;
    }
  });

  // Sort top keywords
  const sortedKeywords = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  // Extractive sentence scoring
  const sentenceScores = rawSentences.map((sentence, idx) => {
    const sWords = sentence.toLowerCase().match(/\b[\w\u00C0-\u024F\u1EA0-\u1EF9]+\b/g) || [];
    let score = 0;
    sWords.forEach((w) => {
      if (freqMap[w]) score += freqMap[w];
    });
    const positionBoost = idx === 0 ? 1.3 : (1 - idx / rawSentences.length * 0.2);
    return { sentence, score: score * positionBoost, idx };
  });

  sentenceScores.sort((a, b) => b.score - a.score);

  // Take top 3-4 sentences for summary
  const topSentences = sentenceScores
    .slice(0, Math.min(4, rawSentences.length))
    .sort((a, b) => a.idx - b.idx)
    .map((item) => item.sentence);

  const summary = topSentences.length > 0 
    ? topSentences.join(' ') 
    : cleanText.slice(0, 250) + '...';

  // Decisions
  const decisions: DecisionItem[] = topSentences.slice(0, 2).map((s, idx) => ({
    decision: s,
    context: `Consensus point ${idx + 1}`,
    timestamp: Math.round((durationSeconds / Math.max(1, topSentences.length)) * idx),
  }));

  // Extract Action Items
  const actionKeywords = /need to|should|will|must|let's|plan|project|task|follow up|cần|sẽ|phải|làm|thực hiện|hoàn thành|kiểm tra|chuẩn bị/i;
  const actionStrings = rawSentences.filter((s) => actionKeywords.test(s)).slice(0, 4);

  const actionItems: ActionItem[] = actionStrings.map((s, idx) => ({
    task: s,
    owner: "Not specified",
    deadline: "Not specified",
    priority: "medium",
    timestamp: Math.round((durationSeconds / Math.max(1, actionStrings.length)) * idx),
  }));

  // Group top keywords into Key Topics & Important Points
  const importantPoints: ImportantPoint[] = sortedKeywords.slice(0, 3).map((kw, idx) => {
    const matchingSentences = rawSentences.filter((s) => s.toLowerCase().includes(kw)).slice(0, 2);
    return {
      topic: kw.charAt(0).toUpperCase() + kw.slice(1) + " Subject",
      detail: matchingSentences.length > 0 ? matchingSentences.join(' ') : `Discussion regarding "${kw}".`,
      timestamp: Math.round((durationSeconds / 3) * idx),
    };
  });

  const risks: RiskItem[] = [
    {
      risk: "Local offline extraction without cloud reasoning.",
      impact: "Simpler heuristic synthesis.",
      suggestedFollowUp: "Re-run analysis with Gemini when connection is available.",
    },
  ];

  const keyTopics = importantPoints.map((p) => ({ topic: p.topic, details: [p.detail] }));
  const keyTakeaways = topSentences.slice(0, 3);

  const mainKw = sortedKeywords[0] ? (sortedKeywords[0].charAt(0).toUpperCase() + sortedKeywords[0].slice(1)) : 'Cuộc họp';
  const title = `Tóm tắt: Nội dung về ${mainKw}`;

  return {
    title,
    objective: "Local meeting notes extraction",
    executiveSummary: summary,
    summary,
    decisions,
    actionItems,
    importantPoints,
    risks,
    openQuestions: ["Có điểm nào cần thảo luận thêm không?"],
    followUps: ["Chia sẻ biên bản cuộc họp với các thành viên."],
    keyTopics,
    keyTakeaways,
    sentiment: wordCount > 100 ? 'Phân tích & Thảo luận' : 'Trao đổi ngắn',
    wordCount,
  };
}
