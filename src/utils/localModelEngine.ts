import { SessionAnalysis, DecisionItem, ActionItem, ImportantPoint, RiskItem, TranscriptSegment } from '../types';

export interface LocalEngineConfig {
  engineType: 'gemini' | 'local-ollama' | 'local-fast';
  ollamaUrl: string; // default e.g. "http://localhost:11434"
  ollamaModel: string; // default e.g. "llama3.2" or "qwen2.5"
}

export const DEFAULT_LOCAL_CONFIG: LocalEngineConfig = {
  engineType: 'gemini',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
};

/**
 * Fast, lightweight offline meeting intelligence analyzer.
 * Extracts structured meeting notes (executive summary, decisions with timestamps,
 * action items with strict 'Not specified' rules, risks, open questions)
 * 100% offline without requiring external API keys.
 */
export function generateLocalFastAnalysis(
  transcriptInput: string | TranscriptSegment[],
  durationSeconds: number = 0,
  objectiveHint?: string
): SessionAnalysis {
  let cleanedText = '';
  let segments: TranscriptSegment[] = [];

  if (Array.isArray(transcriptInput)) {
    segments = transcriptInput;
    cleanedText = segments.map((s) => s.text).join(' ').trim();
  } else {
    cleanedText = transcriptInput.trim();
    // Synthesize approximate segments from sentences
    const rawS = cleanedText.split(/(?<=[.?!])\s+/).filter((s) => s.trim().length > 0);
    segments = rawS.map((text, idx) => ({
      id: `synth-${idx}`,
      startTime: Math.round((durationSeconds / Math.max(1, rawS.length)) * idx),
      endTime: Math.round((durationSeconds / Math.max(1, rawS.length)) * (idx + 1)),
      timestamp: Math.round((durationSeconds / Math.max(1, rawS.length)) * idx),
      text: text.trim(),
      source: idx % 2 === 0 ? 'microphone' : 'system',
      speaker: idx % 2 === 0 ? 'Me' : 'Meeting',
      confidence: 0.95,
      isFinal: true,
    }));
  }

  const wordList = cleanedText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = wordList.length;

  const rawSentences = cleanedText
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const title = generateTitleFromText(cleanedText);
  const executiveSummary = generateSummaryFromSentences(rawSentences, cleanedText);

  const decisions = extractDecisions(segments);
  const actionItems = extractActionItemsStructured(segments);
  const importantPoints = extractImportantPoints(segments, rawSentences, wordList);
  const risks = extractRisks(rawSentences);
  const openQuestions = extractOpenQuestions(rawSentences);
  const followUps = extractFollowUps(rawSentences);
  const sentiment = detectTone(cleanedText);

  return {
    title,
    objective: objectiveHint || "Review meeting discussions and determine next steps.",
    executiveSummary,
    summary: executiveSummary,
    decisions,
    actionItems,
    importantPoints,
    risks,
    openQuestions,
    followUps,
    keyTopics: importantPoints.map((p) => ({ topic: p.topic, details: [p.detail] })),
    keyTakeaways: decisions.map((d) => d.decision),
    sentiment,
    wordCount,
  };
}

function generateTitleFromText(text: string): string {
  if (!text) return "Untitled Meeting Session";
  const words = text.slice(0, 120).split(/\s+/).slice(0, 7).join(" ");
  return words ? `Meeting: ${words}...` : "Meeting Intelligence Session";
}

function generateSummaryFromSentences(sentences: string[], fullText: string): string {
  if (sentences.length === 0) {
    return fullText ? fullText.slice(0, 220) + "..." : "Meeting audio session processed locally.";
  }
  if (sentences.length <= 3) {
    return sentences.join(" ");
  }
  const first = sentences[0];
  const mid = sentences[Math.floor(sentences.length / 2)];
  const last = sentences[sentences.length - 1];
  return `${first} ${mid !== first ? mid : ''} ${last !== mid ? last : ''}`.trim();
}

function extractDecisions(segments: TranscriptSegment[]): DecisionItem[] {
  const decisionTriggers = /agreed|decided|agreed to|let's go with|concluded|approved|will use|chosen|going forward/i;
  const decisions: DecisionItem[] = [];

  for (const seg of segments) {
    if (decisionTriggers.test(seg.text)) {
      decisions.push({
        decision: seg.text.replace(/^[a-z0-9\s]+:\s*/i, '').trim(),
        context: `Discussed by ${seg.speaker || 'participant'} at ${formatTimestamp(seg.timestamp || seg.startTime)}`,
        timestamp: Math.round(seg.timestamp || seg.startTime),
      });
      if (decisions.length >= 4) break;
    }
  }

  if (decisions.length === 0 && segments.length > 0) {
    // Provide general decision checkpoint
    const candidate = segments[Math.min(segments.length - 1, 2)];
    decisions.push({
      decision: candidate.text,
      context: `Key consensus reached during session by ${candidate.speaker}`,
      timestamp: Math.round(candidate.timestamp || candidate.startTime),
    });
  }

  return decisions;
}

function extractActionItemsStructured(segments: TranscriptSegment[]): ActionItem[] {
  const actionTriggers = /need to|must|should|will|action|task|plan to|follow up|schedule|deliver|ship|implement/i;
  const items: ActionItem[] = [];

  for (const seg of segments) {
    if (actionTriggers.test(seg.text)) {
      // Look for explicit person name
      let owner = "Not specified";
      const nameMatch = seg.text.match(/\b(Alex|Sarah|Dave|John|Emily|Michael|David|Lisa|Tom|Kevin|Host|Engineer)\b/i);
      if (nameMatch) {
        owner = nameMatch[1];
      } else if (seg.speaker === 'Me') {
        owner = "Me";
      }

      let deadline = "Not specified";
      const dateMatch = seg.text.match(/\b(tomorrow|next week|by Friday|end of sprint|Monday|EOD|Q[1-4])\b/i);
      if (dateMatch) {
        deadline = dateMatch[1];
      }

      const priority: 'high' | 'medium' | 'low' = /urgent|critical|asap|must/i.test(seg.text)
        ? 'high'
        : /important|should|need/i.test(seg.text)
        ? 'medium'
        : 'low';

      items.push({
        task: seg.text.replace(/^[a-z0-9\s]+:\s*/i, '').trim(),
        owner,
        deadline,
        priority,
        timestamp: Math.round(seg.timestamp || seg.startTime),
      });

      if (items.length >= 5) break;
    }
  }

  if (items.length === 0 && segments.length > 0) {
    items.push({
      task: "Review and distribute final meeting minutes",
      owner: "Not specified",
      deadline: "Not specified",
      priority: "medium",
      timestamp: Math.round(segments[0].timestamp || 0),
    });
  }

  return items;
}

function extractImportantPoints(
  segments: TranscriptSegment[],
  sentences: string[],
  words: string[]
): ImportantPoint[] {
  const stopWords = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
    "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her",
    "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
    "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
    "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could",
    "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think"
  ]);

  const freqMap: Record<string, number> = {};
  words.forEach((w) => {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length > 3 && !stopWords.has(clean)) {
      freqMap[clean] = (freqMap[clean] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0]);

  const points: ImportantPoint[] = [];

  for (const kw of topKeywords) {
    const matchingSeg = segments.find((s) => s.text.toLowerCase().includes(kw));
    if (matchingSeg) {
      points.push({
        topic: kw.charAt(0).toUpperCase() + kw.slice(1) + " Architecture / Discussion",
        detail: matchingSeg.text,
        timestamp: Math.round(matchingSeg.timestamp || matchingSeg.startTime),
      });
    }
  }

  if (points.length === 0 && segments.length > 0) {
    points.push({
      topic: "Core Discussion Subject",
      detail: segments[0].text,
      timestamp: Math.round(segments[0].timestamp || 0),
    });
  }

  return points;
}

function extractRisks(sentences: string[]): RiskItem[] {
  const riskTriggers = /risk|concern|issue|blocker|problem|challenge|latency|distortion|noise|failure|delay/i;
  const risks: RiskItem[] = [];

  for (const s of sentences) {
    if (riskTriggers.test(s)) {
      risks.push({
        risk: s,
        impact: "Potential impact on project delivery or meeting quality if unaddressed.",
        suggestedFollowUp: "Schedule a dedicated technical review or investigate root causes.",
      });
      if (risks.length >= 3) break;
    }
  }

  if (risks.length === 0) {
    risks.push({
      risk: "No critical blockers or severe operational risks identified in this session.",
      impact: "Low immediate impact.",
      suggestedFollowUp: "Maintain standard progress tracking.",
    });
  }

  return risks;
}

function extractOpenQuestions(sentences: string[]): string[] {
  const questions = sentences.filter((s) => s.endsWith("?") || /^(how|what|why|who|when|where|can we|should we)\b/i.test(s));
  return questions.length > 0 ? questions.slice(0, 4) : ["Are there any additional integration dependencies before deployment?"];
}

function extractFollowUps(sentences: string[]): string[] {
  return [
    "Share structured AI meeting notes with stakeholders.",
    "Track action items and verify completion in the next sync."
  ];
}

function detectTone(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("error") || lower.includes("bug") || lower.includes("code") || lower.includes("build") || lower.includes("wasapi")) {
    return "Technical & Engineering";
  }
  if (lower.includes("plan") || lower.includes("strategy") || lower.includes("growth") || lower.includes("decision")) {
    return "Strategic & Decision Focused";
  }
  return "Productive Collaborative Sync";
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function generateLocalFastAnswer(transcript: string, question: string): string {
  if (!transcript.trim()) return "Transcript is empty.";
  const qLower = question.toLowerCase().trim();
  const sentences = transcript.split(/(?<=[.?!])\s+/).map((s) => s.trim());

  const qWords = qLower.split(/\s+/).filter((w) => w.length > 3);
  const matches = sentences.filter((s) => {
    const sLower = s.toLowerCase();
    return qWords.some((qw) => sLower.includes(qw));
  });

  if (matches.length > 0) {
    return `⚡ [Local Engine Answer]: Based on the transcript:\n\n"${matches.slice(0, 3).join(' ')}"`;
  }

  return `⚡ [Local Engine Answer]: The transcript discusses: "${transcript.slice(0, 250)}...". Direct answer to "${question}" was not explicitly found in exact words, but review transcript items above.`;
}
