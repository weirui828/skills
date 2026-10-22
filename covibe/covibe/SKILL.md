---
name: covibe
description: Use when the user wants to refine a design, plan, architecture or decision by commenting on a visual page instead of turn-by-turn chat; builds a commentable published page and updates it as comments arrive.
---

# Covibe

Covibe changes content into a page that the user comments on.
The user writes comments at any time. You reply and change the page
at your own speed. Each time, publish the page again at the same URL.
The page is the record of the discussion.

## 0. Before you start

1. Tell the user that covibe is for content that already has a shape.
   For an early, open discussion, chat is better.
2. Ask the user to select a mode:
   - **Live mode**: Each text comment goes to you immediately.
   - **Batch mode**: Comments collect. They go to you together after
     N comments. The default value of N is 5. The page has a
     "Process now" button. The user pushes this button to get an
     answer sooner.

## 1. Two layers

The page has two layers.

- **Vibe layer**: This layer is the content. You select the layout,
  the colors, the language and the visuals. Use the content and the
  preferences of the user to make the selection. Make the page
  applicable to the device. On a desktop, show all of the content.
  On a phone, let the user move through the elements one at a time.
- **Comment layer**: This layer is the comment function in section 2.
  Its behavior must be the same on all pages. You select its appearance
  and its position.

## 2. Comment layer: necessary functions

1. **All visible elements**: The user can comment on each visible
   element. Examples are text, headings, cards, status labels, chart
   elements, arrows, buttons and images.
   - When the user touches an element, open a comment box adjacent to
     the element or below it.
   - Do not add a separate "Comment" button.
   - If the user selects text, put that text in the comment as a quote.
2. **Quick marks**: Put four quick marks in the comment box: Like,
   Dislike, Explain and Delete.
   - The user can send a mark with text or without text.
   - "Explain" means: give more information.
   - "Delete" means: move the element to the trash.
   - A mark without text does not start your session (refer to
     section 4).
3. **Immediate display**: Show the comment of the user in its position
   immediately. Mark the comment as "waiting". Your reply shows when you
   publish the page again.
4. **Threads on their elements**: Each element keeps its thread. A thread
   is the comments of the user and your replies, in sequence.
   - For a block element, for example a card or a paragraph, show the
     thread directly below the element.
   - A small element is, for example, a diagram node, an arrow or a data
     point. Put a small marker on each small element. The marker shows the
     number of comments. When the user touches the marker, open the
     thread adjacent to the element. On a desktop, use a pop-up or a
     side panel. On a phone, use a panel that comes up from the bottom.
   - The user must go from an element to its thread in one step.
   - The user must go from a thread to its element in one step.
     Highlight the element when this occurs.
   - The page cannot read comments. Thus, write all threads into the
     page each time you update it.
5. **Unread replies**: Make each unread reply easy to see. This includes
   the small markers. Give the user a function to go to the next unread
   reply. A reply is "read" only when the user touches it. A reply that
   the user scrolls past is not "read".
6. **Hide and show**: Give a control that hides and shows all of the
   comment layer. This includes the markers.
7. **Trash**: Move each deleted element to the trash. Keep its thread and
   its original ID. Show the element collapsed. The user restores it with
   the comment "restore".
8. **Version log**: Add one line to the version log each time you
   publish the page.
9. **Batch mode**: Show the number of comments that wait. Show a
   "Process now" button.

## 3. Data rules

- Give a unique ID to each element that the user can comment on. Use a
  DOM ID. For canvas content, keep the ID in the data model.
- Do not change an ID. Do not use an ID again.
- You select how to make IDs. Do not show IDs to the user.
- Put the ID of the element at the start of each comment that the page
  sends.
- Keep the comments that the user sent in local storage. When your new
  page contains a comment, remove that comment from local storage.

## 4. Delivery

Your platform must have three functions:

- It publishes the page at a URL that does not change.
- It keeps the comments.
- It starts your session when a comment comes in.

Before you make the page, make sure that your platform has these
functions. If a function is not available, tell the user what will not
operate.

- Make the comment box yourself. Then you control which comments start
  your session.
- On many platforms, a plain comment does not start the session of the
  agent. The page must send the comment through the start function of
  the platform. If this function is not available, keep the comment as a
  plain comment. Tell the user this in the comment box.
- Not all comments must start your session:
  - Keep a quick mark without text as a plain comment.
  - In batch mode, keep all comments as plain comments. The page counts
    them. When the count is N, the page sends one message that starts
    your session. The page also sends it when the user pushes
    "Process now". The message gives the number of comments that wait.
- Some phone apps go back to the chat after the user sends a comment. On
  touch devices, show a short note about this in the comment box.
- For long sessions, tell the user to use a desktop. Show the chat and
  the page adjacent to each other.

The data for each platform is in `references/`. There is one file for
each platform.

- For Claude artifacts, read [references/claude-artifacts.md](references/claude-artifacts.md).
- For ChatGPT or Codex, read [references/chatgpt-codex.md](references/chatgpt-codex.md).

## 5. Procedure for comments

1. Each time your session starts, read all unresolved comments on the
   page. Do not read only the comment that started the session. This
   includes quick marks and comments from batch mode.
2. When the words of a comment are in the page, that comment is
   "handled". Ignore handled comments. (Some platforms do not let you
   resolve plain comments.)
3. Read the page again before you change it.
4. If many comments wait, read them as one group.
   - If there are two comments on the same element, use the newer
     comment.
   - Ignore deleted comments.
   - If a comment and its deletion are in the same group, ignore both.
5. Reply to simple questions first. Then make structural changes. Tell
   the user what you changed.
6. Write the comment of the user and your reply into the thread of the
   element.
7. Add one line to the version log.
8. Publish the page again at the same URL. The page is the primary
   record.
9. In the platform thread, write one short reply that refers to the
   page. Then resolve the thread. "Resolved" means "handled".
10. Keep a thread open only if you asked the user a question. Mark that
    element as "waiting for a decision".
