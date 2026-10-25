# skills

A small collection of agent skills, plus the platform bindings that make the
multi-platform ones actually run.

## What is here

| Directory | What it is | Works on |
|---|---|---|
| `covibe/` | early covibe: the skill, the Claude artifact binding, and notes for ChatGPT/Codex | Claude (live). ChatGPT / Codex: manual only |
| `covibe-1.1/` | **platform-neutral covibe spec**: §4 asks for one reference file per platform (`references/`) | Claude (live). DeepSeek Harness (live, via `covibe-dsh`). ChatGPT embedded apps (partial). Codex (manual only) |
| `covibe-2.0/` | covibe with a reference comment layer, built directly on the Claude artifact APIs | **Claude only.** For any other platform start from `covibe-1.1` and add a binding |
| `covibe-dsh/` | the covibe 1.1 binding for **DeepSeek Harness**: comment layer, loopback page + comment server, JSONL store, watcher job that wakes the agent | DSH 0.2.1-rc.3+ (live). Manual mode works anywhere with a browser |
| `tech-doc-drafter/` | unrelated: a documentation drafting skill | — |

## Which one do I install?

- **Claude (claude.ai, apps, Claude Code)** → `covibe-2.0/` (or `covibe-1.1/` if you
  prefer the smaller, platform-neutral spec).
- **DeepSeek Harness** → `covibe-dsh/`. See its README for the two commands and the
  wake contract.
- **ChatGPT embedded app** → `covibe-1.1/` plus `references/chatgpt-codex.md`; the
  `ui/message` bridge can start a follow-up, but a hosted page and comment store are
  still yours to provide.
- **Codex, or any agent with no way for a page to start the session** → `covibe-1.1/`
  in manual mode: build the page, let the user comment, and have them paste the
  comments into the chat. Live/batch modes need a real session bridge.

## A platform needs three things

`covibe-1.1` §4 states the requirement plainly: a stable published URL, durable
comments the agent can read, and a way for a comment to start or continue the agent's
session. A skill install gives instructions, not hosting. Each version here documents
how far it got on each platform in its `references/` directory.

## Version history

- `covibe/` — first version: spec + Claude binding + ChatGPT/Codex notes
- `covibe-1.1/` — spec made platform-neutral, with one reference file per platform
- `covibe-2.0/` — reference comment layer implementation for Claude artifacts
- `covibe-dsh/` — 1.1 bound to DeepSeek Harness (local server + job-wake loop)
