# Templates

How to use these templates:

- Replace `<root>` with the path of the root folder.
- Replace each `<...>` line with the rule of the user. If the user has no rule for it, remove
  the line.
- Do not keep a rule only because it is in the template.

## `<root>/AGENTS.md`

```markdown
# AGENTS.md — rules for all projects in <root>

These rules apply to every agent and to every project in `<root>`.
Read this file before you start work.

## Before you start

1. Read the memory index: `<root>/.agents/memory/INDEX.md`. Open each entry that applies to
   your task.
2. Read the `AGENTS.md` file of the project. If a project rule is stricter than a rule in this
   file, obey the project rule.
3. If a path in a document or an old conversation does not exist, find it in
   `<root>/MIGRATION.md`.

## Layout

| Path | Contents | In git? |
|---|---|---|
| `README.md` | Information for users of the project. | yes |
| `AGENTS.md` | Information for agents: stack, commands, layout, project rules. | yes |
| `CLAUDE.md` | One line, `@AGENTS.md`. | yes |
| `docs/` | Only items that ship. | yes |
| `design/` | Internal plans, design documents, research, decisions. | no |
| `out/` | Generated items that you can delete. | no |

- Use `.git/info/exclude` to exclude personal folders and tool folders. Do not use `.gitignore`.
- The `design/` folder is only in the main checkout. If you work in a worktree, use `design/`
  in the main checkout.
- Ignore `.env*`. Do not commit secrets, local paths or personal data.
- Do not put reports, logs or archives in the root of a project.

## Git

- <when the agent can commit, and the meaning of each short command of the user>
- <rules for branches and pull requests>

## Safety

- Work only in the project where the session started.
- Ask the user before you delete data, spend money, or write outside the project.
- Do not change agent settings, permission settings or global settings. Write the change and
  let the user apply it.

## Writing

- <length of answers, when to ask questions, language, document style>

## Memory

The shared memory is in `<root>/.agents/memory/`. Each file contains one fact. `INDEX.md` lists
the files.

- A rule is information that you must know before you start work. Rules are in this file.
- A memory is information that you read when it applies to your task. Memories are in the
  memory folder.
- When the user tells you something that applies after this session, save it as a memory. If
  an entry exists for the same fact, update that entry.
- Put information about one project in the `design/` folder or the `AGENTS.md` file of that
  project.
- Do not add a rule to this file. If a memory was necessary in three or more projects, or an
  agent broke it, tell the user. The user makes the decision.
- When you move or rename an item that other documents refer to, add a row to
  `<root>/MIGRATION.md`.
```

## `<root>/CLAUDE.md`

```markdown
@AGENTS.md
```

## `<root>/.agents/memory/INDEX.md`

```markdown
# Shared memory index

This index has one line for each memory. Read it before you start work. Open each entry that
applies to your task.

## <topic>

- [<slug>](<slug>.md) — <description in one line>
```

## A memory file

```markdown
---
name: <slug>
description: <one line; an agent uses it to decide if it must open the file>
type: preference | environment | reference | lesson
scope: all | <project name>
source: <the person who said it, the date, and the agent that recorded it>
---

<the fact>

**Why:** <the event, or the words of the user>
**How to apply:** <the action that changes>
```

## `<root>/MIGRATION.md`

```markdown
# MIGRATION.md — old paths and new paths

This file records each file and folder that moved.

- If a path in a document, a memory or an old conversation does not exist, find it in this file.
- When you move or rename an item, add a row to **Done** on the same day.

## Done

| Date | Old | New | Note |
|---|---|---|---|

## Names that are different

| Name that you see | Folder or meaning |
|---|---|

## Planned, not done

No item in this table has moved. The old path is the correct path until the item moves.

| Old | New | Why | Caution |
|---|---|---|---|
```

## `<project>/AGENTS.md`

This file can be public. Write it for a reader who does not know the user or the computer. Do
not refer to `<root>/AGENTS.md`, local paths or the shared memory. Do not copy the root rules
into it.

```markdown
# AGENTS.md — <project>

<one sentence that says what this project is>

## Stack
## Commands
<the commands to install, run, test and lint>
## Layout
<the important folders, and the files that you must not edit manually>
## Rules
<the rules for this project only: invariants, items that you must not commit, review steps>
```
