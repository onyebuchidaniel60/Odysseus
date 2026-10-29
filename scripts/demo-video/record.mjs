import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

import {
  BRAND,
  DEMO_REPLAY_RUN_ID,
  DEMO_RUN_ID,
  LIVE_URL,
  LOCAL_URL,
  NARRATION_DIR,
  OPERATOR_ADDRESS,
  PRE_ROLL_SECONDS,
  SCENES,
  VIDEO_DIR,
  sceneUrl,
} from "./config.mjs";
import {
  clearHighlights,
  click,
  ensureChrome,
  highlight,
  installCursor,
  mockWallet,
  moveTo,
  scrollToLocator,
  scrollToSelector,
  setCaption,
  showEndCard,
  sleep,
  spotlightExecution,
} from "./browser.mjs";

const VIEWPORT = { width: 1920, height: 1080 };

function probeDuration(file) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      file,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${file}: ${result.stderr}`);
  }
  return Number(result.stdout.trim());
}

class SceneClock {
  constructor(startMs, durationSeconds) {
    this.startMs = startMs;
    this.durationSeconds = durationSeconds;
  }

  async waitUntil(seconds) {
    const delay = this.startMs + seconds * 1000 - Date.now();
    if (delay > 0) await sleep(delay);
  }

  async at(seconds, action) {
    await this.waitUntil(seconds);
    return action ? action() : undefined;
  }
}

async function gotoScene(page, scene) {
  const target = sceneUrl(scene);
  const fallback = scene.url === "live" ? `${LOCAL_URL}/` : null;

  try {
    const response = await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    if (response && response.status() >= 400) {
      throw new Error(`HTTP ${response.status()}`);
    }
  } catch (error) {
    if (!fallback) throw error;
    console.warn(
      `[record] live landing unavailable (${error.message}); using local build`,
    );
    await page.goto(fallback, { waitUntil: "domcontentloaded", timeout: 45000 });
  }

  await page
    .waitForLoadState("networkidle", { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}

async function waitForSceneReady(page, scene) {
  switch (scene.id) {
    case "01-landing":
      await page
        .getByRole("heading", { level: 1 })
        .first()
        .waitFor({ timeout: 30000 });
      break;
    case "02-dashboard":
      await page.getByText("Deviation Intelligence").waitFor({ timeout: 30000 });
      await page.getByText("64c1368c").first().waitFor({ timeout: 30000 });
      break;
    case "03-debate":
    case "04-execution":
      await page
        .getByRole("heading", { name: "Run Detail" })
        .waitFor({ timeout: 30000 });
      await page.locator("#debate").waitFor({ timeout: 30000 });
      await page.getByText("HYPE").first().waitFor({ timeout: 30000 });
      break;
    case "05-replay":
      await page.getByText("REPLAY MODE").waitFor({ timeout: 30000 });
      await page.getByText("64c1368c").first().waitFor({ timeout: 30000 });
      break;
    default:
      throw new Error(`Unknown scene: ${scene.id}`);
  }
}

function installMockRoutes(page, scene) {
  if (scene.id === "02-dashboard") {
    void page.route("**/api/run", async (route) => {
      const request = route.request();
      if (
        request.method() !== "POST" ||
        new URL(request.url()).pathname !== "/api/run"
      ) {
        await route.continue();
        return;
      }
      // Deliberate delay so the "Running..." state is visible in the video.
      await sleep(3200);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          runId: DEMO_RUN_ID,
          decision: "SHORT",
        }),
      });
    });
  }

  if (scene.id === "05-replay") {
    void page.route("**/api/run/replay", async (route) => {
      const request = route.request();
      if (
        request.method() !== "POST" ||
        new URL(request.url()).pathname !== "/api/run/replay"
      ) {
        await route.continue();
        return;
      }
      await sleep(1400);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          runId: DEMO_REPLAY_RUN_ID,
        }),
      });
    });
  }
}

/* ------------------------------------------------------------------ */
/* Storyboard                                                          */
/* ------------------------------------------------------------------ */

async function sceneLanding({ page, at }) {
  const hero = page.getByRole("heading", { level: 1 }).first();
  const whyHeading = page.getByRole("heading", {
    name: "Built to refuse bad trades.",
  });
  const noTradeCard = page
    .locator("article")
    .filter({ hasText: "NO_TRADE by Default" })
    .first();

  await at(0.8, () => moveTo(page, hero, { settle: 300 }));
  await at(6.3, () =>
    scrollToSelector(page, "#architecture", { offset: 80, duration: 3.2 }),
  );
  await at(10.5, () =>
    setCaption(
      page,
      "01 / OVERVIEW",
      "SoSoValue → validation → z-scores → SoDEX",
    ),
  );
  await at(16.3, () =>
    scrollToLocator(page, whyHeading, { offset: 110, duration: 2.2 }),
  );
  await at(18.6, async () => {
    await setCaption(
      page,
      "01 / OVERVIEW",
      "NO_TRADE is a valid success outcome",
    );
    await highlight(noTradeCard, { color: BRAND.amber });
  });
  await at(19.4, () => moveTo(page, noTradeCard));
  await at(20.8, () =>
    setCaption(page, "01 / OVERVIEW", "One operator. Zero manual intervention."),
  );
  await at(21.1, () =>
    scrollToSelector(page, "footer", { offset: 0, duration: 1.8 }),
  );
}

async function sceneDashboard({ page, at }) {
  const connect = page.getByRole("button", { name: "Connect Wallet" });
  const run = page.getByRole("button", { name: "Run Pipeline" });
  const operatorBadge = page.getByText("Operator Connected", { exact: true });
  const toast = page.getByText("Run complete — SHORT signal placed.", {
    exact: true,
  });
  const topRow = page.locator("tbody tr").first();
  const shortBadge = page.getByText("SHORT", { exact: true }).first();

  await at(0.9, () => moveTo(page, connect));
  await at(1.3, () => click(page, connect));
  await at(1.9, () => operatorBadge.waitFor({ timeout: 15000 }));
  await at(2.4, () => highlight(operatorBadge, { color: BRAND.green }));
  await at(3.4, () =>
    setCaption(
      page,
      "02 / PIPELINE",
      "Live SoSoValue ingestion + validation",
    ),
  );
  await at(3.8, () => moveTo(page, run));
  await at(4.2, () => click(page, run));
  await at(4.8, () =>
    highlight(run, { color: BRAND.amber, pulse: true }),
  );
  await at(7.8, async () => {
    await toast.waitFor({ timeout: 15000 });
    await highlight(toast, { color: BRAND.green });
    await setCaption(page, "02 / PIPELINE", "Run complete — SHORT signal");
  });
  await at(8.8, () => moveTo(page, topRow));
  await at(9.4, async () => {
    await click(page, topRow);
    await page.waitForURL(`**/runs/${DEMO_RUN_ID}`, { timeout: 20000 });
    await page.waitForTimeout(500);
    await ensureChrome(page);
    await setCaption(
      page,
      "02 / PIPELINE",
      "HYPE z-score +2.58 · overextended",
    );
  });
  await at(10.6, () => highlight(shortBadge, { color: BRAND.amber }));
  await at(11.2, () =>
    moveTo(page, page.getByText("+2.58", { exact: true }).first()),
  );
  await at(11.4, async () => {
    await setCaption(
      page,
      "02 / PIPELINE",
      "Validated snapshot · stored signals",
    );
    await scrollToSelector(page, "#signals", { offset: 70, duration: 1.2 });
  });
  await at(13.4, () =>
    highlight(page.locator("#signals tbody tr").first(), {
      color: BRAND.amber,
      kind: "row",
    }),
  );
  await at(14.0, () =>
    moveTo(page, page.locator("#signals tbody tr").first()),
  );
  await at(15.6, async () => {
    await setCaption(page, "02 / PIPELINE", "Full audit trail persisted");
    await scrollToSelector(page, "#audit", { offset: 100, duration: 1.2 });
  });
  await at(17.6, () => highlight(page.locator("#audit"), { color: BRAND.green }));
  await at(19.6, () =>
    moveTo(page, page.locator("#audit ol li").last()),
  );
}

async function sceneDebate({ page, at }) {
  const cards = page.locator("#debate article");
  const bull = cards.nth(0);
  const bear = cards.nth(1);
  const chief = cards.nth(2);
  const risk = page.locator("#risk");

  await at(0.8, () =>
    moveTo(page, page.getByText("SHORT", { exact: true }).first()),
  );
  await at(2.0, () =>
    scrollToSelector(page, "#debate", { offset: 70, duration: 1.8 }),
  );
  await at(4.0, async () => {
    await setCaption(
      page,
      "03 / THE DEBATE",
      "Bull: the deviation is a mispricing",
    );
    await highlight(bull, { color: BRAND.green });
  });
  await at(4.4, () => moveTo(page, bull));
  await at(7.0, async () => {
    await setCaption(
      page,
      "03 / THE DEBATE",
      "Bear: justified move or execution risk",
    );
    await highlight(bear, { color: BRAND.red });
  });
  await at(7.4, () => moveTo(page, bear));
  await at(10.2, async () => {
    await setCaption(page, "03 / THE DEBATE", "Chief: SHORT or NO_TRADE");
    await scrollToLocator(page, chief, { offset: 150, duration: 1.4 });
  });
  await at(11.8, () => highlight(chief, { color: BRAND.amber }));
  await at(12.2, () => moveTo(page, chief));
  await at(16.9, () =>
    setCaption(
      page,
      "03 / THE DEBATE",
      "Chief constrained: SHORT or NO_TRADE",
    ),
  );
  await at(18.2, () =>
    highlight(page.locator("#debate article").nth(2), {
      color: BRAND.amber,
      pulse: true,
    }),
  );
  await at(20.3, async () => {
    await scrollToSelector(page, "#risk", { offset: 78, duration: 1.4 });
    await setCaption(page, "03 / THE DEBATE", "Next: deterministic risk gates");
  });
  await at(21.8, () => highlight(risk, { color: BRAND.green }));
}

async function sceneExecution({ page, at }) {
  const risk = page.locator("#risk");
  const execution = page.locator("#execution");
  const checks = page.locator("#risk .divide-y > div");

  await at(0.8, async () => {
    await highlight(risk, { color: BRAND.green });
    await highlight(execution, { color: BRAND.amber });
  });
  await at(2.0, () =>
    scrollToSelector(page, "#risk", { offset: 78, duration: 1.6 }),
  );
  await at(3.8, () =>
    setCaption(page, "04 / EXECUTION", "Five deterministic checks"),
  );
  for (let index = 0; index < 6; index += 1) {
    await at(4.2 + index * 0.45, () =>
      highlight(checks.nth(index), {
        color: BRAND.green,
        kind: "row",
        pulse: true,
      }),
    );
  }
  await at(7.2, () =>
    setCaption(
      page,
      "04 / EXECUTION",
      "Real perps short · explicit paper spot",
    ),
  );
  await at(7.4, () => spotlightExecution(page));
  await at(9.2, () =>
    setCaption(
      page,
      "04 / EXECUTION",
      "HYPE SHORT · order 3155812057",
    ),
  );
  await at(10.0, () =>
    highlight(
      page.locator("#odysseus-spotlight .odysseus-order-id"),
      { color: BRAND.amber, pulse: true },
    ),
  );
  await at(12.0, () =>
    setCaption(
      page,
      "04 / EXECUTION",
      "Spot hedge is paper. Perps fill is real.",
    ),
  );
  await at(20.8, () =>
    setCaption(
      page,
      "04 / EXECUTION",
      "Failed gate → NO_TRADE. No order sent.",
    ),
  );
  await at(22.4, () =>
    highlight(
      page.locator("#odysseus-spotlight .spot-footer"),
      { color: BRAND.amber },
    ),
  );
}

async function sceneReplay({ page, at }) {
  const connect = page.getByRole("button", { name: "Connect Wallet" });
  const table = page.locator("table").first();
  const row = page.locator("tr").filter({ hasText: "64c1368c" }).first();
  const replayButton = row.getByRole("button", { name: "Replay" });

  await at(0.8, () => moveTo(page, table));
  await at(1.1, () => moveTo(page, connect));
  await at(1.4, () => click(page, connect));
  await at(2.1, () =>
    page.getByText("Operator Connected", { exact: true }).waitFor({
      timeout: 15000,
    }),
  );
  await at(2.8, () => highlight(table, { color: BRAND.amber }));
  await at(3.4, () => moveTo(page, replayButton));
  await at(3.8, () => click(page, replayButton));
  await at(4.4, () =>
    setCaption(page, "05 / REPLAY", "Re-running the stored snapshot"),
  );
  await at(5.6, () =>
    page.waitForURL(`**/runs/${DEMO_REPLAY_RUN_ID}`, { timeout: 20000 }),
  );
  await at(6.0, async () => {
    await page.waitForTimeout(500);
    await ensureChrome(page);
    await setCaption(
      page,
      "05 / REPLAY",
      "Replay complete · new audit trail",
    );
    await highlight(page.getByText("SHORT", { exact: true }).first(), {
      color: BRAND.amber,
    });
  });
  await at(12.8, () => showEndCard(page));
}

const STORYBOARD = {
  "01-landing": sceneLanding,
  "02-dashboard": sceneDashboard,
  "03-debate": sceneDebate,
  "04-execution": sceneExecution,
  "05-replay": sceneReplay,
};

/* ------------------------------------------------------------------ */
/* Recorder                                                            */
/* ------------------------------------------------------------------ */

async function recordScene(browser, scene, narration) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: {
      dir: VIDEO_DIR,
      size: VIEWPORT,
    },
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    reducedMotion: "no-preference",
  });

  await context.addInitScript(mockWallet, OPERATOR_ADDRESS);
  await context.addInitScript(installCursor);

  const t0 = Date.now();
  const page = await context.newPage();
  const duration = narration.sceneDuration;

  try {
    await gotoScene(page, scene);
    await waitForSceneReady(page, scene);
    await ensureChrome(page);
    await setCaption(page, scene.kicker, scene.title);
    await page.waitForTimeout(250);

    const wait = t0 + PRE_ROLL_SECONDS * 1000 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);

    const sceneStart = Date.now();
    const trim = Math.max(0, (sceneStart - t0) / 1000 - 0.5);
    const clock = new SceneClock(sceneStart, duration);

    installMockRoutes(page, scene);
    await clearHighlights(page);

    console.log(
      `[record] ${scene.id}: ${duration.toFixed(2)}s scene, trim ${trim.toFixed(2)}s`,
    );
    await STORYBOARD[scene.id]({
      page,
      at: (seconds, action) => clock.at(seconds, action),
    });

    await clock.waitUntil(duration);
    await page.waitForTimeout(350);

    const video = page.video();
    if (!video) throw new Error("Playwright did not create a video");
    await context.close();

    const sourcePath = await video.path();
    const destination = path.join(VIDEO_DIR, `${scene.id}.webm`);
    fs.copyFileSync(sourcePath, destination);
    if (path.resolve(sourcePath) !== path.resolve(destination)) {
      fs.rmSync(sourcePath, { force: true });
    }

    return {
      id: scene.id,
      file: path.relative(path.dirname(VIDEO_DIR), destination),
      trim: Number(trim.toFixed(3)),
      duration: Number(duration.toFixed(3)),
      narrationDuration: narration.narrationDuration,
      sourceDuration: Number(probeDuration(destination).toFixed(3)),
    };
  } catch (error) {
    await context.close().catch(() => {});
    throw new Error(`${scene.id}: ${error.message}`);
  }
}

async function main() {
  const narrationFile = path.join(NARRATION_DIR, "manifest.json");
  if (!fs.existsSync(narrationFile)) {
    throw new Error(
      "Narration manifest missing. Run `node scripts/demo-video/generate-narration.mjs` first.",
    );
  }

  const narration = JSON.parse(fs.readFileSync(narrationFile, "utf8"));
  const narrationById = new Map(
    narration.scenes.map((entry) => [entry.id, entry]),
  );

  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const manifest = {
    recordedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    liveUrl: LIVE_URL,
    localUrl: LOCAL_URL,
    scenes: [],
  };

  try {
    for (const scene of SCENES) {
      const entry = narrationById.get(scene.id);
      if (!entry) throw new Error(`No narration for scene ${scene.id}`);
      const recorded = await recordScene(browser, scene, entry);
      manifest.scenes.push(recorded);
      console.log(
        `[record] ${scene.id}: source ${recorded.sourceDuration}s, clip starts at ${recorded.trim}s`,
      );
    }
  } finally {
    await browser.close();
  }

  const manifestFile = path.join(VIDEO_DIR, "manifest.json");
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const total = manifest.scenes.reduce((sum, entry) => sum + entry.duration, 0);
  console.log(`[record] total runtime ${total.toFixed(1)}s`);
  console.log(
    `[record] wrote ${path.relative(process.cwd(), manifestFile)}`,
  );
}

main().catch((error) => {
  console.error(`[record] failed: ${error.stack || error.message}`);
  process.exit(1);
});
