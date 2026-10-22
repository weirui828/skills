# covibe

**Async coworking with your AI agent.**

Install the skill, then say something like:

- "Let's covibe the architecture of my project."
- "Covibe my travel plan for Japan."
- "Covibe this README."
- "Let's covibe the pros and cons of these two job offers."
- "Covibe the onboarding flow of my app."

Chatting with an agent is turn-based. You type and wait. It answers with a wall of text. You scroll back to find the one part you disagree with, then try to point at it in words. You think in fragments; the agent works in bursts. The two paces never line up.

covibe turns the agent's answer into a live page you both work on. Tap any part of it and leave a thought the moment you have it. The agent picks up your comments, answers next to them and updates the page at the same link. You keep thinking at your pace, it keeps working at its own, and nobody waits on anybody. It feels less like chatting with a tool and more like coworking on a shared doc.

It works best for **refining** something that already has a shape: a draft, a design, a plan you want to get right. For brainstorming from zero, plain chat is still the better tool.

## What you get

- **Point, don't describe**: Tap the exact spot you mean. No more "the third paragraph from the top".
- **One-tap reactions**: Like, Dislike, Explain, Delete. Add words only when you want to.
- **Conversations stay in place**: Each discussion sits next to the part it is about, even on a tiny diagram node.
- **Keep going, don't wait**: Your comments appear instantly. Replies land when the agent is ready.
- **Never miss a reply**: New answers stand out until you open them.
- **Clean view**: Hide every comment with one tap and read the content alone.
- **Nothing is lost**: Deleted parts keep their discussions and can come back.
- **See what changed**: Every update leaves one line in the version log.
- **Your rhythm**: Get an answer to every comment, or let them collect and send them in one go.

## Install

The skill is the `covibe/` folder. It includes a tested, dependency-free comment layer (`covibe/assets/`), so the agent writes only your content, not the commenting UI.

- **Claude (claude.ai and the apps)**: zip the `covibe/` folder and upload it in Claude's skill settings.
- **Claude Code**: copy `covibe/` into your skills directory, for example `~/.claude/skills/covibe/`.
- **Other agents with skill support**: the main instructions are platform-neutral. A platform needs a stable page URL, a comment store, and a way for a comment to start the agent's session.

## How it works

- `covibe/SKILL.md`: the instructions the agent follows.
- `covibe/assets/comment-layer.js` and `.css`: the comment layer. No dependencies; the agent inlines it into each page with `covibe/scripts/inline.py`.
- `covibe/assets/template.html`: the page skeleton. `example.html` is a full demo.
- `covibe/references/`: notes for each platform.

The page state (threads, handled comments, trash, version log) lives as JSON inside the page, so every version is self-contained.

## Development

```
npm i jsdom
node covibe/assets/test/run.js
```

The tests use fake platform adapters to check the comment layer: anchoring, review mode, live/batch/manual delivery, handled-by-ID, unread, hide/show, storage failure, trash and plain-text safety.
