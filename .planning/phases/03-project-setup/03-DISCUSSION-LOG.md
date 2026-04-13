# Phase 3: Project Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Session:** 2026-04-13
**Phase:** 03-project-setup

---

## Area Selection

**Q:** Which areas do you want to discuss for Project Setup?
- [ ] Detection & Trigger
- [ ] config.json Schema
- [ ] Default Settings
- [ ] Integration Pattern

**A:** All four areas selected

---

## Detection & Trigger

**Q1:** When should project-level init be triggered?
- [ ] Automatic on any /do:* (Recommended)
- [ ] Only on explicit /do:init
- [ ] Part of /do:task flow

**A:** Automatic on any /do:*

---

**Q2:** What should /do:init do when run in an already-initialized project?
- [ ] Health check mode
- [ ] Show config
- [ ] Reset option

**A:** Health check mode

---

**Q3:** How should the check work — just folder existence or marker-based?
- [ ] Folder existence only
- [ ] Marker in config.json
- [ ] Both

**A:** Both

---

## config.json Schema

**Q4:** How should council review toggles be structured?
- [ ] Nested object
- [ ] Flat keys
- [ ] Single toggle + modes

**A:** Nested object

---

**Q5:** What else should config.json include beyond council toggles and grill threshold?
- [ ] Active task pointer
- [ ] Version marker
- [ ] Project metadata
- [ ] Runtime preference

**A:** Version marker, Project metadata
**User note:** "Should we also include the model that council review should use? I know we have a /codex review command or whatever (I don't think we have the same for claude) but can we specify what model to use for codex or claude if we execute these commands"

---

**Q6:** How should council model preferences be configured?
- [ ] Per-review-type models
- [ ] Single model setting
- [ ] Claude's discretion

**A:** Per-review-type models

---

**Q7:** Should active_task be in config.json or tracked separately?
- [ ] In config.json
- [ ] Separate state file
- [ ] Infer from tasks/

**A:** In config.json

---

## Default Settings

**Q8:** Should council reviews be enabled by default?
- [ ] Both off by default
- [ ] Both on by default
- [ ] Planning on, execution off

**A:** User custom response
**User note:** "When we /do:init a project (or /do:scan) on initial setup we ask the user what they want."

---

**Q9:** What questions should project init ask during interactive setup?
- [ ] Council review preferences
- [ ] Grill threshold
- [ ] Database entry check
- [ ] Project name

**A:** All four selected

---

## Integration Pattern

**Q10:** How should project-level init integrate with /do:init?
- [ ] Context-aware /do:init
- [ ] Always both checks
- [ ] Separate commands

**A:** User asked "What do you think is better?"

**Claude recommendation:** "Always both checks" — reasoning:
1. Consistency with "automatic on any /do:*" trigger pattern
2. Idiot-proof UX — user doesn't need to think about context
3. Health check mode handles re-runs
4. Matches the workspace → project → database gate pattern

---

**Q11:** Does the 'always both checks' approach work for you?
- [ ] Yes, always both
- [ ] Context-aware instead
- [ ] Separate commands

**A:** Yes, always both

---

*Log generated: 2026-04-13*
