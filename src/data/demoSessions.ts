import { AudioSession } from '../types';

export const DEMO_SESSIONS: AudioSession[] = [
  {
    id: 'demo-1',
    title: 'AI Engineering Strategy & Real-time Audio Sync',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    durationSeconds: 184,
    audioSource: 'demo',
    status: 'completed',
    transcript: [
      { id: '1', timestamp: 0, text: "Good morning team. Today we're reviewing our strategy for building real-time browser audio streaming.", isFinal: true, speaker: 'Host' },
      { id: '2', timestamp: 8, text: "We need low-latency English speech recognition directly captured from the browser tab or microphone.", isFinal: true, speaker: 'Host' },
      { id: '3', timestamp: 18, text: "When the user clicks Start, we begin capturing audio streams and streaming live transcription to the UI in real time.", isFinal: true, speaker: 'Engineer A' },
      { id: '4', timestamp: 28, text: "And when they hit End, the Gemini 3.6 Flash model automatically processes the entire transcript payload.", isFinal: true, speaker: 'Engineer A' },
      { id: '5', timestamp: 40, text: "It generates executive summaries, key takeaways, topic breakdowns, and actionable task lists within seconds.", isFinal: true, speaker: 'Product Lead' },
      { id: '6', timestamp: 54, text: "Make sure we support browser tab audio via getDisplayMedia as well as microphone input for hybrid meetings.", isFinal: true, speaker: 'Product Lead' },
      { id: '7', timestamp: 68, text: "Also, we should include an interactive Q&A tab where users can ask Gemini questions directly about what was discussed.", isFinal: true, speaker: 'Host' },
      { id: '8', timestamp: 85, text: "That sounds like a great plan. Let me finalize the Express API endpoints for session analysis and Q&A.", isFinal: true, speaker: 'Engineer A' },
      { id: '9', timestamp: 102, text: "Great! Let's ship this live audio transcription extension interface and test the streaming performance.", isFinal: true, speaker: 'Host' },
    ],
    analysis: {
      title: 'AI Engineering Strategy & Real-time Audio Sync',
      summary: 'The team discussed the technical strategy and requirements for building a browser audio streaming extension. Key priorities include real-time English speech-to-text, dual audio input support (mic and tab audio), and automated AI analysis via Gemini 3.6 Flash upon ending the stream.',
      sentiment: 'Collaborative & Focused',
      wordCount: 148,
      keyTopics: [
        {
          topic: 'Real-time Audio Streaming Architecture',
          details: [
            'Capturing browser tab audio via getDisplayMedia and microphone input.',
            'Displaying instant English text stream with minimal latency.',
            'Triggering start and end audio session handlers.'
          ]
        },
        {
          topic: 'Gemini AI Note Generation',
          details: [
            'Automated execution of session analysis when recording ends.',
            'Extracting structured JSON summaries, key topics, action items, and sentiment.',
            'Providing interactive Q&A module for transcript interrogation.'
          ]
        }
      ],
      actionItems: [
        'Finalize Express API endpoints /api/analyze-session and /api/ask-session.',
        'Implement dual audio stream capture for both microphone and browser tab.',
        'Add interactive Q&A chat interface to query recorded transcripts.',
        'Ensure real-time wave visualizer works during active audio streaming.'
      ],
      keyTakeaways: [
        'Browser tab capture enables transcribing Zoom/Meet/YouTube audio directly.',
        'Gemini 3.6 Flash processes full meeting transcripts in under 2 seconds.',
        'Live streaming STT allows users to verify accuracy during active speaking.'
      ]
    }
  },
  {
    id: 'demo-2',
    title: 'Product Strategy & Customer Growth Review',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    durationSeconds: 245,
    audioSource: 'demo',
    status: 'completed',
    transcript: [
      { id: '101', timestamp: 0, text: "Welcome everyone to our monthly product growth and user feedback review.", isFinal: true, speaker: 'Sarah' },
      { id: '102', timestamp: 12, text: "Our monthly active user base grew by 28 percent following the launch of AI meeting note exports.", isFinal: true, speaker: 'Sarah' },
      { id: '103', timestamp: 25, text: "Users love being able to record lectures and podcast streams and instantly export structured markdown notes.", isFinal: true, speaker: 'Dave' },
      { id: '104', timestamp: 42, text: "However, several users requested better noise filtering when recording in noisy coffee shops.", isFinal: true, speaker: 'Dave' },
      { id: '105', timestamp: 60, text: "We should implement client-side audio gain normalization and Web Audio API filters.", isFinal: true, speaker: 'Alex' },
      { id: '106', timestamp: 80, text: "Agreed. Let's schedule the audio filtering enhancement for next week's sprint.", isFinal: true, speaker: 'Sarah' }
    ],
    analysis: {
      title: 'Product Strategy & Customer Growth Review',
      summary: 'Monthly review highlighting a 28% increase in active users due to AI meeting notes. User feedback identified a need for audio noise suppression during mobile recording.',
      sentiment: 'Optimistic & Data-Driven',
      wordCount: 95,
      keyTopics: [
        {
          topic: 'User Growth Metrics',
          details: [
            '28% increase in active monthly users post launch.',
            'High retention around structured Markdown exports.'
          ]
        },
        {
          topic: 'Feature Enhancements',
          details: [
            'Noise suppression needed for background audio.',
            'Web Audio API filters scheduled for upcoming sprint.'
          ]
        }
      ],
      actionItems: [
        'Implement Web Audio API noise filtering and gain controls.',
        'Add one-click Markdown and PDF export options.'
      ],
      keyTakeaways: [
        'AI notes export is the top retention feature for users.',
        'Audio quality preprocessing significantly improves speech accuracy.'
      ]
    }
  }
];
