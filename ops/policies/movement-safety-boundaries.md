# Movement Safety Boundaries

Movement is the highest-risk gameplay surface in Tanchiki.

## Protected File

`src/game/movement.js` owns canonical movement state and interpolation. It must not be edited by docs, harness, UI, test-only, progression, or normal gameplay issues unless the issue explicitly authorizes movement work.

## Required Labels For Movement Work

Movement work must use:

- `type:movement`
- `validation:movement`
- normally `risk:human-only`

Automation must not run movement work while `risk:human-only`, `human-only`, or `needs-human-approval` is present.

## Movement Validation

Approved movement work requires:

- full movement regression tests
- `npm test`
- `npm run build`
- `npm run lint`
- manual movement QA checklist
- explicit notes about player feel, collision, turn behavior, and interpolation

## Adjacent Work

Collision, spawn validation, pathfinding, and AI routing should normally live outside `movement.js`. If adjacent work appears to require movement changes, stop and ask for architecture review or human approval.
