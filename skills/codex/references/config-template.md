---
name: config-template
description: "Template for .do/config.json. Used by /do:init project setup."
---

# Project Config Template

Copy the JSON below into `.do/config.json`. Substitute `{{PROJECT_NAME}}` with the confirmed project name and apply user choices for council, models, threshold, and database fields.

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
  }
}
```
