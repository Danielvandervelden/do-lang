---
name: classify-findings
description: Shared classify-findings instructions for PR-4.5 and CR-4.5. Loaded by stage-plan-review.md and stage-code-review.md when combined verdict is ITERATE.
---

# Classify Findings

Classify the combined findings from self-review and council into blockers and nitpicks.

**The orchestrator constructs the actual invocation — this is not a copy-paste script.** The inputs (`self_review_output` and `council_agent_output`) are multiline markdown/text from agent responses. They may contain apostrophes, double quotes, and newlines that would break any shell string literal. The orchestrator must write the agent output to a temporary file or use a heredoc to pass it safely to Node.js.

**Instructions for the orchestrator:**

1. Resolve the `council-invoke.cjs` path (installed or dev):
   - Installed: `~/.codex/skills/do/scripts/council-invoke.cjs`
   - Dev: `<cwd>/skills/scripts/council-invoke.cjs`
2. Write the self-reviewer output to a temp file (e.g. `/tmp/do-self-review.txt`) and the council agent output to another (e.g. `/tmp/do-council-review.txt`). If council is disabled, write an empty file for the council path.
3. Run `parseSelfReviewFindings()` on the self-review agent's output text.
4. Run `parseCouncilRunnerOutput()` on the council agent's output text (the flattened `VERDICT: ...\nAdvisor: ...\nFindings:\n- ...\nRecommendations:\n- ...` block from codex-council-reviewer). Do NOT use `parseFindings()` — that function parses raw advisor markdown with `### Key Findings` headers, not council runner output.
5. Merge the results into a single `allFindings` array.
6. Run `classifyFindings()` on the merged array to produce `{ blockers: [...], nitpicks: [...] }`.
7. Write the JSON result to stdout (via `JSON.stringify`) so it can be captured as `classified_findings_json`.

Example invocation using temp files (the orchestrator adapts this to its actual tool — Bash with heredoc, Write tool + Bash, etc.):

```bash
# Step 1: write agent outputs to temp files (orchestrator does this via Write tool or heredoc)
# /tmp/do-self-review.txt   <- full text of self-review agent response
# /tmp/do-council-review.txt <- full text of council agent response (or empty)

# Step 2: invoke the classifier
node -e "
const path = require('path');
const fs = require('fs');
const installedPath = path.join(require('os').homedir(), '.claude/commands/do/scripts/council-invoke.cjs');
const devPath = path.join(process.cwd(), 'skills/scripts/council-invoke.cjs');
const scriptPath = fs.existsSync(installedPath) ? installedPath : devPath;
const { parseSelfReviewFindings, parseCouncilRunnerOutput, classifyFindings } = require(scriptPath);
const selfText = fs.readFileSync('/tmp/do-self-review.txt', 'utf8');
const councilText = fs.readFileSync('/tmp/do-council-review.txt', 'utf8');
const selfFindings = parseSelfReviewFindings(selfText);
const councilFindings = parseCouncilRunnerOutput(councilText);
const allFindings = [...selfFindings, ...councilFindings];
const classified = classifyFindings(allFindings);
console.log(JSON.stringify(classified));
"
```

Store the stdout as `classified_findings_json` (a JSON string, e.g. `{"blockers":[...],"nitpicks":[...]}`).
