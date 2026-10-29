import { BRAND, FONT_MONO, FONT_SANS, LIVE_URL } from "./config.mjs";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minimal EIP-1193 provider. wagmi's injected connector only needs the
 * account and chain methods; returning the operator address is enough to
 * unlock the console without installing MetaMask.
 */
export function mockWallet(address) {
  const listeners = {};
  const provider = {
    isMetaMask: true,
    isConnected: () => true,
    request: async ({ method }) => {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [address];
        case "wallet_requestPermissions":
          return [
            {
              parentCapability: "eth_accounts",
              caveats: [
                { type: "restrictReturnedAccounts", value: [address] },
              ],
            },
          ];
        case "wallet_revokePermissions":
        case "wallet_switchEthereumChain":
          return null;
        case "eth_chainId":
          return "0x1";
        case "net_version":
          return "1";
        case "eth_blockNumber":
          return "0x1";
        case "eth_getBalance":
          return "0x0";
        case "eth_call":
          return "0x";
        case "eth_estimateGas":
          return "0x5208";
        default:
          return null;
      }
    },
    on: (event, callback) => {
      (listeners[event] ??= []).push(callback);
    },
    removeListener: (event, callback) => {
      listeners[event] = (listeners[event] ?? []).filter(
        (item) => item !== callback,
      );
    },
    emit: (event, ...args) => {
      (listeners[event] ?? []).forEach((callback) => callback(...args));
    },
  };

  Object.defineProperty(window, "ethereum", {
    value: provider,
    configurable: true,
  });
  window.__ODYSSEUS_VIDEO_WALLET__ = true;
  window.dispatchEvent(new Event("ethereum#initialized"));
}

/** Visible cursor and click ripples, because headless video has no OS cursor. */
export function installCursor() {
  if (window.__odysseusCursorInstalled) return;
  window.__odysseusCursorInstalled = true;

  const amber = "#F5A623";
  const style = document.createElement("style");
  style.textContent = `
    #odysseus-cursor {
      position: fixed;
      left: 0;
      top: 0;
      width: 18px;
      height: 18px;
      margin-left: -9px;
      margin-top: -9px;
      border: 2px solid rgba(255, 255, 255, 0.92);
      border-radius: 9999px;
      background: rgba(245, 166, 35, 0.28);
      box-shadow: 0 0 14px rgba(245, 166, 35, 0.7), 0 1px 4px rgba(0,0,0,0.7);
      z-index: 2147483000;
      pointer-events: none;
      transition: transform 0.06s linear;
      will-change: transform;
    }
    #odysseus-cursor::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 50%;
      width: 4px;
      height: 4px;
      margin-left: -2px;
      margin-top: -2px;
      border-radius: 9999px;
      background: #ffffff;
    }
    @keyframes odysseus-ripple {
      0% { transform: scale(0.7); opacity: 0.95; }
      100% { transform: scale(4.2); opacity: 0; }
    }
    .odysseus-click-ripple {
      position: fixed;
      width: 16px;
      height: 16px;
      margin-left: -8px;
      margin-top: -8px;
      border: 2px solid ${amber};
      border-radius: 9999px;
      z-index: 2147482999;
      pointer-events: none;
      animation: odysseus-ripple 0.5s ease-out forwards;
    }
  `;
  document.documentElement.appendChild(style);

  const cursor = document.createElement("div");
  cursor.id = "odysseus-cursor";
  document.documentElement.appendChild(cursor);

  let x = Math.round(window.innerWidth / 2);
  let y = Math.round(window.innerHeight / 2);
  cursor.style.transform = `translate(${x}px, ${y}px)`;

  window.addEventListener(
    "mousemove",
    (event) => {
      x = event.clientX;
      y = event.clientY;
      cursor.style.transform = `translate(${x}px, ${y}px)`;
    },
    { passive: true },
  );

  window.addEventListener(
    "mousedown",
    (event) => {
      const ripple = document.createElement("div");
      ripple.className = "odysseus-click-ripple";
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.documentElement.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 550);
    },
    true,
  );
}

export async function ensureChrome(page) {
  const liveHost = new URL(LIVE_URL).host;

  await page.evaluate(
    ({ brand, fontMono, fontSans, liveHost: host }) => {
      if (document.getElementById("odysseus-video-style")) return;

      const style = document.createElement("style");
      style.id = "odysseus-video-style";
      style.textContent = `
        #odysseus-caption {
          position: fixed;
          left: 22px;
          bottom: 22px;
          z-index: 2147482550;
          display: flex;
          align-items: stretch;
          gap: 14px;
          max-width: min(760px, calc(100vw - 44px));
          padding: 11px 26px 11px 0;
          background: linear-gradient(90deg, rgba(5,5,5,0.94) 0%, rgba(5,5,5,0.82) 72%, rgba(5,5,5,0) 100%);
          border-left: 2px solid ${brand.amber};
          pointer-events: none;
          opacity: 1;
          transition: opacity 0.18s ease;
          font-family: ${fontSans};
        }
        #odysseus-caption-kicker {
          font-family: ${fontMono};
          font-size: 9px;
          line-height: 1.2;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: ${brand.amber};
          white-space: nowrap;
        }
        #odysseus-caption-title {
          margin-top: 4px;
          font-size: 17px;
          line-height: 1.25;
          letter-spacing: -0.01em;
          color: ${brand.text};
          text-shadow: 0 2px 12px rgba(0,0,0,0.9);
        }
        #odysseus-url {
          position: fixed;
          left: 50%;
          top: 9px;
          transform: translateX(-50%);
          z-index: 2147482550;
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: ${fontMono};
          font-size: 9px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: ${brand.muted};
          pointer-events: none;
          text-shadow: 0 2px 10px rgba(0,0,0,0.9);
        }
        #odysseus-url .dot {
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: ${brand.green};
          box-shadow: 0 0 8px rgba(46,212,122,0.85);
        }
        .odysseus-ring {
          box-shadow: 0 0 0 2px var(--odysseus-hl), 0 0 30px var(--odysseus-hl-glow) !important;
          transition: box-shadow 0.3s ease !important;
        }
        .odysseus-row {
          outline: 2px solid var(--odysseus-hl) !important;
          outline-offset: -2px !important;
          background: var(--odysseus-hl-bg) !important;
          transition: background 0.3s ease, outline 0.3s ease !important;
        }
        .odysseus-pulse {
          animation: odysseus-highlight-pulse 1.15s ease-in-out infinite !important;
        }
        @keyframes odysseus-highlight-pulse {
          0%, 100% { box-shadow: 0 0 0 1px var(--odysseus-hl), 0 0 8px transparent; }
          50% { box-shadow: 0 0 0 2px var(--odysseus-hl), 0 0 28px var(--odysseus-hl-glow); }
        }
        #odysseus-spotlight {
          position: fixed;
          inset: 0;
          z-index: 2147482500;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        #odysseus-spotlight .spot-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(2, 4, 9, 0.8);
          backdrop-filter: blur(3px);
          opacity: 0;
          transition: opacity 0.35s ease;
        }
        #odysseus-spotlight .spot-card {
          position: relative;
          width: min(1080px, 92vw);
          opacity: 0;
          transform: scale(0.97);
          transition: opacity 0.35s ease, transform 0.35s ease;
          box-shadow: 0 0 100px rgba(245,166,35,0.2), 0 40px 100px rgba(0,0,0,0.8);
        }
        #odysseus-spotlight .spot-banner,
        #odysseus-spotlight .spot-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(245,166,35,0.42);
          background: #0A0E17;
          padding: 10px 16px;
          font-family: ${fontMono};
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${brand.muted};
        }
        #odysseus-spotlight .spot-banner {
          border-bottom: none;
          color: ${brand.amber};
        }
        #odysseus-spotlight .spot-footer {
          border-top: none;
        }
        #odysseus-spotlight .spot-footer b {
          color: ${brand.amber};
          font-weight: 600;
        }
        #odysseus-spotlight .spot-clone > section {
          border-color: rgba(245,166,35,0.42);
          background: #0A0E17;
        }
        .odysseus-order-id {
          display: inline-block;
          padding: 2px 7px !important;
          background: ${brand.amber} !important;
          color: #050505 !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          letter-spacing: 0.02em;
          border-radius: 2px;
          box-shadow: 0 0 18px rgba(245,166,35,0.55);
        }
        .odysseus-paper-text,
        .odysseus-paper-badge {
          color: ${brand.amber} !important;
          font-weight: 600 !important;
          text-shadow: 0 0 14px rgba(245,166,35,0.5);
        }
        #odysseus-endcard {
          position: fixed;
          inset: 0;
          z-index: 2147482600;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          background:
            radial-gradient(circle at 50% 42%, rgba(245,166,35,0.11), transparent 34%),
            rgba(5,5,5,0.93);
          backdrop-filter: blur(5px);
          opacity: 0;
          transition: opacity 0.6s ease;
          pointer-events: none;
          font-family: ${fontSans};
        }
        #odysseus-endcard .end-kicker {
          font-family: ${fontMono};
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: ${brand.amber};
        }
        #odysseus-endcard .end-title {
          margin-top: 18px;
          font-size: clamp(44px, 6vw, 72px);
          font-weight: 500;
          letter-spacing: 0.24em;
          color: ${brand.text};
          padding-left: 0.24em;
          animation: odysseus-end-glow 6s ease-in-out infinite alternate;
        }
        @keyframes odysseus-end-glow {
          from { text-shadow: 0 0 0 rgba(245,166,35,0); }
          to { text-shadow: 0 0 44px rgba(245,166,35,0.22); }
        }
        #odysseus-endcard .end-sub {
          margin-top: 10px;
          font-size: 16px;
          color: ${brand.muted};
        }
        #odysseus-endcard .end-rule {
          width: min(620px, 70vw);
          height: 1px;
          margin: 34px 0 24px;
          background: linear-gradient(90deg, transparent, rgba(245,166,35,0.7), transparent);
        }
        #odysseus-endcard .end-links {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 28px;
          font-family: ${fontMono};
          font-size: 11px;
          letter-spacing: 0.1em;
          color: ${brand.muted};
        }
        #odysseus-endcard .end-links b {
          display: block;
          margin-bottom: 5px;
          font-size: 8px;
          letter-spacing: 0.22em;
          color: ${brand.muted};
          font-weight: 500;
        }
        #odysseus-endcard .end-links span {
          color: ${brand.text};
        }
        #odysseus-endcard .end-built {
          margin-top: 34px;
          font-family: ${fontMono};
          font-size: 8px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(139,152,184,0.65);
        }
      `;
      document.documentElement.appendChild(style);

      const caption = document.createElement("div");
      caption.id = "odysseus-caption";
      caption.innerHTML = `
        <div style="width:2px;background:${brand.amber};margin-left:-2px;"></div>
        <div>
          <div id="odysseus-caption-kicker"></div>
          <div id="odysseus-caption-title"></div>
        </div>
      `;
      document.body.appendChild(caption);

      const url = document.createElement("div");
      url.id = "odysseus-url";
      url.innerHTML = `<span class="dot"></span><span>${host}</span>`;
      document.body.appendChild(url);
    },
    {
      brand: BRAND,
      fontMono: FONT_MONO,
      fontSans: FONT_SANS,
      liveHost,
    },
  );
}

export async function setCaption(page, kicker, title) {
  await page.evaluate(
    ({ kicker: nextKicker, title: nextTitle }) => {
      const caption = document.getElementById("odysseus-caption");
      const kickerEl = document.getElementById("odysseus-caption-kicker");
      const titleEl = document.getElementById("odysseus-caption-title");
      if (!caption || !kickerEl || !titleEl) return;
      caption.style.opacity = "0";
      return new Promise((resolve) => {
        window.setTimeout(() => {
          kickerEl.textContent = nextKicker;
          titleEl.textContent = nextTitle;
          caption.style.opacity = "1";
          window.setTimeout(resolve, 220);
        }, 130);
      });
    },
    { kicker, title },
  );
}

export async function clearHighlights(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        ".odysseus-ring, .odysseus-row, .odysseus-pulse",
      )
      .forEach((element) => {
        element.classList.remove(
          "odysseus-ring",
          "odysseus-row",
          "odysseus-pulse",
        );
        element.style.removeProperty("--odysseus-hl");
        element.style.removeProperty("--odysseus-hl-glow");
        element.style.removeProperty("--odysseus-hl-bg");
      });
  });
}

export async function highlight(
  locator,
  { color = "#F5A623", kind = "ring", pulse = false } = {},
) {
  await locator.evaluate(
    (element, { color: nextColor, kind: nextKind, pulse: nextPulse }) => {
      element.classList.add(
        nextKind === "row" ? "odysseus-row" : "odysseus-ring",
      );
      if (nextPulse) element.classList.add("odysseus-pulse");
      element.style.setProperty("--odysseus-hl", nextColor);
      element.style.setProperty("--odysseus-hl-glow", `${nextColor}66`);
      element.style.setProperty("--odysseus-hl-bg", `${nextColor}14`);
    },
    { color, kind, pulse },
  );
}

export async function moveTo(page, locator, { steps = 18, settle = 180 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new Error("Cannot move cursor: element has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps,
  });
  if (settle > 0) await page.waitForTimeout(settle);
  return box;
}

export async function click(page, locator) {
  await moveTo(page, locator);
  await locator.click({ delay: 90 });
  await page.waitForTimeout(220);
}

export async function scrollToY(page, targetY, durationSeconds = 1.6) {
  await page.evaluate(
    ({ y, duration }) => {
      const scroller = document.scrollingElement || document.documentElement;
      const start = scroller.scrollTop;
      const max = Math.max(0, scroller.scrollHeight - window.innerHeight);
      const target = Math.max(0, Math.min(max, y));
      const delta = target - start;
      document.documentElement.style.scrollBehavior = "auto";

      if (Math.abs(delta) < 1 || duration <= 0) {
        scroller.scrollTop = target;
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const started = performance.now();
        const total = duration * 1000;
        const ease = (progress) =>
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const step = (now) => {
          const progress = Math.min(1, (now - started) / total);
          scroller.scrollTop = start + delta * ease(progress);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    },
    { y: targetY, duration: durationSeconds },
  );
}

export async function scrollToLocator(
  page,
  locator,
  { offset = 86, duration = 1.6, block = "start" } = {},
) {
  await locator.waitFor({ state: "attached", timeout: 15000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("Cannot scroll to element without a bounding box");
  const target = await page.evaluate(
    ({ top, height, offset: nextOffset, block: nextBlock }) => {
      const current = window.scrollY;
      if (nextBlock === "center") {
        return current + top - (window.innerHeight - height) / 2;
      }
      return current + top - nextOffset;
    },
    { top: box.y, height: box.height, offset, block },
  );
  await scrollToY(page, target, duration);
}

export async function scrollToSelector(page, selector, options = {}) {
  await scrollToLocator(page, page.locator(selector).first(), options);
}

export async function spotlightExecution(page) {
  await page.evaluate(() => {
    document.getElementById("odysseus-spotlight")?.remove();

    const panel = document.querySelector("#execution");
    if (!panel) throw new Error("Execution panel not found");

    const overlay = document.createElement("div");
    overlay.id = "odysseus-spotlight";

    const backdrop = document.createElement("div");
    backdrop.className = "spot-backdrop";

    const card = document.createElement("div");
    card.className = "spot-card";

    const banner = document.createElement("div");
    banner.className = "spot-banner";
    banner.innerHTML =
      "<span>SODEX TESTNET / EXECUTION</span><span>REAL PERPS FILL</span>";

    const clone = panel.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    clone.classList.add("spot-clone");
    clone.style.width = "100%";
    clone.style.position = "relative";

    const spans = [...clone.querySelectorAll("span")];
    const orderSpan = spans.find((node) =>
      /^\d{8,}$/.test(node.textContent.trim()),
    );
    if (orderSpan) orderSpan.classList.add("odysseus-order-id");

    [...clone.querySelectorAll("*")].forEach((node) => {
      if (
        node.children.length === 0 &&
        node.textContent.trim() === "PAPER SPOT"
      ) {
        node.classList.add("odysseus-paper-text");
      }
      if (
        node.children.length === 0 &&
        node.textContent.trim() === "PAPER"
      ) {
        node.classList.add("odysseus-paper-badge");
      }
    });

    const footer = document.createElement("div");
    footer.className = "spot-footer";
    const orderId = orderSpan?.textContent.trim() ?? "REAL ORDER";
    footer.innerHTML = `<span>SHORT HYPE-PERP · <b>${orderId}</b></span><span>LONG SSIMAG7 · PAPER SPOT HEDGE</span>`;

    card.appendChild(banner);
    card.appendChild(clone);
    card.appendChild(footer);
    overlay.appendChild(backdrop);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      backdrop.style.opacity = "1";
      card.style.opacity = "1";
      card.style.transform = "scale(1)";
    });
  });
  await page.waitForTimeout(500);
}

export async function showEndCard(page) {
  const liveHost = new URL(LIVE_URL).host;
  await page.evaluate(
    ({ liveHost: host }) => {
      document.getElementById("odysseus-endcard")?.remove();

      const card = document.createElement("div");
      card.id = "odysseus-endcard";
      card.innerHTML = `
        <div class="end-kicker">SoSoValue Buildathon · One-Person On-Chain Finance</div>
        <div class="end-title">ODYSSEUS</div>
        <div class="end-sub">Autonomous SSI index-deviation agent</div>
        <div class="end-rule"></div>
        <div class="end-links">
          <div><b>Live demo</b><span>${host}</span></div>
          <div><b>Source</b><span>github.com/onyebuchidaniel60/Odysseus</span></div>
        </div>
        <div class="end-built">Playwright · edge-tts · FFmpeg</div>
      `;
      document.body.appendChild(card);
      requestAnimationFrame(() => {
        card.style.opacity = "1";
      });
    },
    { liveHost },
  );
  await page.waitForTimeout(650);
}

export async function waitForText(
  page,
  text,
  { exact = true, timeout = 20000 } = {},
) {
  await page
    .getByText(text, { exact })
    .first()
    .waitFor({ state: "visible", timeout });
}
