import { describe, it, expect } from 'vitest';
import { generateLocalFastAnalysis } from '../src/utils/localModelEngine';
import { TranscriptSegment } from '../src/types';

describe('Meeting Intelligence & Structured Output', () => {
  const mockTranscript: TranscriptSegment[] = [
    {
      id: '1',
      startTime: 5,
      endTime: 12,
      timestamp: 5,
      text: "Good morning team. We decided to adopt the Fabric Direct Lake architecture for our reporting layer.",
      source: 'microphone',
      speaker: 'Me',
      confidence: 0.95,
      isFinal: true,
    },
    {
      id: '2',
      startTime: 15,
      endTime: 24,
      timestamp: 15,
      text: "Alex will implement the ETL reconciliation pipeline by next week.",
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.94,
      isFinal: true,
    },
    {
      id: '3',
      startTime: 28,
      endTime: 38,
      timestamp: 28,
      text: "There is a major risk of schema drift causing pipeline failure if legacy databases are updated without notice.",
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.93,
      isFinal: true,
    },
    {
      id: '4',
      startTime: 42,
      endTime: 50,
      timestamp: 42,
      text: "We should also verify whether third party APIs support our rate limits.",
      source: 'system',
      speaker: 'Meeting',
      confidence: 0.91,
      isFinal: true,
    },
  ];

  it('generates complete structured schema with executiveSummary, decisions, actionItems, risks', () => {
    const analysis = generateLocalFastAnalysis(mockTranscript, 60, "Agree on architecture and deliverables");

    expect(analysis.title).toBeTruthy();
    expect(analysis.executiveSummary).toBeTruthy();
    expect(analysis.decisions.length).toBeGreaterThan(0);
    expect(analysis.actionItems.length).toBeGreaterThan(0);
    expect(analysis.risks.length).toBeGreaterThan(0);
    expect(analysis.importantPoints.length).toBeGreaterThan(0);
    expect(analysis.openQuestions.length).toBeGreaterThan(0);
  });

  it('links decisions and action items to integer timestamps matching transcript positions', () => {
    const analysis = generateLocalFastAnalysis(mockTranscript, 60);

    // Decision at timestamp 5
    const decision = analysis.decisions.find((d) => d.timestamp === 5);
    expect(decision).toBeDefined();
    expect(decision?.decision).toContain("Fabric Direct Lake");

    // Action item with Alex as owner and next week deadline
    const alexTask = analysis.actionItems.find((a) => a.owner === "Alex");
    expect(alexTask).toBeDefined();
    expect(alexTask?.deadline).toBe("next week");
    expect(alexTask?.timestamp).toBe(15);
  });

  it('strictly adheres to the rule: Never invent owner or deadline, write "Not specified"', () => {
    const unnamedTaskSegments: TranscriptSegment[] = [
      {
        id: '10',
        startTime: 10,
        endTime: 20,
        timestamp: 10,
        text: "We should optimize the database indexing and review logs.",
        source: 'system',
        speaker: 'Meeting',
        confidence: 0.9,
        isFinal: true,
      },
    ];

    const analysis = generateLocalFastAnalysis(unnamedTaskSegments, 30);
    const task = analysis.actionItems[0];
    expect(task).toBeDefined();
    // Must NOT hallucinate an owner or deadline
    expect(task.owner).toBe("Not specified");
    expect(task.deadline).toBe("Not specified");
  });
});
