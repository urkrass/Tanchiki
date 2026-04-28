import test from "node:test";
import assert from "node:assert/strict";
import {
  assertBrowserSmokeReport,
  countNonblankPixels,
  inspectPageForSmoke,
  runBrowserSmoke
} from "../scripts/qa-browser-smoke.js";

test("browser smoke report accepts passing viewport checks without console errors", () => {
  assert.doesNotThrow(() => assertBrowserSmokeReport({
    checks: [
      {
        viewport: "desktop",
        checks: {
          appLoaded: true,
          canvasExists: true,
          canvasVisible: true,
          canvasNonblank: true,
          onboardingVisible: true,
          controlsVisible: true,
          statusVisible: true,
          viewportKeepsGameVisible: true
        }
      }
    ],
    consoleErrors: []
  }));
});

test("browser smoke report names failing viewport checks", () => {
  assert.throws(
    () => assertBrowserSmokeReport({
      checks: [
        {
          viewport: "narrow",
          checks: {
            appLoaded: true,
            canvasExists: true,
            canvasVisible: true,
            canvasNonblank: false,
            onboardingVisible: true,
            controlsVisible: true,
            statusVisible: false,
            viewportKeepsGameVisible: true
          }
        }
      ],
      consoleErrors: []
    }),
    /Browser smoke QA failed: narrow: canvasNonblank, narrow: statusVisible/
  );
});

test("browser smoke report includes actionable console errors", () => {
  assert.throws(
    () => assertBrowserSmokeReport({
      checks: [
        {
          viewport: "desktop",
          checks: {
            appLoaded: true
          }
        }
      ],
      consoleErrors: [
        { level: "error", text: "Uncaught TypeError: broken demo" }
      ]
    }),
    /console errors: Uncaught TypeError: broken demo/
  );
});

test("browser smoke reports a deterministic missing-browser error", async () => {
  await assert.rejects(
    () => runBrowserSmoke({
      browserPath: "C:\\missing-tanchiki-browser\\chrome.exe",
      skipServer: true
    }),
    /Browser smoke QA could not find a Chromium executable at C:\\missing-tanchiki-browser\\chrome\.exe/
  );
});

test("nonblank canvas helper counts transparent and black pixels as blank only when fully empty", () => {
  assert.equal(countNonblankPixels(new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 0, 0
  ])), 0);
  assert.equal(countNonblankPixels(new Uint8ClampedArray([
    0, 0, 0, 255,
    12, 0, 0, 0,
    0, 0, 7, 255
  ])), 3);
});

test("page inspection helper is exportable for browser evaluation", () => {
  assert.match(inspectPageForSmoke.toString(), /document\.querySelector/);
  assert.match(inspectPageForSmoke.toString(), /countPixels/);
  assert.match(inspectPageForSmoke.toString(), /nonblankPixelCount/);
});
