#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  DEMO_DIR,
  DEMO_REPLAY_RUN_ID,
  DEMO_RUN_ID,
  LOCAL_URL,
  NARRATION_DIR,
  OUTPUT_FILE,
  ROOT,
  SCENES,
  VIDEO_DIR,
  VOICE,
  VOICE_PITCH,
  VOICE_RATE,
} from "./config.mjs";

const FLAGS = new Set(
  process.argv.slice(2).filter((argument) => argument.startsWith("--")),
);
const SKIP_NARRATION = FLAGS.has("--skip-narration");
const SKIP_RECORD = FLAGS.has("--skip-record");
const SKIP_COMPOSE = FLAGS.has("--skip-compose");
const FORCE = FLAGS.has("--force");
const NO_START = FLAGS.has("--no-start");
const KEEP_SERVER = FLAGS.has("--keep-server");

const SERVER_LOG = path.join(VIDEO_DIR, "server.log");
const MIN_DURATION = 120;
const MAX_DURATION = 180;

let startedServer = null;

function step(message) {
  console.log("");
  console.log(`== ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function run(command, args, { cwd = ROOT } = {}) {
  const result = spawnSync(command, args, {
    cwd,
   stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0;
}

function probe(file) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=codec_type,codec_name,width,height,sample_rate,channels",
      "-of",
      "json",
      file,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) fail(`ffprobe failed for ${file}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function waitForServer(timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${LOCAL_URL}/dashboard`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`Timed out waiting for ${LOCAL_URL}/dashboard`);
}

async function ensureServer() {
  step("local production server");

  let online = false;
  try {
    const response = await fetch(`${LOCAL_URL}/dashboard`, {
      signal: AbortSignal.timeout(3000),
    });
    online = response.ok;
  } catch {
    online = false;
  }

  if (online) {
    console.log(`[run] using existing server at ${LOCAL_URL}`);
    return;
  }

  if (NO_START) {
    fail(
      `No server at ${LOCAL_URL}. Start it with \`npm run build && npm start\` or omit --no-start.`,
    );
  }

  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    step("production build");
    run("npm", ["run", "build"]);
  }

  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  const log = fs.openSync(SERVER_LOG, "a");
  console.log(`[run] starting \`npm start\` (log: ${path.relative(ROOT, SERVER_LOG)})`);
  startedServer = spawn("npm", ["start"], {
    cwd: ROOT,
    detached: false,
    stdio: ["ignore", log, log],
    env: process.env,
  });

  startedServer.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[run] server exited with ${code}`);
    }
  });

  await waitForServer();
  console.log(`[run] server ready at ${LOCAL_URL}`);
}

function stopServer() {
  if (!startedServer || KEEP_SERVER) return;
  if (!startedServer.killed) startedServer.kill("SIGTERM");
  startedServer = null;
}

async function fetchRun(id) {
  const response = await fetch(`${LOCAL_URL}/api/runs/${id}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    fail(`GET /api/runs/${id} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function validateDemoData() {
  step("demo data");

  const run = await fetchRun(DEMO_RUN_ID);
  const decision = run.decision?.finalDecision;
  const execution = run.execution;
  const legs = execution?.legs ?? [];
  const perpsLeg = legs.find((leg) => leg.mode === "live");
  const spotLeg = legs.find((leg) => leg.mode === "paper");

  if (decision !== "SHORT") {
    fail(
      `Demo run ${DEMO_RUN_ID} has decision ${decision ?? "missing"}; expected SHORT.`,
    );
  }
  if (execution?.executionMode !== "PAPER_SPOT") {
    fail(
      `Demo run ${DEMO_RUN_ID} has executionMode ${execution?.executionMode ?? "missing"}; expected PAPER_SPOT.`,
    );
  }
  if (!perpsLeg || !/^\d{6,}$/.test(String(perpsLeg.orderId ?? ""))) {
    fail(`Demo run ${DEMO_RUN_ID} has no real perps order id.`);
  }
  if (!spotLeg || !String(spotLeg.orderId ?? "").startsWith("paper_spot_")) {
    fail(`Demo run ${DEMO_RUN_ID} has no paper spot order id.`);
  }

  const replay = await fetchRun(DEMO_REPLAY_RUN_ID);
  if (replay.decision?.finalDecision !== "SHORT") {
    fail(
      `Replay run ${DEMO_REPLAY_RUN_ID} has decision ${replay.decision?.finalDecision ?? "missing"}; expected SHORT.`,
    );
  }

  console.log(
    `[run] execution run ${DEMO_RUN_ID.slice(0, 8)}: SHORT · perps ${perpsLeg.orderId} · ${execution.executionMode}`,
  );
  console.log(
    `[run] replay run ${DEMO_REPLAY_RUN_ID.slice(0, 8)}: SHORT · ${replay.execution?.executionMode ?? "MOCK"}`,
  );
}

function narrationIsCurrent() {
  const manifestFile = path.join(NARRATION_DIR, "manifest.json");
  if (!fs.existsSync(manifestFile)) return false;

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  } catch {
    return false;
  }

  if (
    manifest.voice !== VOICE ||
    manifest.rate !== VOICE_RATE ||
    manifest.pitch !== VOICE_PITCH
  ) {
    return false;
  }
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length !== SCENES.length) {
    return false;
  }

  return SCENES.every((scene, index) => {
    const entry = manifest.scenes[index];
    if (!entry || entry.id !== scene.id || entry.text !== scene.narration) {
      return false;
    }
    return fs.existsSync(path.join(NARRATION_DIR, path.basename(entry.file)));
  });
}

function ensureNarration() {
  step("narration");

  if (!commandExists("edge-tts")) {
    fail(
      "edge-tts is missing. Install it with:\n  python3 -m pip install --break-system-packages edge-tts",
    );
  }

  if (!FORCE && narrationIsCurrent()) {
    console.log("[run] narration manifest matches the current script");
    return;
  }

  if (SKIP_NARRATION) {
    fail(
      "Narration is missing or stale. Re-run without --skip-narration, or delete the flag after regenerating.",
    );
  }

  run("node", [path.join(ROOT, "scripts", "demo-video", "generate-narration.mjs")]);
}

function ensureRecorded() {
  step("screen recording");

  if (SKIP_RECORD) {
    if (!fs.existsSync(path.join(VIDEO_DIR, "manifest.json"))) {
      fail("--skip-record was passed but demo/video/manifest.json is missing.");
    }
    console.log("[run] keeping existing recording");
    return;
  }

  run("node", [path.join(ROOT, "scripts", "demo-video", "record.mjs")]);
}

function ensureComposed() {
  step("composition");

  if (SKIP_COMPOSE) {
    if (!fs.existsSync(OUTPUT_FILE)) {
      fail("--skip-compose was passed but odysseus-demo.mp4 is missing.");
    }
    console.log("[run] keeping existing odysseus-demo.mp4");
    return;
  }

  run("node", [path.join(ROOT, "scripts", "demo-video", "compose.mjs")]);
}

function verifyOutput() {
  step("verification");

  if (!fs.existsSync(OUTPUT_FILE)) fail("odysseus-demo.mp4 was not created.");

  const info = probe(OUTPUT_FILE);
  const seconds = Number(info.format.duration);
  const video = info.streams.find((stream) => stream.codec_type === "video");
  const audio = info.streams.find((stream) => stream.codec_type === "audio");
  const megabytes = Number(info.format.size) / 1024 / 1024;

  if (seconds < MIN_DURATION) {
    fail(
      `Video is ${seconds.toFixed(1)}s; the brief asks for 2–3 minutes (>= ${MIN_DURATION}s).`,
    );
  }
  if (seconds > MAX_DURATION) {
    fail(`Video is ${seconds.toFixed(1)}s; the brief asks for under 3 minutes.`);
  }
  if (!video || !audio) fail("Final file is missing a video or audio stream.");
  if (video.width !== 1920 || video.height !== 1080) {
    fail(`Unexpected video size ${video.width}x${video.height}.`);
  }

  console.log(
    `[run] ${path.relative(ROOT, OUTPUT_FILE)} · ${seconds.toFixed(1)}s · ${video.codec_name} ${video.width}x${video.height} · ${audio.codec_name} ${audio.sample_rate}Hz ${audio.channels}ch · ${megabytes.toFixed(1)} MB`,
  );
}

async function main() {
  step("preflight");
  for (const [command, args] of [
    ["ffmpeg", ["-version"]],
    ["ffprobe", ["-version"]],
    ["node", ["--version"]],
  ]) {
    if (!commandExists(command, args)) fail(`${command} is not installed.`);
  }
  const chromium = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      "import('playwright').then(({chromium}) => console.log(chromium.executablePath()))",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (chromium.status !== 0) {
    fail("Playwright is not installed. Run `npm install` first.");
  }
  const browserPath = chromium.stdout.trim().split("\n").pop();
  if (!browserPath || !fs.existsSync(browserPath)) {
    fail(
      "Playwright Chromium is missing. Run `npx playwright install chromium`.",
    );
  }
  console.log("[run] ffmpeg, ffprobe, node, and Playwright Chromium are available");

  await ensureServer();
  try {
    await validateDemoData();
    ensureNarration();
    ensureRecorded();
    ensureComposed();
    verifyOutput();
  } finally {
    stopServer();
  }

  step("done");
  console.log(`[run] ${path.relative(ROOT, OUTPUT_FILE)} is ready`);
  console.log(`[run] source clips: ${path.relative(ROOT, path.join(DEMO_DIR, "video"))}`);
}

main().catch((error) => {
  stopServer();
  console.error("");
  console.error(`[run] FAILED: ${error.message}`);
  process.exit(1);
});
