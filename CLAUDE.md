# do

Token-efficient meta programming language for Claude Code.

## Skill Creation

When you create a new skill file or make heavy edits to an existing one, at the end of the entire implementation flow remind the user to invoke `/skill-creator` to review and polish the skill. Do not invoke it yourself.

## Git Workflow

- Use conventional commits
- Branch naming: `feat/<description>`, `fix/<description>`, `chore/<description>`
- Allowed prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

## Post-task

After completing any task in this repo, check if the README is still accurate. Flag it to the user if the change affects the feature list, install instructions, or agent pipeline overview.
