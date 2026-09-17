/**
 * Server-side local Whisper inference (Node), via @xenova/transformers running
 * on the onnxruntime-node backend.
 *
 * Why server-side instead of an in-browser Worker: this app is often previewed
 * inside a sandboxed host iframe (e.g. AI Studio's preview pane) or loaded via
 * file:// in the packaged Electron build. Both environments can silently block
 * a page from creating Web Workers or fetching model weights from a
 * third-party CDN (huggingface.co / jsdelivr) due to CSP/sandbox restrictions
 * outside the app's control. Running inference in this Node process instead
 * reuses the same same-origin `/api/*` pattern the rest of the app already
 * relies on (analyze-session, ask-session, etc.), so it works identically
 * regardless of how the front-end happens to be hosted. The model still runs
 * entirely on the user's own machine — no cloud API, no per-utterance token
 * cost. Gemini remains reserved for the one-shot end-of-meeting summary/Q&A.
 */
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";

env.allowLocalModels = false;

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let loadedModelId: string | null = null;
let loadingPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

export type WhisperModelSize = "tiny" | "base" | "small";

export function resolveWhisperModel(language: string, modelSize: WhisperModelSize) {
  const isVietnamese = language.startsWith("vi");
  return {
    modelId: isVietnamese ? `Xenova/whisper-${modelSize}` : `Xenova/whisper-${modelSize}.en`,
    whisperLanguage: isVietnamese ? "vietnamese" : "english",
  };
}

function getTranscriber(modelId: string): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriber && loadedModelId === modelId) {
    return Promise.resolve(transcriber);
  }
  if (loadingPromise && loadedModelId === modelId) {
    return loadingPromise;
  }

  loadedModelId = modelId;
  loadingPromise = pipeline("automatic-speech-recognition", modelId, {
    quantized: true,
  }).then((p) => {
    transcriber = p as AutomaticSpeechRecognitionPipeline;
    loadingPromise = null;
    return transcriber;
  });

  return loadingPromise;
}

// Common Whisper hallucinations on silence/music-only audio (a well-known
// artifact of Whisper being trained on YouTube caption data).
const HALLUCINATION_PATTERN =
  /^[\s.,!?]*(thanks? for watching|thank you( so much)?( for watching)?|please (subscribe|like)( and subscribe)?|bye( bye)?|\[?(blank_audio|music|silence|no speech|inaudible)\]?|you)[\s.,!?]*$/i;

export async function transcribeLocalPcm(
  pcmBuffer: Buffer,
  language: string,
  modelSize: WhisperModelSize
): Promise<string> {
  const { modelId, whisperLanguage } = resolveWhisperModel(language, modelSize);
  const model = await getTranscriber(modelId);

  // Whisper expects 16kHz mono Float32 samples in [-1, 1].
  const sampleCount = pcmBuffer.length / 2;
  const audio = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    audio[i] = pcmBuffer.readInt16LE(i * 2) / 32768;
  }

  const output: any = await model(audio, {
    language: whisperLanguage,
    task: "transcribe",
  });
  const text = Array.isArray(output) ? output.map((o) => o.text).join(" ") : output?.text || "";

  const cleaned = (text || "").trim();
  if (!cleaned || HALLUCINATION_PATTERN.test(cleaned)) {
    return "";
  }
  return cleaned;
}
