# ChatGPT and Codex

Use this file when running covibe in ChatGPT or Codex. Installing the
skill supplies instructions; it does not install a page host, comment
service, or connection back to the conversation.

## Check the available platform

- Inspect the current tools and their documentation. Confirm all three
  delivery functions in section 4 of `SKILL.md`: a stable published URL,
  durable comments readable by the agent, and a supported way to start
  or continue the conversation from a comment.
- A local HTML file or an inline visualization alone does not establish
  those functions. A hosted page alone does not establish a connection
  to ChatGPT or Codex.
- If a function is missing, explain the limitation before building.
  Offer a manual workflow: save comments and let the user ask the agent
  to process them. Label it as manual; do not promise live delivery.

## Embedded ChatGPT apps

Use these APIs only inside an app whose host exposes them, not in an
arbitrary webpage. Prefer the MCP Apps `ui/message` bridge for follow-up
messages. The ChatGPT compatibility helper is
`window.openai.sendFollowUpMessage({ prompt })`. Feature-detect the
available bridge and verify its behavior in the target host.

Save each comment before requesting a follow-up. Include the page ID,
element ID, and comment ID in the message so the agent can fetch the
pending discussion. Apply the live/batch rules in `SKILL.md`; sending a
message is separate from saving a comment.

Keep authoritative comments, replies, and page versions on the app's
server, exposed through tools the agent can read. Widget state is for
the rendered UI instance, not durable discussion storage. Browser local
storage can hold pending drafts when available, but cannot be the only
copy. Render the discussion into each updated page as the skill requires.

An embedded app also needs a stable hosted page URL to satisfy covibe's
publishing requirement. Verify that updates retain that URL.

## Codex and standalone pages

Use an available hosting service and comment backend. Connect delivery
only through an explicitly supported session integration. Do not assume
ChatGPT's widget bridge exists in Codex or an external browser page.

## Official documentation

Checked 2026-10-21. Recheck APIs when implementing an integration.

- [MCP app UI, messaging, and state](https://developers.openai.com/plugins/build/chatgpt-ui)
- [ChatGPT component bridge reference](https://developers.openai.com/plugins/reference)
