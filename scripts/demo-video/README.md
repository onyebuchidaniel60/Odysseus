# Odysseus demo video

Fully automated pipeline for `odysseus-demo.mp4`: text-to-speech narration,
Playwright screen recording, and FFmpeg composition. No manual screen capture
and no manual voiceover.

```bash
npm run demo:video
```

The command checks the toolchain and demo data, starts the production server if
needed, regenerates narration when the script changes, records the five scenes,
and writes the final file at the repository root.

## Output

| Property | Value |
| --- | --- |
| File | `odysseus-demo.mp4` |
| Length | 2–3 minutes (enforced by `run.mjs`) |
| Video | H.264, 1920×1080, 30 fps, CRF 20 |
| Audio | AAC, 48 kHz stereo, 192 kbps, loudness-normalised |
| Scenes | Landing, pipeline, debate, execution, replay |

## Prerequisites

```bash
# system tools
ffmpeg -version
ffprobe -version

# narrator
python3 -m pip install --break-system-packages edge-tts
edge-tts --version

# browser recording
npm install
npx playwright install chromium
```

The console scenes read the persisted demo runs from the local PostgreSQL
database. `.env.local` must point `DATABASE_URL` at that database.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run demo:video` | Full pipeline |
| `npm run demo:narration` | Regenerate the five MP3s and `demo/narration/manifest.json` |
| `npm run demo:record` | Record the five browser scenes to `demo/video/` |
| `npm run demo:compose` | Join the clips and mux the final MP4 |

Useful flags for `scripts/demo-video/run.mjs`:

```bash
node scripts/demo-video/run.mjs --force            # redo narration even if current
node scripts/demo-video/run.mjs --skip-narration   # reuse current audio
node scripts/demo-video/run.mjs --skip-record      # reuse current browser clips
node scripts/demo-video/run.mjs --skip-compose     # stop before FFmpeg
node scripts/demo-video/run.mjs --no-start         # require an already-running server
node scripts/demo-video/run.mjs --keep-server      # leave the server running
```

## How the video is produced

1. **Narration** — `edge-tts` renders `en-US-AndrewNeural` at `-2%` rate and
   `-1Hz` pitch. Scene duration is derived from the audio length plus a short
   lead-in and tail, so the visuals never outrun the voice.
2. **Recording** — Playwright opens a 1920×1080 Chromium context per scene,
   injects a minimal EIP-1193 wallet, a visible cursor with click ripples,
   lower-third captions, highlight rings, an execution spotlight, and a final
   end card. All of that is injected at runtime; the application code is
   untouched.
3. **Composition** — FFmpeg trims each recording to its audio-derived duration,
   adds short fades, concatenates the scenes, normalises loudness, and muxes
   H.264 video with AAC audio.

## Data used in the video

| Scene | Source |
| --- | --- |
| 01 Landing | Live deployment, `https://odysseus-self.vercel.app` |
| 02–05 Console | The same production build served at `http://localhost:3000` |

The console scenes show the persisted execution run
`64c1368c-2bee-4172-9575-7c2c53fb0499`:

- HYPE z-score `+2.576`, Chief decision `SHORT`
- deterministic risk approval of `$10`
- real SoDEX testnet HYPE perps order `3155812057`
- explicit testnet paper spot hedge
  `paper_spot_49580e3c-9bb8-41bd-9649-549a1ff39974`
- `executionMode = "PAPER_SPOT"`

The replay scene shows `a2520e22-28a0-4e05-84b9-35e9274f2e4e`, a real replay
of the same snapshot with `MOCK` execution.

### Why the live site is only used for the landing scene

The Vercel deployment currently contains only a `NO_TRADE` run
(`1514e254-007d-47a5-8566-225a6c01ffd0`). The real `SHORT` execution run was
created against the local PostgreSQL database and cannot be pushed to the
production database from this environment. The landing page is recorded live;
the console scenes are recorded from the identical production build against the
persisted local run. The video is honest about what each leg is: the perps fill
is real testnet execution, the spot hedge is explicitly labelled `PAPER SPOT`.

### Route stubs

During recording, Playwright intercepts two write endpoints:

- `POST /api/run` returns the existing run `64c1368c-...`
- `POST /api/run/replay` returns the existing replay `a2520e22-...`

This makes the "Run Pipeline" and "Replay" clicks deterministic and avoids
placing a new testnet order every time the demo is rendered. Every number shown
on screen still comes from the persisted runs; only the write calls are stubbed.
All other requests go to the local production server.

## Rebuilding the demo data

The video expects the local database to contain the two run IDs above. They were
created with:

```dotenv
MOCK_SODEX=false
FORCE_DEMO_TRADE=true
ALLOW_PAPER_SPOT=true
```

then one authorized `POST /api/run` and one `POST /api/run/replay` for the same
snapshot. Do not run that pipeline while recording; it can place another real
testnet order. If the runs are missing, restore the database backup or recreate
them before running `npm run demo:video`. The pre-demo backup made for this
recording is at:

```text
/tmp/opencode/odysseus-demo-backup/pre-demo.dump
```

## Troubleshooting

- **`Video is ...s; the brief asks for 2–3 minutes`** — narration changed and
  the manifest is stale. Run with `--force`, or check the scene text in
  `config.mjs`.
- **`No server at http://localhost:3000`** — run `npm run build && npm start`,
  or omit `--no-start` so the orchestrator starts it.
- **Wallet button stays disconnected** — the injected provider is installed by
  `browser.mjs`; make sure the recording uses `record.mjs`, not a plain
  Playwright script.
- **First frames are grey** — `recordVideo.size` must match the viewport exactly
  (1920×1080). The recorder applies a 0.5 s trim to hide browser startup.
- **Missing font** — the UI uses local fallbacks; no external font download is
  required.

## Files

```text
scripts/demo-video/
  config.mjs              scene text, URLs, run IDs, pacing
  generate-narration.mjs  edge-tts + duration manifest
  browser.mjs             wallet, cursor, captions, highlights, end card
  record.mjs              Playwright storyboard
  compose.mjs             FFmpeg assembly and final mux
  run.mjs                 orchestrator
demo/narration/           MP3s + manifest.json
demo/video/               per-scene WebM + record manifest
demo/clips/               intermediate audio/video (regenerated)
odysseus-demo.mp4         final deliverable
```
