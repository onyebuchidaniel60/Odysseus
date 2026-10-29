import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  LEAD_SILENCE,
  NARRATION_DIR,
  SCENES,
  TAIL_SILENCE,
  VOICE,
  VOICE_PITCH,
  VOICE_RATE,
} from "./config.mjs";

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed (${result.status}): ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function probeDuration(file) {
  const value = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration for ${file}`);
  }
  return duration;
}

function main() {
  const which = spawnSync("edge-tts", ["--version"], { encoding: "utf8" });
  if (which.status !== 0) {
    console.error(
      "edge-tts is not installed. Run:\n  python3 -m pip install --break-system-packages edge-tts",
    );
    process.exit(1);
  }

  fs.mkdirSync(NARRATION_DIR, { recursive: true });

  const manifest = {
    voice: VOICE,
    rate: VOICE_RATE,
    pitch: VOICE_PITCH,
    generatedAt: new Date().toISOString(),
    scenes: [],
  };

  for (const scene of SCENES) {
    const file = path.join(NARRATION_DIR, `${scene.id}.mp3`);
    console.log(`[tts] ${scene.id} (${scene.narration.length} chars)`);
    run("edge-tts", [
      "--voice",
      VOICE,
      `--rate=${VOICE_RATE}`,
      `--pitch=${VOICE_PITCH}`,
      "--text",
      scene.narration,
      "--write-media",
      file,
    ]);

    const narrationDuration = probeDuration(file);
    const sceneDuration =
      LEAD_SILENCE + narrationDuration + TAIL_SILENCE;

    manifest.scenes.push({
      id: scene.id,
      text: scene.narration,
      file: path.relative(path.dirname(NARRATION_DIR), file),
      narrationDuration: Number(narrationDuration.toFixed(3)),
      leadSilence: LEAD_SILENCE,
      tailSilence: TAIL_SILENCE,
      sceneDuration: Number(sceneDuration.toFixed(3)),
    });

    console.log(
      `[tts] ${scene.id}: narration ${narrationDuration.toFixed(2)}s, scene ${sceneDuration.toFixed(2)}s`,
    );
  }

  const manifestFile = path.join(NARRATION_DIR, "manifest.json");
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const total = manifest.scenes.reduce((sum, s) => sum + s.sceneDuration, 0);
  console.log(`[tts] total runtime ${total.toFixed(1)}s`);
  console.log(`[tts] wrote ${path.relative(process.cwd(), manifestFile)}`);
}

main();
