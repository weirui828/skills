# Claude artifacts

Use this file when you publish the page as a claude.ai artifact.

- Declare the full `comments` capability.
- Get the anchor of an element with `anchorFor(element)`.
- To start your session, use `sendToClaude({anchor, text})`. Before you
  use it, call `canSendToClaude()`.
- `create()` keeps a plain comment. A plain comment does not start a
  cloud session.
- The page cannot read comments. Write the threads into the page
  yourself.
- At the first send, the platform asks the user to let the page comment
  for them. This is normal.
- In the phone app, the app goes back to the chat after each send.
- You cannot resolve a plain comment. You can resolve a thread that the
  user sent to Claude.
