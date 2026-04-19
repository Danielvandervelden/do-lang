# Backlog Seed Handler

Shared logic for `--from-backlog <id>` in `phase new` and `wave new`. Called with two parameters:

- **`<target_type>`**: `phase` or `wave`
- **`<target_file>`**: path to the target's markdown file (e.g., `phase.md` or `wave.md`)

## Steps

1. Read `.do/BACKLOG.md` and find entry with `id: <id>`.
2. If not found: error loudly before any mutation — "Backlog entry `<id>` not found. Run `/do:backlog` to verify."
3. If found but `status: done`: warn "Backlog entry `<id>` is already done — seeding anyway."
4. Write backlog entry's problem/fix content into `<target_file>`:
   - phase → `## Goal` body section
   - wave → `## Problem Statement` body section
5. Set `backlog_item: <id>` in `<target_file>` frontmatter (atomic temp-file + rename).
6. Append changelog entry: `<ISO> backlog-seed:<target_type>:<slug>:<id>`.
