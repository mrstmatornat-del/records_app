import { SessionAnalysis } from '../types';

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
 * Fast, lightweight offline NLP analyzer that runs instantly on any machine (Bronze/Low spec)
 * without requiring external server calls or cloud API keys.
 */
export function generateLocalFastAnalysis(transcript: string, durationSeconds: number = 0): SessionAnalysis {
  const cleanedText = transcript.trim();
  const wordList = cleanedText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = wordList.length;

  // Split into sentences
  const rawSentences = cleanedText
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  const title = generateTitleFromText(cleanedText);
  const summary = generateSummaryFromSentences(rawSentences, cleanedText);
  const keyTopics = extractKeyTopics(rawSentences, wordList);
  const actionItems = extractActionItems(rawSentences);
  const keyTakeaways = extractKeyTakeaways(rawSentences);
  const sentiment = detectTone(cleanedText);

  return {
    title,
    summary,
    keyTopics,
    actionItems,
    keyTakeaways,
    sentiment,
    wordCount,
  };
}

function generateTitleFromText(text: string): string {
  if (!text) return "Untitled Audio Session";
  const words = text.slice(0, 120).split(/\s+/).slice(0, 7).join(" ");
  return words ? `Note: ${words}...` : "Audio Stream Session";
}

function generateSummaryFromSentences(sentences: string[], fullText: string): string {
  if (sentences.length === 0) {
    return fullText ? fullText.slice(0, 200) + "..." : "Recorded audio session processed locally.";
  }
  if (sentences.length <= 3) {
    return sentences.join(" ");
  }
  // Pick first, middle, and last sentences for a balanced summary
  const first = sentences[0];
  const mid = sentences[Math.floor(sentences.length / 2)];
  const last = sentences[sentences.length - 1];
  return `${first} ${mid !== first ? mid : ''} ${last !== mid ? last : ''}`.trim();
}

function extractKeyTopics(sentences: string[], words: string[]): { topic: string; details: string[] }[] {
  // Find top frequency words (excluding common stop words)
  const stopWords = new Set([
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
    "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her",
    "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
    "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
    "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could",
    "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
    "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
    "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was", "were"
  ]);

  const freqMap: Record<string, number> = {};
  words.forEach(w => {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length > 3 && !stopWords.has(clean)) {
      freqMap[clean] = (freqMap[clean] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  if (topKeywords.length === 0) {
    return [
      {
        topic: "Main Audio Discussion",
        details: [
          sentences[0] || "General discussion captured from recorded audio stream.",
          sentences[1] || "Key points processed offline locally."
        ]
      }
    ];
  }

  return topKeywords.map(keyword => {
    const matchingSentences = sentences.filter(s => s.toLowerCase().includes(keyword));
    const details = matchingSentences.length > 0
      ? matchingSentences.slice(0, 3)
      : [
          `Key discussion related to "${keyword}".`,
          `Captured during stream recording session.`
        ];

    return {
      topic: keyword.charAt(0).toUpperCase() + keyword.slice(1) + " Subject",
      details,
    };
  });
}

function extractActionItems(sentences: string[]): string[] {
  const actionTriggers = ["need to", "must", "should", "will", "let's", "todo", "action", "plan", "next", "follow up", "create", "implement", "check"];
  const matched = sentences.filter(s => 
    actionTriggers.some(t => s.toLowerCase().includes(t))
  );

  if (matched.length > 0) {
    return matched.slice(0, 4);
  }

  return [
    "Review transcribed notes and verify key discussion points.",
    "Share session summary with team members or save to history."
  ];
}

function extractKeyTakeaways(sentences: string[]): string[] {
  if (sentences.length >= 3) {
    return sentences.slice(0, 3);
  }
  return [
    "Fast local offline processing completed without cloud API latency.",
    "Session transcript saved locally in history."
  ];
}

function detectTone(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("error") || lower.includes("bug") || lower.includes("code") || lower.includes("build")) {
    return "Technical & Engineering";
  }
  if (lower.includes("plan") || lower.includes("strategy") || lower.includes("goal") || lower.includes("market")) {
    return "Strategic & Planning";
  }
  return "Fast Offline Analysis (Local)";
}

/**
 * Fast, local offline Q&A function
 */
export function generateLocalFastAnswer(transcript: string, question: string): string {
  if (!transcript.trim()) return "Transcript is empty.";
  const qLower = question.toLowerCase().trim();
  const sentences = transcript.split(/(?<=[.?!])\s+/).map(s => s.trim());

  // Search sentences containing keywords from question
  const qWords = qLower.split(/\s+/).filter(w => w.length > 3);
  const matches = sentences.filter(s => {
    const sLower = s.toLowerCase();
    return qWords.some(qw => sLower.includes(qw));
  });

  if (matches.length > 0) {
    return `⚡ [Local Engine Answer]: Based on the transcript:\n\n"${matches.slice(0, 3).join(' ')}"`;
  }

  return `⚡ [Local Engine Answer]: The transcript discusses: "${transcript.slice(0, 250)}...". Explicit answer for "${question}" was not directly found in the exact words, but you can review the transcript details above.`;
}
