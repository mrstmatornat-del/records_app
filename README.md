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
  (`src/utils/vad.ts`) and transcribed by a real local Whisper model
  (`@xenova/transformers`, running on the `onnxruntime-node` backend) — but
  the inference itself runs **inside this app's own Express server**
  (`server/localWhisperEngine.ts`, called via `/api/stt/transcribe-local`),
  not in the browser tab. The client side is just
  `src/services/stt/LocalServerWhisperEngine.ts`, a thin same-origin
  `fetch('/api/stt/transcribe-local')` call — structurally identical to how
  `/api/analyze-session` already works. The model (tiny/base/small, or the
  `.en`-suffixed English-only checkpoint, picked by
  `src/utils/hardwareDetector.ts` based on CPU/RAM/GPU) downloads once from
  the Hugging Face CDN and is cached on disk — fully offline and free after
  that. Verified end-to-end with a local smoke test: cold start (model
  download + load) ~28s, warm start (model cached on disk) ~4s for a 2s
  utterance on the `tiny` model on CPU.

  **Why server-side and not an in-browser Worker:** an earlier version of
  this ran Whisper directly in the browser via a Web Worker fetching model
  weights straight from huggingface.co/jsdelivr. That's simpler in principle,
  but this app is frequently *previewed inside a sandboxed host iframe*
  (e.g. Google AI Studio's preview pane) or loaded via `file://` in a
  packaged Electron build — both can silently block a page from creating
  Web Workers or fetching a third-party CDN, with no visible error beyond a
  vague "unavailable" status. Routing through the app's own same-origin
  server sidesteps that whole class of hosting-dependent failure, since it's
  no different from any other `/api/*` call the app already makes reliably.

  This also replaced an even earlier design where every VAD utterance was
  POSTed to `server.ts` and transcribed by the **Gemini cloud API**. That was
  both wasteful (a paid/quota-limited call for every few seconds of speech)
  and fragile (fails outright with no `GEMINI_API_KEY`, or after Gemini's
  free-tier quota — ~20 requests/day — is exhausted, which happens within
  minutes of any real meeting or video). Live transcription now has zero
  dependency on `GEMINI_API_KEY` or any cloud quota; Gemini is called only
  once per meeting, for the summary.

Both paths feed into `src/services/TranscriptReconciler.ts` (via
`TranscriptEventBus`), which is the single source of truth for what's
"canonical" transcript vs. live interim preview.

If system-audio transcription still doesn't produce any text, check (in
rough order of likelihood):
1. The STT status banner in the Live Transcript panel (hover it for the full
   error) and the server's console output for `/api/stt/transcribe-local`
   errors.
2. Whether the machine running `server.ts` had internet access on the very
   first attempt (needed once, to download the model from Hugging Face).
3. Whether VAD is even firing for the system stream — the energy threshold
   (`src/services/LocalSTTService.ts`, `systemVAD`) may need tuning further
   down for very quiet tab/system audio.

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
- Absorbs a *stale, shorter* final result that arrives **after** a longer one
  is already committed (e.g. Chrome's Web Speech API restarting recognition
  mid-utterance and briefly re-emitting an earlier or trailing fragment as
  its own final result) instead of appending it as a spurious extra line.
  This was a real gap: the original merge logic only handled the *growing*
  direction (each new result extends the last one) and silently fell through
  to "create a new segment" whenever a same-or-shorter result arrived
  out of order — which is exactly what a recognizer restart produces.

This is covered by `tests/transcriptReconciler.test.ts` (12 cases, including
the exact "I have a cat" growth pattern and the out-of-order/restart case)
and `tests/systemAudioSTTPipeline.test.ts`. If you're still seeing duplicated
lines, you're almost certainly running a stale build — `npm run build` and
reload.

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
4. The machine running `server.ts` needs internet access the first time
   system-audio transcription runs, to download the Whisper model from
   Hugging Face (cached on disk afterwards — see
   `server/localWhisperEngine.ts`).
5. Server-side inference means system-audio STT throughput is bounded by the
   host machine's CPU and is processed one utterance at a time
   (`LocalSTTService`'s existing queue) — fine for a single local user, but
   not designed to scale to concurrent multi-user transcription.
