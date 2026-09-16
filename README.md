# StreamNote AI — Windows Meeting Recorder & Transcriber

Electron/browser app that records microphone + system ("meeting") audio side by
side, live-transcribes both into a single reconciled transcript, and generates
an AI meeting summary (decisions, action items, risks, Q&A) at the end.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000 (Vite + Express, dev mode)
npm run build    # production build (vite build + bundles server.ts)
npm start        # run the production build
npm test         # vitest unit tests
```

For the desktop shell: `electron/main.ts` loads the same web app inside a
BrowserWindow (`npm run dev` for localhost:3000 in dev, `dist/index.html` in
production).

### Environment variables

Create a `.env` file at the project root:

```
GEMINI_API_KEY=your-key-here
```

Get a free key at https://aistudio.google.com/apikey. This key is used **only**
for the one-shot end-of-meeting AI summary and the post-meeting Q&A chat
(`/api/analyze-session`, `/api/ask-session` in `server.ts`). It is **not**
required for live transcription — see below.

## Architecture

### Audio capture — `src/services/AudioCaptureService.ts`

Two independent pipelines, never cross-connected to speakers (zero echo):

- **Microphone**: `getUserMedia`.
- **System/meeting audio**: `getDisplayMedia` with "share audio" checked
  (browser fallback). `src/services/native/WindowsAudioCapture.ts` and
  `native/wasapi_loopback.cc` scaffold a *real* Windows WASAPI loopback path
  for the Electron shell, but **it is not wired up** — `electron/main.ts`'s
  `audio:start-loopback` IPC handler is a stub that logs and returns `ok`
  without capturing any audio, and there's no `session.setDisplayMediaRequestHandler`
  registered, which `getDisplayMedia` requires inside an Electron `BrowserWindow`
  (Electron 20+). In practice, system audio capture today only works when the
  app runs in an actual browser tab and the user picks the tab/screen with
  "share audio" enabled. Implementing true OS-wide WASAPI loopback in the
  Electron shell is the natural next step but is a separate, sizeable piece of
  work (native addon build pipeline, IPC audio streaming, no picker dialog).

Each pipeline also downsamples to 16kHz mono PCM16 for STT (`audioUtils.ts`).

### Live speech-to-text — fully local, zero per-utterance API cost

- **Microphone**: the browser's built-in Web Speech API
  (`window.SpeechRecognition`), which is free, instant, and needs no server.
- **System/meeting audio**: sliced into utterances by VAD
  (`src/utils/vad.ts`) and transcribed by **`src/services/stt/BrowserWhisperEngine.ts`**
  — a real local Whisper model (`@xenova/transformers`, WebAssembly/ONNX)
  running in a Web Worker (`src/workers/whisperWorker.ts`). The model
  downloads once from the Hugging Face CDN (tiny/base/small, picked by
  `src/utils/hardwareDetector.ts` based on CPU/RAM/GPU) and is then cached by
  the browser — fully offline and free after that.

  This replaced an earlier design where every VAD utterance was POSTed to
  `server.ts` and transcribed by the Gemini cloud API. That was both wasteful
  (a network round trip + a paid/quota-limited call for every few seconds of
  speech) and fragile (fails outright with no `GEMINI_API_KEY`, or after
  Gemini's free-tier quota — ~20 requests/day — is exhausted, which happens
  within minutes of any real meeting or video). If you don't see any
  transcript at all in older builds of this app for system audio while mic
  transcription works fine, that mismatch is why — recording and
  transcription are separate pipelines, and only the STT half depended on the
  cloud key.

Both paths feed into `src/services/TranscriptReconciler.ts` (via
`TranscriptEventBus`), which is the single source of truth for what's
"canonical" transcript vs. live interim preview.

### Deduplication — `src/services/TranscriptReconciler.ts` + `src/utils/transcriptNormalization.ts`

Streaming STT naturally emits growing partial hypotheses ("I have a" → "I
have a cat" → "I have a cat, something very huge"). The reconciler:

- Never commits interim (non-final) results to the canonical transcript.
- Collapses exact/substantially-identical duplicates.
- Detects when a new final result is a normalized *prefix extension* of the
  last committed segment and replaces it in place, instead of appending a
  second line.
- Detects suffix/prefix token overlap across utterance boundaries and merges
  only the non-overlapping tail.
- Deliberately preserves genuine human repetition ("really really", "No, no,
  no...") — it only collapses duplication that's an artifact of incremental
  recognition, not repeated words a person actually said.
- Keeps microphone ("Me") and system ("Meeting") streams independent, so
  identical phrases from different speakers are never merged into one.

This is covered by `tests/transcriptReconciler.test.ts` (10 cases, including
the exact "I have a cat" growth pattern) and `tests/systemAudioSTTPipeline.test.ts`.
If you're still seeing duplicated lines, you're almost certainly running a
stale build — `npm run build` and reload.

There used to be a second, older transcription code path
(`src/utils/audioStreamer.ts` — `AudioStreamManager`) that pushed every
interim *and* final Web Speech result straight into the transcript with no
merging at all, which is what produced the duplicate-line behavior. It was
already dead code (nothing imported it) and has been deleted.

### Post-meeting AI — `server.ts`

`/api/analyze-session` (structured summary: decisions, action items, risks,
open questions) and `/api/ask-session` (Q&A over the transcript) call Gemini
once per action, not per utterance. Both also support a local Ollama backend
as an alternative (`engineType: "local-ollama"`).

## Known limitations / good next steps

1. **No real native WASAPI loopback yet** — see above. Needed for true
   system-wide audio capture without a screen-share picker.
2. **`getDisplayMedia` inside Electron** needs
   `session.setDisplayMediaRequestHandler` registered in `electron/main.ts`,
   or it will fail to prompt at all when running as a packaged desktop app.
3. Local Whisper model choice is fixed to tiny/base/small `.en` or
   multilingual checkpoints based on `hardwareDetector.ts`; there's no manual
   override in the UI yet.
4. First run of system-audio transcription requires an internet connection to
   download the Whisper model (cached afterwards).
