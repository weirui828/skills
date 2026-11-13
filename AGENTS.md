# AGENTS.md — skills

The rules in `~/dev/AGENTS.md` apply. This file gives only the rules for this repository.

## Contents

Each top-level folder is one skill, or one version of a skill. The `README.md` file gives the
list of folders and the platforms that each one supports.

## Rules

- Each skill folder has a `SKILL.md` file (lowercase extension) with `name` and `description`
  front matter.
- Do not change an old covibe version (`covibe/`, `covibe-1.1/`, `covibe-2.0/`) to add a
  feature. Make a new version folder or a new binding folder.
- When you add, remove or rename a skill folder, update the table in `README.md`.
- Local-only skills (`rune/`, `wei-studio/`) are in `.git/info/exclude`. Do not commit them.
- Do not commit packaged archives (`*.zip`). Put them in `out/`.

## Tests

- `covibe-dsh`: `node covibe-dsh/test/run.js`
- `covibe-2.0`: `node covibe-2.0/covibe/assets/test/run.js` (needs `jsdom`: `npm i jsdom`)
