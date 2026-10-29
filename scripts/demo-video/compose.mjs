import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  DEMO_DIR,
  NARRATION_DIR,
  OUTPUT_FILE,
  ROOT,
  VIDEO_DIR,
} from "./config.mjs";

const CLIPS_DIR = path.join(DEMO_DIR, "clips");

function run(command, args, label) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `${label || command} failed (${result.status}):\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
}

function probe(file) {
  const json = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=index,codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels",
    "-of",
    "json",
    file,
  ]);
  return JSON.parse(json);
}

function duration(file) {
  return Number(probe(file).format.duration);
}

function writeConcatList(file, entries) {
  const body = entries
    .map((entry) => `file '${entry.replaceAll("'", "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(file, `${body}\n`);
}

function main() {
  const narrationManifestFile = path.join(NARRATION_DIR, "manifest.json");
  const videoManifestFile = path.join(VIDEO_DIR, "manifest.json");
  for (const file of [narrationManifestFile, videoManifestFile]) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `Missing ${path.relative(process.cwd(), file)}. Run narration and recording first.`,
      );
    }
  }

  const narration = JSON.parse(
    fs.readFileSync(narrationManifestFile, "utf8"),
  );
  const video = JSON.parse(fs.readFileSync(videoManifestFile, "utf8"));
  const narrationById = new Map(
    narration.scenes.map((entry) => [entry.id, entry]),
  );
  const videoById = new Map(video.scenes.map((entry) => [entry.id, entry]));

  fs.rmSync(CLIPS_DIR, { recursive: true, force: true });
  fs.mkdirSync(CLIPS_DIR, { recursive: true });

  const audioFiles = [];
  const videoFiles = [];
  const scenes = [];

  console.log("[compose] building per-scene audio...");
  for (const [index, entry] of narration.scenes.entries()) {
    const videoEntry = videoById.get(entry.id);
    if (!videoEntry) throw new Error(`Missing video for scene ${entry.id}`);

    const narrationFile = path.join(NARRATION_DIR, path.basename(entry.file));
    const sceneAudio = path.join(CLIPS_DIR, `${entry.id}.wav`);
    const leadMs = Math.round(entry.leadSilence * 1000);

    run(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        narrationFile,
        "-af",
        `adelay=${leadMs}|${leadMs},apad=pad_dur=${entry.tailSilence}`,
        "-t",
        entry.sceneDuration.toFixed(3),
        "-ar",
        "48000",
        "-ac",
        "2",
        sceneAudio,
      ],
      `audio ${entry.id}`,
    );

    const last = index === narration.scenes.length - 1;
    const fadeIn = index === 0 ? 0.6 : 0.22;
    const fadeOut = last ? 0.8 : 0.22;
    const sceneVideo = path.join(CLIPS_DIR, `${entry.id}.mp4`);
    const fadeOutStart = Math.max(0, entry.sceneDuration - fadeOut);

    run(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        path.join(VIDEO_DIR, path.basename(videoEntry.file)),
        "-vf",
        [
          `trim=start=${videoEntry.trim}:duration=${entry.sceneDuration}`,
          "setpts=PTS-STARTPTS",
          "tpad=stop_mode=clone:stop_duration=2",
          "fps=30",
          "scale=1920:1080:flags=lanczos",
          "format=yuv420p",
          `fade=t=in:st=0:d=${fadeIn}`,
          `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut}`,
        ].join(","),
        "-t",
        entry.sceneDuration.toFixed(3),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        sceneVideo,
      ],
      `video ${entry.id}`,
    );

    audioFiles.push(sceneAudio);
    videoFiles.push(sceneVideo);
    scenes.push({
      id: entry.id,
      duration: entry.sceneDuration,
      audio: sceneAudio,
      video: sceneVideo,
    });

    console.log(
      `[compose] ${entry.id}: ${entry.sceneDuration.toFixed(2)}s (fade ${fadeIn}s / ${fadeOut}s)`,
    );
  }

  const total = scenes.reduce((sum, entry) => sum + entry.duration, 0);

  console.log("[compose] joining narration...");
  const audioList = path.join(CLIPS_DIR, "audio-list.txt");
  writeConcatList(audioList, audioFiles);
  const joinedAudio = path.join(CLIPS_DIR, "narration.wav");
  run(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      audioList,
      "-c",
      "copy",
      joinedAudio,
    ],
    "audio concat",
  );

  const joinedDuration = duration(joinedAudio);
  console.log(
    `[compose] narration ${joinedDuration.toFixed(2)}s / video target ${total.toFixed(2)}s`,
  );

  const normalizedAudio = path.join(CLIPS_DIR, "narration-normalized.wav");
  run(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      joinedAudio,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-ar",
      "48000",
      "-ac",
      "2",
      normalizedAudio,
    ],
    "audio loudnorm",
  );

  let finalAudio = normalizedAudio;
  const normalizedDuration = duration(normalizedAudio);
  if (Math.abs(normalizedDuration - joinedDuration) > 0.12) {
    console.warn(
      `[compose] loudnorm changed duration by ${(normalizedDuration - joinedDuration).toFixed(2)}s; using static gain`,
    );
    finalAudio = path.join(CLIPS_DIR, "narration-gain.wav");
    run(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        joinedAudio,
        "-af",
        "volume=2.5dB,alimiter=limit=0.98",
        "-ar",
        "48000",
        "-ac",
        "2",
        finalAudio,
      ],
      "audio gain",
    );
  }

  console.log("[compose] joining video...");
  const videoList = path.join(CLIPS_DIR, "video-list.txt");
  writeConcatList(videoList, videoFiles);
  const silentVideo = path.join(CLIPS_DIR, "video-silent.mp4");
  run(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      videoList,
      "-c",
      "copy",
      silentVideo,
    ],
    "video concat",
  );

  console.log("[compose] muxing final video...");
  run(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      silentVideo,
      "-i",
      finalAudio,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-shortest",
      "-movflags",
      "+faststart",
      "-metadata",
      "title=Odysseus — Autonomous SSI Index-Deviation Agent",
      "-metadata",
      "comment=Demo generated with Playwright, edge-tts, and FFmpeg",
      OUTPUT_FILE,
    ],
    "final mux",
  );

  const info = probe(OUTPUT_FILE);
  const finalDuration = Number(info.format.duration);
  const sizeMb = Number(info.format.size) / 1024 / 1024;
  const videoStream = info.streams.find((s) => s.codec_type === "video");
  const audioStream = info.streams.find((s) => s.codec_type === "audio");

  console.log("");
  console.log("=== demo video ===");
  console.log(`file:     ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`duration: ${finalDuration.toFixed(2)}s`);
  console.log(
    `video:    ${videoStream.codec_name} ${videoStream.width}x${videoStream.height} @ ${videoStream.avg_frame_rate}`,
  );
  console.log(
    `audio:    ${audioStream.codec_name} ${audioStream.sample_rate}Hz ${audioStream.channels}ch`,
  );
  console.log(`size:     ${sizeMb.toFixed(1)} MB`);
  console.log(
    `scene runtime: ${scenes.map((s) => `${s.id}=${s.duration.toFixed(1)}s`).join(", ")}`,
  );
}

main();
