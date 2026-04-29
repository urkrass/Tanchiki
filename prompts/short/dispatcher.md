# Tanchiki Dispatcher

Use Linear MCP and GitHub.

Active Linear project:
<Tanchiki project name>

Run the Tanchiki Dispatcher for the next eligible issue in the declared active project.
Follow `ops/context-manifest.md` and the role protocol selected by the issue labels.
Work one issue only.

Before opening or updating a PR, use `.github/PULL_REQUEST_TEMPLATE.md` as the
required section source of truth. Do not rename headings, shorten headings, or
replace them with older variants.

Stop if the issue lacks exactly one `role:*`, `type:*`, `risk:*`, or `validation:*` label.
Stop on unresolved blockers, stop labels, human gates, missing context, or unsafe scope drift.

Do not merge.
Do not mark Done.
