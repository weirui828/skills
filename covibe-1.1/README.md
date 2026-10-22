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

The skill is the `covibe/` folder.

- **Claude (claude.ai and the apps)**: zip the `covibe/` folder and upload it in Claude's skill settings.
- **Claude Code**: copy `covibe/` into your skills directory, for example `~/.claude/skills/covibe/`.
- **Other agents with skill support**: the main instructions are platform-neutral. A platform needs a stable page URL, a comment store, and a way for a comment to start the agent's session.
