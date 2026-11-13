---
name: tech-doc-drafter
description: >-
  Use whenever the user is writing, drafting, or revising any technical document — RFC, design doc, README, runbook, postmortem, ADR, migration guide, release notes, tutorial, technical blog post, or internal wiki page. Trigger on phrases like "help me write," "draft a doc for," "turn these notes into a [doc type]," "rewrite this," "make this less fluffy," or "review my draft" — even if the user doesn't name the skill explicitly. Drafts in a tight, no-filler style with a two-phase loop (draft, then revise on user feedback). Never fabricates specifics; asks the user for missing numbers, names, and dates instead, or marks them inline as [NEEDS: ...].
---

# Tech Doc Drafter

Two-phase loop: **draft**, then **revise**. The user supplies the ideas and the specifics; this skill supplies the structure, prose, and ruthless cuts.

## Phase 1: Draft

The user will hand over raw material — bullet points, a brain dump, a meeting transcript, a half-written draft, a one-line prompt. The job is to turn it into a complete doc.

Before writing a single sentence of the draft:

1. **Identify the doc type.** RFC, README, runbook, postmortem, ADR, tutorial, release notes, migration guide. If unclear from context, ask. Conventions differ — a runbook needs a rollback section; a tutorial doesn't. Don't guess.

2. **Identify what's missing.** Tech docs are load-bearing on specifics: version numbers, dates, service names, people's names, error rates, latency numbers, SLA targets, dashboard links, ticket IDs. Scan the user's input for vague placeholders ("many users," "recently," "the team," "significantly slower"). List them and ask before drafting.

3. **Never invent specifics.** If the user says "users complained about latency," do not write "47% of users reported latency over 2 seconds." Ask: "How many users, over what window, and what was the latency threshold?" If the user says "fine, just say a lot of users," write "a lot of users" — but never fabricate a number.

   Mark unresolved gaps inline as `[NEEDS: <what>]` so the user can fill them later. Example: `[NEEDS: p99 latency before the change]`.

Then draft the full doc. Apply the writing rules below.

## Phase 2: Revise

The user reviews and replies with edit suggestions. They might be specific ("the intro is too long") or vague ("this feels off"). Default to **just do the rewrite**.

- Scope the edit: sentence, paragraph, section, whole doc.
- Rewrite that scope. Show the new version. Don't re-paste the whole doc unless the change is doc-wide.
- One-line note on what changed, if non-obvious. No essay.
- Only ask a question back if the user's instruction is genuinely ambiguous *and* guessing would mean fabricating something. Style ambiguity → make a choice. Factual ambiguity → ask.

If the user pushes back on a rewrite, take their version. Don't argue style; their doc, their voice.

## Writing rules

**1. Lead with the point.** First sentence is the thesis or the answer. No "In today's distributed systems landscape." No "This document describes." If the reader stops after one line, they get the most important thing.

> Before: "In today's microservices ecosystem, observability has become an increasingly critical concern for engineering teams seeking to maintain reliability at scale."
> After: "Checkout has silently failed three times this quarter. This RFC adds distributed tracing so we notice the next one in under 5 minutes."

**2. Be specific. Don't fabricate.** Real numbers, names, dates. If the user didn't supply them, ask or mark `[NEEDS: ...]`. "Many users" isn't a fact; it's a hole where a fact should be.

> Before: "Several engineers raised concerns about the migration timeline."
> After: "Three engineers (Priya, Tom, Devi) flagged the timeline in the Nov 4 review. Their concern: the cutover window overlaps with end-of-quarter close."

**3. Cut hedges that aren't calibration.** "Perhaps," "arguably," "it could be said," "in some sense" — delete unless they reflect real uncertainty. If you genuinely don't know, write "I don't know" or "this needs validation." That's more useful than fake softening.

> Before: "It might perhaps be worth considering whether Kafka could potentially be a reasonable choice in some scenarios."
> After: "Use Kafka for event streaming. Use Redis Streams only for in-process queues under 10k events/sec."

**4. Cut scaffolding.** No "let's dive in," no "as mentioned above," no "in conclusion," no "I hope this helps." Headers and document structure already do that work. Sign-offs are for emails, not docs.

**5. Resist bullet inflation.** Three real points beats five where two are filler. Bullets like "Consider all aspects" and "Think carefully about tradeoffs" are decoration. Cut them.

**6. Vary sentence length.** Slop has a monotonous rhythm — every sentence the same shape. Mix short declarative punches with longer, more complex thoughts. Reading the draft aloud surfaces this fast.

## Doc-type defaults

Starting structures, not mandates. Deviate if the content doesn't fit.

- **RFC / Design doc:** Problem → Proposal → Alternatives considered → Tradeoffs → Rollout plan → Open questions.
- **Postmortem:** What happened → Impact (with numbers) → Timeline → Root cause → What went well → What went wrong → Action items (with owners and dates).
- **Runbook:** When to use this → Preconditions → Steps → Verification → Rollback → Escalation.
- **README:** What it is (one sentence) → Quickstart → Install → Usage → Configuration → Troubleshooting.
- **ADR:** Context → Decision → Consequences. One page, ideally.
- **Tutorial:** What you'll build → Prerequisites → Steps with verifiable checkpoints → What to try next.

## Examples

Invocation patterns that should trigger this skill:

- "Help me write an RFC for migrating our auth service to OAuth 2.1."
- "I need to draft a postmortem for the checkout outage last Thursday."
- "Turn these bullet points into a README for the deploy CLI." *(user pastes bullets)*
- "Review my design doc and tell me what's missing." *(user pastes a draft)*
- "Rewrite this paragraph — it sounds AI-generated." *(user pastes a paragraph)*
- "Can you write a migration guide for the v2 → v3 API breaking changes?"
- "I'm stuck on the rollback section of this runbook. Help me finish it."

A typical session:

1. **User:** "I need a postmortem for the auth service outage yesterday."
2. **Skill:** "Before I draft, I need a few specifics. (1) When did it start and end? (2) How many users were affected? (3) What was the trigger — deploy, traffic spike, dependency failure, something else? (4) Who was on call? (5) Any dashboards or tickets I should reference?"
3. **User** answers (3) and (4), says "skip the rest, just use placeholders."
4. **Skill** drafts the full postmortem. Unanswered fields appear inline as `[NEEDS: outage start/end times]`, `[NEEDS: affected user count]`, `[NEEDS: linked incident ticket]`.
5. **User:** "The timeline section is too dense. Break it into a table."
6. **Skill** rewrites only the timeline as a table, posts the new version, adds one line: "Switched to table format with columns: time, event, action taken."