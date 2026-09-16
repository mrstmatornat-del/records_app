/**
 * Transcript Text Normalization & Token-level Overlap Utilities
 * Provides defensive deduplication while strictly preserving legitimate human repetition.
 */

/**
 * Normalizes transcript text for comparison:
 * - lowercase
 * - collapses multiple whitespaces
 * - removes leading/trailing punctuation and trims
 * - keeps alphanumeric and Unicode/Vietnamese letters intact
 */
export function normalizeTranscriptText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into an array of normalized words.
 */
export function tokenizeWords(text: string): string[] {
  const norm = normalizeTranscriptText(text);
  if (!norm) return [];
  return norm.split(' ').filter((w) => w.length > 0);
}

/**
 * Checks if two text strings are substantially identical ignoring case, punctuation, and whitespace.
 */
export function isSubstantiallyIdentical(textA: string, textB: string): boolean {
  return normalizeTranscriptText(textA) === normalizeTranscriptText(textB);
}

/**
 * Checks if textA is a strict normalized prefix of textB.
 * Example:
 * textA: "I have a cat"
 * textB: "I have a cat, something"
 * -> true
 */
export function isNormalizedPrefix(textA: string, textB: string): boolean {
  const normA = normalizeTranscriptText(textA);
  const normB = normalizeTranscriptText(textB);
  if (!normA || !normB) return false;
  if (normA === normB) return false;
  return normB.startsWith(normA + ' ') || normB === normA;
}

/**
 * Finds token-level suffix/prefix overlap between two sentences.
 * Example:
 * tokensA: ["i", "have", "a", "cat", "something"]
 * tokensB: ["something", "very", "huge"]
 * returns overlap length: 1 (for "something")
 */
export function findSuffixPrefixTokenOverlap(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const maxOverlap = Math.min(tokensA.length, tokensB.length);

  for (let len = maxOverlap; len >= 1; len--) {
    let match = true;
    for (let i = 0; i < len; i++) {
      if (tokensA[tokensA.length - len + i] !== tokensB[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return len;
    }
  }

  return 0;
}

/**
 * Merges two transcript texts if textB is a continuation or suffix-overlap of textA.
 * Returns the merged text, or null if no overlap exists.
 */
export function mergeTranscriptTexts(textA: string, textB: string): string | null {
  const cleanA = textA.trim();
  const cleanB = textB.trim();
  if (!cleanA) return cleanB;
  if (!cleanB) return cleanA;

  // 1. Exact or substantial duplicate
  if (isSubstantiallyIdentical(cleanA, cleanB)) {
    // Keep whichever has better casing/punctuation
    return cleanB.length >= cleanA.length ? cleanB : cleanA;
  }

  // 2. Prefix duplication (cleanA is prefix of cleanB)
  if (isNormalizedPrefix(cleanA, cleanB)) {
    return cleanB;
  }

  // 3. Suffix duplication (cleanB is already contained as suffix of cleanA)
  if (isNormalizedPrefix(cleanB, cleanA)) {
    return cleanA;
  }

  // 4. Token-level overlap
  const tokensA = tokenizeWords(cleanA);
  const tokensB = tokenizeWords(cleanB);
  const overlapLen = findSuffixPrefixTokenOverlap(tokensA, tokensB);

  if (overlapLen > 0) {
    // Split textB into words in original casing to append only the non-overlapping part
    const rawWordsB = cleanB.split(/\s+/);
    if (rawWordsB.length >= overlapLen) {
      const nonOverlappingB = rawWordsB.slice(overlapLen).join(' ');
      if (nonOverlappingB.length > 0) {
        // Clean trailing punctuation on textA before joining if needed
        const baseA = cleanA.replace(/[,;]+$/, '');
        return `${baseA} ${nonOverlappingB}`.replace(/\s+/g, ' ').trim();
      }
      return cleanA;
    }
  }

  return null;
}
