---
name: debug-template
description: Template for debug session files in .do/debug/. Follows GSD debug pattern with scientific method workflow.
---

# Debug Session Template

Template for `.do/debug/YYMMDD-<slug>.md` files.

## File Naming

**Format:** `YYMMDD-<slug>.md`

- `YYMMDD`: Date debug session started (e.g., `260413` for 2026-04-13)
- `<slug>`: Kebab-cased from first 5 words of trigger, special characters removed

**Examples:**
- `260413-login-form-undefined-error.md`
- `260412-api-returns-wrong-data.md`

---

## Template

```markdown
---
status: gathering
trigger: "{{TRIGGER}}"
created: {{CREATED_AT}}
updated: {{CREATED_AT}}
current_hypothesis: null
task_ref: null
---

## Current Focus
<!-- OVERWRITE on each update - always reflects NOW -->

hypothesis: 
test: 
expecting: 
next_action: gather symptoms

## Symptoms
<!-- IMMUTABLE after gathering - reference point for what we're fixing -->

expected: 
actual: 
errors: 
reproduction: 
started: 

## Eliminated
<!-- APPEND only - prevents re-investigating dead ends after /clear -->

## Evidence
<!-- APPEND only - facts discovered during investigation -->

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: 
fix: 
verification: 
files_changed: []
```

---

## Frontmatter Fields

| Field | Values | Update Rule |
|-------|--------|-------------|
| `status` | `gathering \| investigating \| fixing \| verifying \| awaiting_human_verify \| resolved` | OVERWRITE on status change |
| `trigger` | Verbatim user input | IMMUTABLE after creation |
| `created` | ISO timestamp | IMMUTABLE after creation |
| `updated` | ISO timestamp | OVERWRITE on every change |
| `current_hypothesis` | Active theory or `null` | OVERWRITE on hypothesis change |
| `task_ref` | Task ID or `null` | Optional link to active task |

---

## Section Rules

### Current Focus
<!-- OVERWRITE entirely on each update -->

**Fields:**
- `hypothesis:` Current theory being tested
- `test:` How we're testing it
- `expecting:` What result means if true/false
- `next_action:` Immediate next step

**Update Rule:** OVERWRITE entirely when hypothesis changes or investigation moves forward. Always reflects what Claude is doing RIGHT NOW. If Claude reads this after `/clear`, it knows exactly where to resume.

### Symptoms
<!-- IMMUTABLE after gathering phase complete -->

**Fields:**
- `expected:` What should happen
- `actual:` What actually happens
- `errors:` Error messages if any
- `reproduction:` How to trigger the bug
- `started:` When it broke / always broken

**Update Rule:** Written during gathering phase, then IMMUTABLE. Reference point for what we're trying to fix. Never modify after gathering complete.

### Eliminated
<!-- APPEND only - never remove entries -->

**Entry Format:**
```
- hypothesis: [theory that was wrong]
  evidence: [what disproved it]
  timestamp: [when eliminated]
```

**Update Rule:** APPEND only. Never remove entries. Prevents re-investigating dead ends after context reset. Critical for efficiency across `/clear` boundaries.

### Evidence
<!-- APPEND only - never remove entries -->

**Entry Format:**
```
- timestamp: [when found]
  checked: [what was examined]
  found: [what was observed]
  implication: [what this means]
```

**Update Rule:** APPEND only. Never remove entries. Facts discovered during investigation. Keep entries 1-2 lines each - just the facts.

### Resolution
<!-- OVERWRITE as understanding evolves -->

**Fields:**
- `root_cause:` Empty until found
- `fix:` Empty until applied
- `verification:` Empty until verified
- `files_changed:` Array of modified files

**Update Rule:** OVERWRITE as understanding evolves. May update multiple times as fixes are tried. Final state shows confirmed root cause and verified fix.

---

## Status Flow

```
gathering -> investigating -> fixing -> verifying -> awaiting_human_verify -> resolved
                  ^                        |
                  |________________________|
                  (if verification fails)
```

**Status Transitions (D-42):**
- `gathering` -> `investigating` (symptoms collected)
- `investigating` -> `fixing` (root cause found) or `verifying` (fix applied)
- `fixing` -> `verifying` (fix applied, testing)
- `verifying` -> `investigating` (verification failed) or `awaiting_human_verify` (self-verification passed)
- `awaiting_human_verify` -> `resolved` (user confirms) or `investigating` (user reports still broken)
- `resolved` -> (terminal state)

---

## Lifecycle

**Creation:** When `/do:debug` is called
- Create file with trigger from user input
- Set status to `gathering`
- Current Focus: `next_action = gather symptoms`
- Symptoms: empty, to be filled

**Symptom Gathering:**
- Update Symptoms section as user answers questions
- Update Current Focus with each question
- When complete: status -> `investigating`

**Investigation:**
- OVERWRITE Current Focus with each hypothesis
- APPEND to Evidence with each finding
- APPEND to Eliminated when hypothesis disproved
- Update `updated` timestamp in frontmatter

**Fixing:**
- status -> `fixing`
- Update `Resolution.root_cause` when confirmed
- Update `Resolution.fix` when applied
- Update `Resolution.files_changed`

**Verification:**
- status -> `verifying`
- Update `Resolution.verification` with results
- If verification fails: status -> `investigating`, try again

**Awaiting Human Verify:**
- status -> `awaiting_human_verify`
- Request explicit user confirmation in a checkpoint
- Do NOT move file to resolved yet

**Resolution:**
- status -> `resolved` (only after user confirms fix)

---

## Size Constraints

Keep debug files focused:
- Evidence entries: 1-2 lines each, just the facts
- Eliminated: brief - hypothesis + why it failed
- No narrative prose - structured data only

If evidence grows very large (10+ entries), consider whether you're going in circles. Check Eliminated to ensure you're not re-treading.
