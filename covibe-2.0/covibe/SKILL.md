---
name: covibe
description: Use when the user wants to refine a design, plan, architecture or decision by commenting on a visual page instead of turn-by-turn chat; builds a commentable published page and updates it as comments arrive.
---

# Covibe

Covibe changes content into a page that the user comments on.
The user writes comments at any time. You reply and change the page
at your own speed. Each time, publish the page again at the same URL.
The page is the record of the discussion.

This skill has a reference comment layer in `assets/`. Use it. Do not
write your own comment layer.

## 0. Before you start

1. Tell the user that covibe is for content that already has a shape.
   For an early, open discussion, chat is better.
2. Ask the user to select a mode:
   - **Live mode**: Each text comment goes to you immediately.
   - **Batch mode**: Comments collect. They go to you together after
     N comments. The default value of N is 5. The user can push
     "Process now" to send them sooner.
   - **Manual mode**: Comments collect on the page. The user pushes
     "Copy for chat" and pastes the comments into the chat.
3. If your platform cannot start your session from the page, the layer
   uses manual mode. Tell the user why.

## 1. Two layers

- **Vibe layer**: This layer is the content. You select the layout,
  the colors, the language and the visuals. Use the content and the
  preferences of the user. On a desktop, show all of the content. On a
  phone, let the user move through the elements one at a time.
- **Comment layer**: This layer is `assets/comment-layer.js` and
  `assets/comment-layer.css`. Do not change its behavior. To change its
  appearance, set the `--cv-*` CSS tokens.

## 2. Build the page

1. Start from `assets/template.html`.
2. Write the content. Give each element that the user can comment on a
   `data-covibe-id` attribute.
   - Make each ID unique. Do not change an ID. Do not use an ID again.
   - For a diagram node or an arrow, put the attribute on its `<g>`.
     The layer shows a marker on it.
   - Add `data-covibe-label` with a short name when the text of the
     element is not a good name.
3. Keep the `<section id="covibe-meta">` element. The layer shows the
   trash and the version log in it.
4. Write the state into `<script type="application/json"
   id="covibe-state">`. Section 3 gives the format.
5. Keep the page with the markers as your source file. Edit only the
   source file, not the built file.
6. Put the comment layer into a built copy. Run
   `python3 scripts/inline.py page.html build.html`. If you cannot run
   scripts, copy the two files into the marked blocks of the copy.
7. Call `Covibe.mount({ root: ... })` after the layer script.
8. Publish the built copy. Keep the same URL for all later versions.

## 3. State format

The page embeds one JSON object:

- `schema`: `"covibe/2"`.
- `session`: A unique ID for this discussion. Do not change it.
- `revision`: A number. Add 1 each time you publish.
- `mode`: `"live"`, `"batch"` or `"manual"`.
- `batchSize`: The value of N for batch mode.
- `lang`: `"en"` or `"zh"` for the labels of the layer.
- `threads`: An object. Each key is an element ID. Each value is a list
  of entries, in sequence.
  - A user entry: `{"id", "who": "user", "text", "mark"?, "quote"?}`.
  - A reply: `{"id", "who": "agent", "text", "rev", "replyTo": [ids]}`.
    Set `rev` to the new revision.
- `status`: An object. Set an element ID to `"waiting-for-user"` when
  you ask the user a question about it.
- `handled`: A list of comment IDs that you handled.
- `trash`: A list of deleted elements: `{"id", "label", "html"}`.
  Keep the original ID. Put the original markup in `html`.
- `versions`: A list of `{"revision", "summary"}`. Add one line for
  each publication.

## 4. What the layer does

You do not write this behavior. Know it, so that you can tell the user.

- The user taps any element to comment. A comment box opens below the
  element. For a small element, it opens in a panel.
- Links and buttons operate as usual. The user turns on review mode to
  comment on them.
- The comment box has four quick marks: Like, Dislike, Explain and
  Delete. "Explain" means: give more information. "Delete" means: move
  the element to the trash.
- The comment of the user shows immediately, marked "waiting".
- Each comment gets a comment ID. The layer keeps it in local storage
  until `handled` contains that ID.
- If local storage fails, the layer tells the user. It does not show
  the comment as saved.
- Unread replies are easy to see. A reply is "read" only when the user
  taps it. A button goes to the next unread reply.
- A control hides and shows all of the comment layer.
- The layer shows comment text as plain text.

## 5. Delivery

Each comment that the page sends starts with `[elementId|commentId]`.
A mark shows as `[like]`, `[dislike]`, `[explain]` or `[delete]`. A
quote shows in `«»`.

- **Live mode**: A text comment starts your session. A mark without
  text does not start your session.
- **Batch mode**: The page keeps comments as plain comments. After N
  text comments, or when the user pushes "Process now", the page sends
  one message. The message starts with `[batch]` and lists the waiting
  IDs. The layer does not send the same IDs again.
- **Manual mode**: The user pastes the comments into the chat. The text
  starts with `covibe <session> r<revision>`.

Some phone apps go back to the chat after the page sends a comment.
The layer shows a short note about this on touch devices. For long
sessions, tell the user to use a desktop with the chat and the page
adjacent to each other.

The data for each platform is in `references/`.

## 6. Procedure for comments

1. Each time your session starts, read all unresolved comments on the
   page. Do not read only the comment that started the session.
2. Ignore each comment whose ID is in `handled`. Do not compare text.
3. A comment without a comment ID (for example, a native comment) gets
   an ID from you. Use the anchor or the quote to find its element. If
   you cannot find the element, ask the user.
4. Read the source file again before you change it. Read only the
   state block when that is sufficient. Do not read the built file.
5. If many comments wait, read them as one group.
   - If two comments on the same element conflict, use the newer one.
   - Answer each independent question.
   - Ignore deleted comments. If a comment and its deletion are in the
     same group, ignore both.
6. Reply to simple questions first. Then make structural changes.
7. For each comment:
   - Add the user entry to `threads`, with the same comment ID.
   - Add your reply, with `rev` set to the new revision. One reply can
     answer many comments.
   - Add the comment ID to `handled`.
8. For "Delete", move the element into `trash`. For a "restore" comment
   on a trash item, put the element back with its original ID.
9. Add 1 to `revision`. Add one line to `versions`.
10. Publish the page again at the same URL.
11. In the platform thread, write one short reply that refers to the
    page. Then resolve the thread, if your platform lets you.
12. If you asked the user a question, set the status of that element to
    `"waiting-for-user"`. Keep that thread open.
