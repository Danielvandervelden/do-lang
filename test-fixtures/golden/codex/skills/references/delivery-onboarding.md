---
name: delivery-onboarding
description: "One-time onboarding flow for the delivery contract. Triggered by /do:task and /do:fast when --delivery is absent and the project config's delivery_contract.onboarded flag is false. Presents three options to the user and marks onboarded: true after any choice."
---

# Delivery Contract Onboarding Flow

This reference is loaded by `do:task` (Step -1) and `do:fast` (Step 0) when:
- `$ARGUMENTS` does NOT contain `--delivery=...`
- The project config key `delivery_contract.onboarded` is `false` (or absent)

It is a one-time flow. After any of the three options is chosen, `onboarded: true` is written to `.do/config.json` and this flow never triggers again.

---

## The One-Time AskUserQuestion

Present this to the user using `AskUserQuestion`:

---

**Delivery Contract Setup**

The delivery contract lets you specify branch name, commit prefix, push policy, and exclude paths directly in task files — so the executioner always knows exactly how to deliver work.

You're seeing this because this project hasn't been wired up yet. How would you like to proceed?

**Option 1 — Help me wire it up**
I'll read your entry command file(s) (e.g., `/jira:start`), propose edits to make them pass `--delivery=...` to `/do:task`, and wait for your confirmation before changing anything.

**Option 2 — Give me a prompt**
I'll generate a self-contained prompt you can paste into another Claude session to wire things up yourself.

**Option 3 — I'll handle it / don't care**
Skip the setup. I'll use project defaults from `project.md` for branch and commit rules. You can always set this up later.

---

## Option 1: Help me wire it up

### Step OB-1: Ask which entry command file(s) to wire

Ask: "Which file(s) contain your entry commands (e.g., `/jira:start`)? Please provide absolute or repo-relative paths."

Wait for the user's answer.

### Step OB-2: Read each file

Use the Read tool to load each entry command file the user named.

### Step OB-3: Propose edits

For each file, analyze how it currently invokes `/do:task` or `/do:fast` and propose Edit changes that:

1. Determine the branch name (from the work item ID, user input, or whatever the entry command already derives)
2. Determine the commit prefix (from the project's allowed prefixes in `project.md`)
3. Build the `--delivery='...'` JSON argument using those values
4. Append `--delivery='...'` before the description argument in the `/do:task` or `/do:fast` invocation

Reference `skills/references/delivery-contract.md` for the exact schema.
Reference `skills/scripts/validate-delivery-contract.cjs` for the validator the entry command should optionally call.

Present the proposed edits clearly — show old and new invocation lines. Do NOT apply edits yet.

### Step OB-4: Wait for user confirmation

Ask: "Do these edits look correct? [Y/n]"

If yes: apply the edits using the Edit tool.
If no: ask what to change and iterate.

### Step OB-5: Mark onboarded

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
if (!c.delivery_contract) c.delivery_contract = {};
c.delivery_contract.onboarded = true;
c.delivery_contract.dismissed = false;
c.delivery_contract.entry_commands = <array of paths the user provided>;
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
console.log('delivery_contract.onboarded = true');
"
```

Set `delivery_contract = null` for this invocation and proceed. The entry command is now wired — future invocations will pass `--delivery` automatically.

---

## Option 2: Give me a prompt

### Step OB-6: Generate the wiring prompt

Generate this self-contained prompt and present it to the user for copying:

---

```
I need to wire the delivery contract into my entry command for the do-lang task workflow.

**What is the delivery contract?**
The delivery contract is a --delivery='...' argument passed to /do:task or /do:fast. It tells the executioner which branch to work on, which commit prefix to use, and when to push/stop. It makes the executioner self-contained — it doesn't read AGENTS.md or project.md for these rules.

**The schema (from skills/references/delivery-contract.md):**
- delivery.branch (string, required) — e.g., "feat/LLDEV-851"
- delivery.commit_prefix (string, required) — e.g., "feat"
- delivery.push_policy (string, default "push") — "push" | "no-push"
- delivery.pr_policy (string, default "create") — "create" | "skip"
- delivery.stop_after_push (boolean, default true) — stop after push for user review
- delivery.exclude_paths (string[], default [".do/"]) — never stage these paths

**How to pass it:**
/do:task --delivery='{"branch":"feat/LLDEV-851","commit_prefix":"feat"}' "description"

**The validator (skills/scripts/validate-delivery-contract.cjs):**
const { validateDeliveryContract, applyDefaults, parseDeliveryArg } = require('skills/scripts/validate-delivery-contract.cjs');

**My entry command file(s):** [you fill in the paths]

Please read those files and propose edits to wire them to pass --delivery='...' to /do:task (or /do:fast) for each invocation.
```

---

### Step OB-7: Mark onboarded

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
if (!c.delivery_contract) c.delivery_contract = {};
c.delivery_contract.onboarded = true;
c.delivery_contract.dismissed = false;
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
console.log('delivery_contract.onboarded = true');
"
```

Set `delivery_contract = null` for this invocation and proceed. The user will wire the entry command in a separate session.

---

## Option 3: I'll handle it / don't care

### Step OB-8: Mark onboarded and dismissed

```bash
node -e "
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('.do/config.json', 'utf8'));
if (!c.delivery_contract) c.delivery_contract = {};
c.delivery_contract.onboarded = true;
c.delivery_contract.dismissed = true;
fs.writeFileSync('.do/config.json', JSON.stringify(c, null, 2));
console.log('delivery_contract.onboarded = true, dismissed = true');
"
```

Set `delivery_contract = null` for this invocation and proceed. The executioner will use project defaults from `project.md` for branch and commit rules. **This is the only path where implicit behavior is permitted.**

Future cold-starts (no `--delivery` passed) will use project defaults silently — the onboarding question will never appear again.

---

## After Any Option

Return control to the caller (task.md Step -1 or fast.md Step 0) with `delivery_contract` set to the contract object (if wired via Option 1) or `null` (if Option 2 or 3). The caller proceeds with the rest of its flow.

**Agent authorization after onboarding:** Once control returns to the caller, the
caller's own Agent Authorization section governs all downstream agent spawns. No
additional authorization is required from the onboarding flow — the caller's
authorization (declared in `task.md` or `fast.md`) covers all agents that will be
spawned for the task. The onboarding flow itself spawns no agents.
