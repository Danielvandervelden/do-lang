# Pointer File Templates

Templates for CLAUDE.md, CURSOR.md, and GEMINI.md pointer files.
These files point to AGENTS.md as the canonical source of instructions.

---

## CLAUDE.md Template

```markdown
# Instructions for Claude

See [AGENTS.md](./AGENTS.md) for all coding assistant instructions.

This file exists for Claude Code compatibility. All instructions are maintained in AGENTS.md to avoid duplication across AI tools.

<!-- do init completed v{{VERSION}} -->
```

---

## CURSOR.md Template

```markdown
# Instructions for Cursor

See [AGENTS.md](./AGENTS.md) for all coding assistant instructions.

This file exists for Cursor compatibility. All instructions are maintained in AGENTS.md to avoid duplication across AI tools.
```

---

## GEMINI.md Template

```markdown
# Instructions for Gemini

See [AGENTS.md](./AGENTS.md) for all coding assistant instructions.

This file exists for Gemini compatibility. All instructions are maintained in AGENTS.md to avoid duplication across AI tools.
```

---

## Usage Notes

- Only CLAUDE.md contains the "do init completed" marker (used for detection)
- The marker includes the version for upgrade tracking
- All files use relative links to AGENTS.md
- Keep pointer files minimal — no instruction duplication
