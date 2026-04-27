# First prompt to paste into local Codex

Read `CODEX_HANDOFF.md` first. Then inspect this repository.

Goal: continue the top-down tank RPG project without rewriting it from scratch. The current priorities are to fix grid-snapping/jitter, make movement smooth but constant-speed, prevent tap-rush acceleration, stop shooting from freezing turning/movement, add spawn validation, then add teams/bases/level progression.

Do not code immediately. First respond with:

1. What framework/build system this project uses.
2. Which files control the game loop, input, movement, collision, shooting, and level loading.
3. Your diagnosis of the grid snapping / shooting lag risks.
4. A small patch plan for the first implementation pass.

After I approve the plan, implement only the first patch.
