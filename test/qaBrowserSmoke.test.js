import test from "node:test";
import assert from "node:assert/strict";
import {
  assertBrowserSmokeReport,
  inspectPageForSmoke
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

test("page inspection helper is exportable for browser evaluation", () => {
  assert.match(inspectPageForSmoke.toString(), /document\.querySelector/);
  assert.match(inspectPageForSmoke.toString(), /nonblankPixelCount/);
});
