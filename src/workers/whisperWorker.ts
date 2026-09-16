/**
 * Whisper Worker
 *
 * Runs local Whisper inference entirely inside a Web Worker using @xenova/transformers
 * (transformers.js), which executes the model as WebAssembly/ONNX on-device.
 *
 * Zero network calls per utterance, zero API tokens, works fully offline after the
 * one-time model download (cached by the browser). This is what makes system/meeting
 * audio transcription free and unlimited, instead of paying a cloud request per utterance.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from '@xenova/transformers';

// Always fetch models from the HF Hub/CDN (no bundled local model files).
env.allowLocalModels = false;

type LoadMessage = { type: 'load'; id: number; modelId: string };
type TranscribeMessage = {
  type: 'transcribe';
  id: number;
  modelId: string;
  whisperLanguage: string;
  audio: Float32Array;
};
type InboundMessage = LoadMessage | TranscribeMessage;

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let loadedModelId: string | null = null;
let loadingPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function getTranscriber(modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriber && loadedModelId === modelId) {
    return Promise.resolve(transcriber);
  }
  if (loadingPromise && loadedModelId === modelId) {
    return loadingPromise;
  }

  loadedModelId = modelId;
  loadingPromise = pipeline('automatic-speech-recognition', modelId, {
    quantized: true,
    progress_callback: (progress: any) => {
      self.postMessage({ type: 'progress', modelId, progress });
    },
  }).then((p) => {
    transcriber = p as AutomaticSpeechRecognitionPipeline;
    loadingPromise = null;
    return transcriber;
  });

  return loadingPromise;
}

self.onmessage = async (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  if (msg.type === 'load') {
    try {
      await getTranscriber(msg.modelId);
      self.postMessage({ type: 'ready', id: msg.id });
    } catch (err: any) {
      self.postMessage({ type: 'error', id: msg.id, error: err?.message || String(err) });
    }
    return;
  }

  if (msg.type === 'transcribe') {
    try {
      const model = await getTranscriber(msg.modelId);
      const output: any = await model(msg.audio, {
        language: msg.whisperLanguage,
        task: 'transcribe',
      });
      const text = Array.isArray(output) ? output.map((o) => o.text).join(' ') : output?.text || '';
      self.postMessage({ type: 'result', id: msg.id, text });
    } catch (err: any) {
      self.postMessage({ type: 'error', id: msg.id, error: err?.message || String(err) });
    }
  }
};
