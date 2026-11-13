# Claude artifacts

Use this file when you publish the page as a claude.ai artifact.

- Declare the full `comments` capability: `capabilities: {comments: {}}`.
- The layer finds the capability by itself. When `canSendToClaude()`
  is available, live mode and batch mode start your session. If not,
  the layer uses manual mode.
- The layer uses `sendToClaude()` to start your session and `create()`
  for plain comments. A plain comment does not start a cloud session.
- The page cannot read comments. Write the threads into the state JSON
  yourself.
- At the first send, the platform asks the user to let the page comment
  for them. This is normal.
- In the phone app, the app goes back to the chat after each send.
- You cannot resolve a plain comment. You can resolve a thread that the
  user sent to Claude.
- External scripts load only from a few CDNs. Inline the comment layer
  with `scripts/inline.py`. Do not link to it.
