---
name: commit
description: Stage changed files and create a conventional commit message
disable-model-invocation: true
---

Stage all files changed in this conversation and create a git commit.

## Commit message format

`<type>: <concise description>` (imperative mood, ≤72 chars)

Available types:
- `feat` — new feature
- `fix` — bug fix
- `refactor` — restructuring without behavior change
- `test` — adding or updating tests
- `chore` — tooling, config, deps, CI
- `docs` — documentation only
- `style` — formatting/whitespace only
- `perf` — performance improvement

## Rules
- **Never add `Co-Authored-By` lines**
- Stage specific files by name — avoid `git add -A`
- If nothing changed or the right type is ambiguous, ask before committing

## Steps

1. Run `git status` and `git diff` to see what changed.
2. Stage only the relevant files.
3. Commit using a HEREDOC to pass the message.
4. Print the commit SHA and message.
