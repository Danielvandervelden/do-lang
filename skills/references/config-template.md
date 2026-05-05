---
name: config-template
description: "Template for .do/config.json. Used by /do:init project setup."
---

# Project Config Template

Copy the JSON below into `.do/config.json`. Substitute `{{PROJECT_NAME}}` with the confirmed project name and apply user choices for council, models, threshold, and database fields.

Supported `council_reviews.reviewer` values: `claude`, `codex`, `gemini`, `both`, `random`.

```json
{
  "version": "0.3.0",
  "project_name": "{{PROJECT_NAME}}",
  "database_entry": false,
  "active_task": null,
  "active_debug": null,
  "active_project": null,
  "auto_grill_threshold": 0.9,
  "project_intake_threshold": 0.85,
  "council_reviews": {
    "planning": true,
    "execution": true,
    "reviewer": "random",
    "project": {
      "plan": true,
      "phase_plan": true,
      "wave_plan": true,
      "code": true
    }
  },
  "web_search": {
    "context7": true
  },
  "models": {
    "default": "sonnet",
    "overrides": {}
  },
  "delivery_contract": {
    "onboarded": false,
    "dismissed": false,
    "entry_commands": []
  },
  "context_keywords": {}
}
```

The `context_keywords` field is optional. When present, it enables per-project keyword-to-doc mapping for targeted context loading in both the full planner and the fast-path FE-2 context scan. Keys are doc filename stems (without `.md`) from the project's database `components/`, `tech/`, or `features/` subdirectories. Values are arrays of keywords that trigger loading that doc when found in a task description.

Example: `"store-state": ["useSelector", "useDispatch", "redux"]` will load `tech/store-state.md` whenever a task description mentions `useSelector`, `useDispatch`, or `redux`. Compound keywords like `react-hook-form` use phrase matching; simple words like `api` use word-boundary matching to prevent false positives.
