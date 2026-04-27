# Follow-up prompt for Codex after it inspects the repo

Implement the first patch only:

- Fix movement so the tank moves grid-cell to grid-cell with smooth interpolation.
- Enforce constant speed.
- Prevent tap-rushing from increasing speed.
- Keep collision checks based on target cells.
- Do not change unrelated gameplay systems.
- Add a debug overlay or simple console/debug state if useful for verifying logical cell vs render position.

After editing, run the available lint/test/build command. Then explain manual test steps.
