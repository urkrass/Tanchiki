# Repair Paired-Review Queue

Use Linear MCP.

Active Linear project:
<project>

Repair the campaign queue after Architect selected paired-review.

Do not edit repo files.
Do not open PRs.
Do not merge.
Do not mark Done.

## Task

Create missing paired Reviewer issues for every PR-producing Coder/Test issue
identified by Architect.

For each new paired Reviewer issue, include:

- `review_cadence: paired-review`
- linked producer issue;
- expected PR state: open, non-draft, unmerged, checks passing;
- paired-review decision language:
  - `APPROVED FOR AUTO-MERGE AFTER HUMAN APPLIES merge:auto-eligible`
  - `APPROVED FOR MERGE`
  - `CHANGES REQUESTED`
  - `HUMAN REVIEW REQUIRED`
  - `BLOCKED`
- role/type/risk/validation labels;
- `model_hint`;
- Reviewer App identity requirement if applicable.

Wire dependencies:

```text
Producer issue
-> paired Reviewer issue
-> next implementation issue
```

Do not add `automation-ready` to new Reviewer issues.

Report:

- created or confirmed paired Reviewer issue IDs;
- linked producer issue for each Reviewer issue;
- dependency order;
- any PR-producing issue that still lacks a paired Reviewer issue;
- any human action required.
