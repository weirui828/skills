# covibe state (covibe/2)

The state is the only thing the page knows about the discussion. The layer
renders threads, trash and the version log from it; it never reads the comment
store. Rewrite `<page-dir>/.covibe/state.json` every round, then publish.

`publish.py` injects the state into the page (`window.COVIBE.state`) and bumps
`revision` when you pass `--summary`.

## Shape

```json
{
  "schema": "covibe/2",
  "session": "design-review",
  "pageId": "design-review",
  "revision": 3,
  "mode": "live",
  "batchSize": 5,
  "lang": "en",
  "agentName": "Agent",
  "threads": {
    "card-2": [
      { "id": "c-7f3k", "who": "user", "marks": ["dislike"], "quote": "", "text": "too dense", "ts": 1761350400000 },
      { "id": "a-1",    "who": "agent", "text": "Split into two cards; the second one is optional.", "rev": 3 }
    ]
  },
  "status": { "card-2": "waiting-for-user" },
  "handled": ["c-7f3k"],
  "trash": [],
  "versions": [
    { "revision": 1, "summary": "First draft." },
    { "revision": 3, "summary": "Split the dense card in two." }
  ]
}
```

## Fields

| Field | Rule |
|---|---|
| `schema` | always `"covibe/2"` |
| `session` | stable id for this review; also the localStorage namespace; never change it |
| `pageId` | optional, defaults to `session`; sent with every post |
| `revision` | published revision. `publish.py --summary` increments it and appends to `versions` |
| `mode` | `live` \| `batch` \| `manual`; the page server also receives it (`publish.py --mode`) |
| `batchSize` | batch threshold, default 5 |
| `markDelivery` | optional `immediate` (default: marks are delivered like comments) or `defer` (covibe 1.1 §4: marks wait for the next text comment). `publish.py --mark-delivery` overrides it |
| `updateMode` | optional `hotswap` (default: the open page updates itself in place), `banner` (asks with a Reload button) or `off` (no polling). `publish.py --update-mode` overrides it |
| `lang` | `en` or `zh` — the comment layer's UI language |
| `agentName` | label on your replies, default "Agent" |
| `threads` | `{elementId: [entry, …]}`, oldest first. Keys must be ids that exist in the page or in `trash` |
| `status` | optional `{elementId: "waiting-for-user"}` — renders "waiting for you" on that element. Use it only when you asked the user a question |
| `handled` | array of comment ids you have dealt with. This is the only definition of handled — never compare comment text |
| `trash` | `[{id, label, html}]` for deleted elements: keep the id, a label, and an html snapshot shown collapsed |
| `versions` | `[{revision, summary}]` — one line per publish, shown in the version log |

## Thread entries

- `id` — comment id. For user comments use the id the page sent (`[elementId|commentId]`);
  for your own replies make one up (`a-1`, `a-2`, …) and keep it stable.
- `who` — `"user"` for the user's comment, `"agent"` for your reply.
- `text`, `marks` (`like` | `dislike` | `explain` | `delete`), `quote` — copy them from
  the comment you are answering. `marks` may be empty.
- `rev` — on agent entries only: the revision that carries the reply. Entries with
  `rev` equal to the current, not-yet-seen revision render as unread.
- `ts` — milliseconds, optional.

## Rules the checker enforces

1. No duplicate `data-covibe-id` in the page.
2. Ids that were in the previous publish must still be in the page, or in `trash`.
   Never change or reuse an id.
3. Every thread key must have an element in the page (or an entry in `trash`).
4. Every thread entry needs a unique comment id.
5. Every user comment in a thread should end up in `handled` (warning if it does not).

Run `publish.py --strict` while you are still learning the shape; keep it on
if the page is long-lived.
