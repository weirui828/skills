---
name: castra
description: Give a folder full of projects one standard layout that every coding agent follows - shared rules, shared memory, a record of moved paths, and the same folder names in every project. Use when the user says their projects are a mess or out of control, asks to standardize or audit project structure, wants rules or memory shared across agents (Claude, Codex, Gemini), asks where design docs or generated files should go, or mentions castra.
---

# castra

All Roman camps had the same layout. A soldier could find each part of a camp without a
guide. castra gives the same property to a folder of projects. This folder is the **root** (for
example `~/dev`).

After castra, each name has the same meaning in each project. All agents read the same rules
and the same memory.

castra has four parts. All parts are text files.

| File | Function |
|---|---|
| `<root>/AGENTS.md` | The **rules**. An agent must know them before it starts work. This file is short. |
| `<root>/.agents/memory/` | The **memory**. An agent reads an entry when it applies to the task. Each file contains one fact. `INDEX.md` lists the files. |
| `<root>/MIGRATION.md` | The record of old paths and new paths. |
| `<project>/AGENTS.md` | The rules for one project. Git tracks this file in the project repository. |

## Rule or memory

The topic does not tell you if an item is a rule or a memory. The answer comes from how the
agent gets the item.

- A **rule** loads in every session. Ask this question: is it a mistake to start work without
  this information? If the answer is yes, the item is a rule.
- A **memory** is information that the agent reads when it applies to the task.

Every agent reads all the rules in every session. Thus, keep the rules file below
approximately 100 lines. The memory folder has no limit.

Each new item from the user starts as a memory. Tell the user that a memory can become a rule
when one of these conditions is true:

- The memory was necessary in three or more projects.
- An agent broke the memory because the agent did not read it.

The user makes the decision. Do not make a memory into a rule yourself.

## The standard layout

| Path in a project | Contents | In git? |
|---|---|---|
| `README.md` | Information for users of the project. | yes |
| `AGENTS.md` | Information for agents: stack, commands, layout, project rules. | yes |
| `CLAUDE.md` | One line, `@AGENTS.md`. | yes |
| `docs/` | Only items that ship: a public site, user documents, images for the README. | yes |
| `design/` | Internal material: plans, design documents, research, decisions, prototypes. | no |
| `out/` | Generated items that the user can delete: renders, reports, logs, bundles. | no |

- Use `.git/info/exclude` to exclude personal folders and tool folders (`design/`, agent
  worktrees, tool data). Use `.gitignore` only for items that all contributors must ignore.
- An excluded folder is only in the main checkout. It is not in a worktree. Write this in the
  rules.
- `design/` is local by default. A project can track it in git when agents or reviewers must
  read its documents. The `AGENTS.md` file of that project must say that `design/` is tracked.
- Ignore `.env*` from the first commit.
- Do not put reports, logs or archives in the root of a project.
- Do not put design reasons, status logs or internal notes in a README.
- Use one folder for each project. Give the folder the same name as the repository. Do not put
  a version number in a folder name.
- Keep third-party clones, virtual environments and archives in separate folders. Do not mix
  them with the projects of the user.

These names are defaults. If the user has a different name that all projects use (for example
`notes/` and not `design/`), keep that name and write it in the rules. The same name in all
projects is more important than the name itself.

## Procedure

### 1. Do the audit

The audit does not change files.

1. Run `scripts/audit.sh <root>`. For each project, the script lists the differences from the
   standard layout.
2. Find the rule files that exist: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and rule files for
   other editors. Look in the root, in each project, and in the home folder of each agent.
3. Find the memories that each agent saved. Look for the same instruction in more than one
   location. A duplicate shows that the instruction is possibly a rule.
4. Find the function of `docs/` and of each scratch folder in each project.
5. Give the user a short summary of the results. Put urgent items first (for example a secret
   file that git does not ignore). Do not recommend changes in this step.

The script reports these items:

- no `AGENTS.md` or no `CLAUDE.md`
- a `design/` folder that git tracks, or that git does not exclude
- internal material in `docs/`
- a `.env` file that git tracks or does not ignore
- files that git ignores but continues to track
- scratch folders that have a name other than `out/`
- reports, logs or archives in the root of a project
- no remote
- a folder name that is different from the repository name

### 2. Agree on the rules

1. Write the rules as a short list. Use `references/templates.md` for the structure.
2. Include only the rules that the audit or the words of the user support.
3. Let the user correct the list before you write files.

### 3. Write the root files

1. Use the templates to make these files:
   - `<root>/AGENTS.md`
   - `<root>/CLAUDE.md`, which contains `@AGENTS.md`
   - `<root>/.agents/memory/INDEX.md`
   - `<root>/MIGRATION.md`
2. For each agent that the user runs, read its documentation. Find which instruction files the
   agent loads automatically. Claude Code loads `CLAUDE.md` from parent folders. Other agents
   possibly load only a file in the repository or in their home folder.
3. Give the user this line to add to the global instruction file of each such agent:
   "Before you work in `<root>`, read `<root>/AGENTS.md`."

The home folder of an agent contains the configuration of the user. Write the line and let the
user add it. Do not change these files yourself.

### 4. Combine the memories

1. Copy each memory that applies to more than one project into `<root>/.agents/memory/`.
2. Merge duplicates into one file. If two memories disagree, use the most recent statement of
   the user.
3. Keep the words of the user where they give the reason.
4. Do not delete the original files.
5. Add a row to `MIGRATION.md` for each copy.

Do not put information about one project in the shared memory. That information stays in the
`design/` folder or the `AGENTS.md` file of the project.

### 5. Migrate one project at a time

Do not move files in many projects in one step. Let the user select the sequence of projects.

Some items break when you move them. Examine these items before you recommend a move:

- Python virtual environments
- items that scripts or configuration refer to by an absolute path
- agent memory or history that uses the folder path as a key
- installed plugins and symbolic links
- published URLs

For each project:

1. Run `git status`. Look for other worktrees and for sessions that are in progress. If the
   project has changes that are not committed, stop and ask the user.
2. Show the user each move for the project. Continue only after the user agrees.
3. For files that git tracks, use `git mv`.
4. To stop the tracking of a folder and keep its files, run `git rm -r --cached <folder>`.
   Then add the folder to `.git/info/exclude`.
5. Search the project for the old paths. Look in the README, `AGENTS.md`, scripts, CI
   configuration and ignore files. Update each old path.
6. Add a row to `MIGRATION.md` for each path that moved.
7. Do not commit unless the user tells you to.

### 6. Keep the layout

- Run the audit again when the user asks, and after the user adds a project.
- Save each new instruction from the user as a memory first.
- Add a row to `MIGRATION.md` on the same day that an item moves.

## Limits

- The audit does not change files. For all other steps, get the approval of the user first and
  do one project at a time.
- Do not delete items unless the user tells you to delete them. Move them to an archive
  folder, or stop the tracking.
- Do not commit, push or change git history during a migration unless the user tells you to.
- Do not change agent settings, permission settings or global git settings. Write the change
  and let the user apply it.
- Do not copy secrets, tokens or personal data into the rules, the memories or `MIGRATION.md`.
