import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, "../..");
export const DEMO_DIR = path.join(ROOT, "demo");
export const NARRATION_DIR = path.join(DEMO_DIR, "narration");
export const VIDEO_DIR = path.join(DEMO_DIR, "video");
export const OUTPUT_FILE = path.join(ROOT, "odysseus-demo.mp4");

/**
 * The landing page is recorded from the live deployment. The console scenes are
 * recorded from the same production build served locally against the persisted
 * demo database (see scripts/demo-video/README.md for why).
 */
export const LIVE_URL = process.env.DEMO_LIVE_URL ?? "https://odysseus-self.vercel.app";
export const LOCAL_URL = process.env.DEMO_LOCAL_URL ?? "http://localhost:3000";

/** Operator wallet used by the injected EIP-1193 wallet during recording. */
export const OPERATOR_ADDRESS =
  process.env.DEMO_OPERATOR_ADDRESS ??
  "0x69461740214a68d34157b3A14f513fA47f9a08E0";

/** Persisted demo run: real HYPE perps short + explicit paper spot hedge. */
export const DEMO_RUN_ID = "64c1368c-2bee-4172-9575-7c2c53fb0499";
export const DEMO_REPLAY_RUN_ID = "a2520e22-28a0-4e05-84b9-35e9274f2e4e";

export const VOICE = process.env.DEMO_VOICE ?? "en-US-AndrewNeural";
export const VOICE_RATE = process.env.DEMO_VOICE_RATE ?? "-2%";
export const VOICE_PITCH = process.env.DEMO_VOICE_PITCH ?? "-1Hz";

/** Audio-first pacing: each scene lasts lead + narration + tail. */
export const LEAD_SILENCE = 0.6;
export const TAIL_SILENCE = 0.8;

/** Time spent after network idle before the first scripted beat. */
export const PRE_ROLL_SECONDS = 2.2;

export const SCENES = [
  {
    id: "01-landing",
    url: "live",
    kicker: "01 / OVERVIEW",
    title: "Autonomous SSI index-deviation agent",
    narration: [
      "This is Odysseus.",
      "It is an autonomous SSI index-deviation agent built for on-chain fund operators.",
      "It acts as a self-contained fund manager that identifies mispriced deviations in SoSoValue indexes and executes relative-value trades on SoDEX.",
      "It is built for teams that value discipline, not prediction.",
      "The key is that it is built to say no trade by default.",
    ].join(" "),
  },
  {
    id: "02-dashboard",
    url: "local/dashboard",
    kicker: "02 / PIPELINE",
    title: "SoSoValue data → validation → z-scores",
    narration: [
      "Let's go to the console.",
      "I'll connect my operator wallet and click Run Pipeline.",
      "The agent immediately fetches data from the SoSoValue API, validates the klines, and calculates the z-scores for the MAG7 constituents.",
      "Every run stores the validated snapshot, the deviation signals, and the audit trail, so operators can inspect the decision.",
    ].join(" "),
  },
  {
    id: "03-debate",
    url: "local/runs/DEMO_RUN_ID",
    kicker: "03 / THE DEBATE",
    title: "Bull vs. Bear vs. Chief",
    narration: [
      "Here is the core of Odysseus.",
      "Instead of just blindly trading, it runs an adversarial debate.",
      "The Bull Agent argues why the deviation is a mispricing.",
      "The Bear Agent argues why the move is justified, or why execution risk is too high.",
      "The Chief Agent reviews both, and makes the final verdict.",
      "The Chief is constrained: it can only choose SHORT or NO_TRADE.",
    ].join(" "),
  },
  {
    id: "04-execution",
    url: "local/runs/DEMO_RUN_ID",
    kicker: "04 / EXECUTION",
    title: "Deterministic risk · real perps · paper spot",
    narration: [
      "Once the Chief approves a short, the deterministic Risk Engine runs five hard checks: spread, depth, and confidence.",
      "Because the SoDEX testnet currently lacks spot liquidity, the agent simulates the spot hedge, but it executes the real perps short on the SoDEX testnet.",
      "You can see the real order I D right here.",
      "If any gate fails, no order is sent.",
    ].join(" "),
  },
  {
    id: "05-replay",
    url: "local/replay",
    kicker: "05 / REPLAY",
    title: "Every run is saved. Every snapshot can be re-run.",
    narration: [
      "Every run is saved.",
      "Operators can go to the Replay page to re-run historical snapshots instantly.",
      "Odysseus proves that a single person can run a risk-managed, on-chain fund with zero manual intervention.",
      "The live console and the complete source code are linked on screen.",
      "Every number shown here comes from a persisted run.",
      "Thank you.",
    ].join(" "),
  },
];

export function sceneUrl(scene) {
  if (scene.url === "live") return LIVE_URL;
  if (scene.url === "local/dashboard") return `${LOCAL_URL}/dashboard`;
  if (scene.url === "local/replay") return `${LOCAL_URL}/replay`;
  if (scene.url === "local/runs/DEMO_RUN_ID") return `${LOCAL_URL}/runs/${DEMO_RUN_ID}`;
  if (scene.url === "local/runs/DEMO_REPLAY_RUN_ID") {
    return `${LOCAL_URL}/runs/${DEMO_REPLAY_RUN_ID}`;
  }
  throw new Error(`Unknown scene URL: ${scene.url}`);
}

export const FONT_MONO =
  '"JetBrains Mono", "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace';
export const FONT_SANS =
  'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

export const BRAND = {
  background: "#050505",
  panel: "#0A0E17",
  text: "#E6EDF7",
  muted: "#8B98B8",
  amber: "#F5A623",
  green: "#2ED47A",
  red: "#FF5C5C",
};
