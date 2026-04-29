# Visual Readability QA Evidence

Campaign: Visual readability and juice pass - board, actors, and feedback
Issue: MAR-254
Date: 2026-04-30

## Scope

This QA pass verifies the merged visual readability work from PR #102 and PR
#103 without changing production gameplay or rendering code.

Checked surfaces:

- player, enemy, and base readability at gameplay scale;
- facing direction and shot feedback during the first playable flow;
- projectile, pickup, impact, and base-objective feedback from the renderer
  coverage added in PR #103;
- wall/floor polish and grid alignment through browser smoke and canvas
  visibility checks;
- mission status hierarchy after the visual pass;
- desktop and narrow viewport behavior.

## Evidence

`npm run qa:browser-smoke`

- Passed.
- URL: `http://127.0.0.1:5173`
- Browser: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Desktop viewport: `1280x900`
  - canvas visible and nonblank;
  - objective, controls, and mission status visible;
  - canvas backing size `720x528`, CSS size `720x529`;
  - nonblank pixel count `380160`;
  - no console errors.
- Narrow viewport: `390x760`
  - canvas visible and nonblank;
  - objective, controls, and mission status visible;
  - canvas backing size `720x528`, CSS size `366x269`;
  - nonblank pixel count `380160`;
  - no console errors.

`npm run qa:demo-snapshot`

- Passed.
- Opening state remains Level 1 of 3 with mission status `playing`.
- Player starts at grid `1,1`, facing `right`, with `3/3` HP.
- Enemy base starts alive at `6/6` HP.
- Victory state records enemy base destroyed and next action as choosing an
  upgrade.
- Upgrade flow advances to Level 2 and preserves campaign progression.
- Sprite manifest reports ready status with 13 sprites and no manifest errors.

`npm run qa:first-demo-flow`

- Passed.
- Opening state starts Level 1 of 3 with mission status `playing`.
- Space firing records one active projectile and status text includes
  `Shell fired.`
- Arrow-right movement starts toward grid `2,1` and arrives at grid `2,1`.
- Victory state records enemy base destroyed and upgrade selection pending.
- Applying the first upgrade allows next-level progression.
- Next level starts at Level 2 of 3 with mission status `playing`.

## Visual Observations

- The board remains grid-aligned in both desktop and narrow smoke checks.
- Mission status remains visible beside the board and continues to name the
  objective, player HP, enemy count, base HP, fire control, and pickups.
- The first-demo flow confirms facing direction and shot feedback are still
  represented in gameplay state after the visual pass.
- The renderer test coverage from PR #103 exercises the restrained feedback
  cues without changing sprite request semantics.

## Residual Risk

- Browser smoke verifies visibility, nonblank canvas output, and layout health,
  but it does not perform pixel-level art approval.
- The QA scripts validate deterministic gameplay and UI state; subjective
  polish quality still benefits from human visual inspection before public
  demo release notes.
- No new follow-up issue is required from this QA pass. A future visual QA
  issue could add screenshot comparison if the project later wants automated
  pixel baselines.
