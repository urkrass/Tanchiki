import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const defaultAppUrl = process.env.QA_BROWSER_URL || "http://127.0.0.1:5173";
const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "narrow", width: 390, height: 760 }
];
const knownNonFatalConsolePatterns = [
  /willReadFrequently/i
];

export async function runBrowserSmoke(options = {}) {
  const appUrl = options.url || defaultAppUrl;
  const browserPath = options.browserPath || findBrowserPath();
  if (!browserPath) {
    throw new Error(
      "Browser smoke QA requires Chrome or Edge. Set QA_BROWSER_PATH to a Chromium executable."
    );
  }

  const server = await ensureDemoServer(appUrl, options);
  const browser = await launchBrowser(browserPath);

  try {
    const client = await CdpClient.create(browser.debuggingUrl);
    const consoleMessages = [];
    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("Log.enable");
    client.on("Runtime.consoleAPICalled", (event) => {
      consoleMessages.push({
        source: "console",
        level: event.type,
        text: event.args?.map((arg) => arg.value ?? arg.description ?? "").join(" ") ?? ""
      });
    });
    client.on("Runtime.exceptionThrown", (event) => {
      consoleMessages.push({
        source: "exception",
        level: "error",
        text: event.exceptionDetails?.text ?? "Uncaught browser exception"
      });
    });
    client.on("Log.entryAdded", (event) => {
      consoleMessages.push({
        source: event.entry.source,
        level: event.entry.level,
        text: event.entry.text
      });
    });

    const checks = [];
    for (const viewport of viewports) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.name === "narrow"
      });
      await navigate(client, appUrl);
      await waitForAppReady(client);
      checks.push(await evaluatePageChecks(client, viewport));
    }

    const consoleErrors = consoleMessages.filter(isActionableConsoleError);
    const report = {
      schemaVersion: 1,
      generatedBy: "scripts/qa-browser-smoke.js",
      url: appUrl,
      browser: browser.executable,
      server: server.started ? "started-by-runner" : "existing-or-public",
      checks,
      consoleErrors,
      ignoredConsoleMessages: consoleMessages.filter((message) => !isActionableConsoleError(message))
    };

    assertBrowserSmokeReport(report);
    return report;
  } finally {
    await browser.close();
    await server.close();
  }
}

export function assertBrowserSmokeReport(report) {
  const failures = [];
  if (!Array.isArray(report.checks) || report.checks.length === 0) {
    failures.push("no viewport checks were recorded");
  }

  for (const viewport of report.checks ?? []) {
    for (const [name, passed] of Object.entries(viewport.checks ?? {})) {
      if (!passed) {
        failures.push(`${viewport.viewport}: ${name}`);
      }
    }
  }

  if (report.consoleErrors?.length > 0) {
    failures.push(`console errors: ${report.consoleErrors.map((message) => message.text).join("; ")}`);
  }

  if (failures.length > 0) {
    throw new Error(`Browser smoke QA failed: ${failures.join(", ")}`);
  }
}

export function inspectPageForSmoke() {
  const isVisible = (selector) => {
    const element = document.querySelector(selector);
    if (!element) {
      return false;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && style.display !== "none"
      && style.visibility !== "hidden"
      && Number(style.opacity) !== 0;
  };
  const canvas = document.querySelector("#game");
  const context = canvas?.getContext("2d", { willReadFrequently: true });
  const rect = canvas?.getBoundingClientRect();
  const imageData = context && canvas.width > 0 && canvas.height > 0
    ? context.getImageData(0, 0, canvas.width, canvas.height).data
    : null;
  let nonblankPixelCount = 0;
  if (imageData) {
    for (let index = 0; index < imageData.length; index += 4) {
      if (
        imageData[index] !== 0
        || imageData[index + 1] !== 0
        || imageData[index + 2] !== 0
        || imageData[index + 3] !== 0
      ) {
        nonblankPixelCount += 1;
      }
    }
  }

  return {
    location: window.location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    canvas: {
      exists: Boolean(canvas),
      cssWidth: Math.round(rect?.width ?? 0),
      cssHeight: Math.round(rect?.height ?? 0),
      pixelWidth: canvas?.width ?? 0,
      pixelHeight: canvas?.height ?? 0,
      nonblankPixelCount
    },
    text: {
      title: document.querySelector("#title")?.textContent?.trim() ?? "",
      objective: document.querySelector(".game-copy > p:not(.eyebrow)")?.textContent?.trim() ?? "",
      status: document.querySelector("#status")?.textContent?.trim() ?? "",
      controls: [...document.querySelectorAll(".demo-brief p")]
        .map((element) => element.textContent.trim())
    },
    visibility: {
      title: isVisible("#title"),
      objective: isVisible(".game-copy > p:not(.eyebrow)"),
      controls: isVisible(".demo-brief"),
      canvas: isVisible("#game"),
      status: isVisible(".status-bar")
    }
  };
}

function findBrowserPath() {
  if (process.env.QA_BROWSER_PATH) {
    return process.env.QA_BROWSER_PATH;
  }

  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      ]
    : process.platform === "darwin"
    ? [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      ]
    : [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge"
      ];

  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

async function ensureDemoServer(appUrl, options) {
  if (options.skipServer || !isLocalUrl(appUrl)) {
    return {
      started: false,
      async close() {}
    };
  }

  if (await urlResponds(appUrl)) {
    return {
      started: false,
      async close() {}
    };
  }

  const url = new URL(appUrl);
  const child = spawn(process.execPath, ["scripts/dev-server.js"], {
    env: {
      ...process.env,
      PORT: url.port || "5173"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await urlResponds(appUrl)) {
      return {
        started: true,
        async close() {
          child.kill();
          await delay(100);
        }
      };
    }
    await delay(100);
  }

  child.kill();
  throw new Error(`Local demo server did not respond at ${appUrl}. Output: ${output.trim()}`);
}

async function launchBrowser(browserPath) {
  const debuggingPort = await findOpenPort();
  const userDataDir = mkdtempSync(join(tmpdir(), "tanchiki-browser-smoke-"));
  const args = [
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank"
  ];
  const child = spawn(browserPath, args, { stdio: ["ignore", "ignore", "ignore"] });
  const versionUrl = `http://127.0.0.1:${debuggingPort}/json/version`;
  let debuggingUrl = null;

  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const version = await fetchJson(versionUrl);
        debuggingUrl = version.webSocketDebuggerUrl;
        break;
      } catch {
        await delay(100);
      }
    }

    if (!debuggingUrl) {
      throw new Error("Chromium DevTools endpoint did not become available.");
    }

    return {
      executable: browserPath,
      debuggingUrl,
      async close() {
        child.kill();
        await delay(100);
        rmSync(userDataDir, { recursive: true, force: true });
      }
    };
  } catch (error) {
    child.kill();
    rmSync(userDataDir, { recursive: true, force: true });
    throw error;
  }
}

async function navigate(client, appUrl) {
  const loaded = client.waitFor("Page.loadEventFired", 5000);
  await client.send("Page.navigate", { url: appUrl });
  await loaded;
}

async function waitForAppReady(client) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await client.evaluate("Boolean(window.render_game_to_text && document.querySelector('#game'))");
    if (result === true) {
      await client.evaluate("window.advanceTime?.(100)");
      return;
    }
    await delay(100);
  }

  throw new Error("Browser smoke QA could not find the Tanchiki runtime hooks or canvas.");
}

async function evaluatePageChecks(client, viewport) {
  const page = await client.evaluate(`(${inspectPageForSmoke.toString()})()`);
  return {
    viewport: viewport.name,
    size: {
      width: viewport.width,
      height: viewport.height
    },
    page,
    checks: {
      appLoaded: page.title === "Tanchiki Prototype",
      canvasExists: page.canvas.exists,
      canvasVisible: page.visibility.canvas,
      canvasNonblank: page.canvas.nonblankPixelCount > 0,
      onboardingVisible: page.visibility.title && page.visibility.objective && page.visibility.controls,
      controlsVisible: page.text.controls.some((item) => /Move/i.test(item))
        && page.text.controls.some((item) => /Fire/i.test(item))
        && page.text.controls.some((item) => /Continue/i.test(item)),
      statusVisible: page.visibility.status && /Mission playing/.test(page.text.status),
      viewportKeepsGameVisible: page.canvas.cssWidth > 0
        && page.canvas.cssHeight > 0
        && page.canvas.cssWidth <= viewport.width
    }
  };
}

function isActionableConsoleError(message) {
  if (message.level !== "error") {
    return false;
  }

  return !knownNonFatalConsolePatterns.some((pattern) => pattern.test(message.text));
}

function isLocalUrl(rawUrl) {
  const url = new URL(rawUrl);
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

async function urlResponds(rawUrl) {
  try {
    const response = await fetch(rawUrl, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}: ${url}`);
  }
  return response.json();
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function main() {
  const report = await runBrowserSmoke({
    url: process.argv.includes("--url")
      ? process.argv[process.argv.indexOf("--url") + 1]
      : defaultAppUrl
  });
  console.log(`${JSON.stringify(report, null, 2)}\n`);
}

class CdpClient {
  static async create(browserWebSocketUrl) {
    const browserSocket = await openWebSocket(browserWebSocketUrl);
    const browserClient = new CdpClient(browserSocket);
    const target = await browserClient.send("Target.createTarget", { url: "about:blank" });
    const tabs = await fetchJson(browserWebSocketUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/devtools\/browser\/.*/, "/json/list"));
    const tab = tabs.find((item) => item.id === target.targetId) ?? tabs[0];
    await browserClient.close();
    const pageSocket = await openWebSocket(tab.webSocketDebuggerUrl);
    return new CdpClient(pageSocket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (event) => this.handleMessage(event));
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(`Browser evaluation failed: ${result.exceptionDetails.text}`);
    }
    return result.result?.value;
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  waitFor(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.on(method, (event) => {
        clearTimeout(timeout);
        resolve(event);
      });
    });
  }

  async close() {
    this.socket.close();
    await delay(50);
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    for (const callback of this.listeners.get(message.method) ?? []) {
      callback(message.params);
    }
  }
}

function openWebSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.addEventListener("open", () => resolve(socket), { once: true });
    socket.addEventListener("error", () => reject(new Error(`Could not connect to ${url}`)), { once: true });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
