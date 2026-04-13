# LinkedIn Feed Reducer

> A Chrome extension that quietly removes the parts of LinkedIn nobody asked for.

LinkedIn is a great place to find a job, reconnect with old colleagues, and read a 14-paragraph post about how someone's toddler taught them about Q3 KPIs. This extension helps with the first two.

![Feed Reducer Demo](screenshots/demo.png)

## What it does

- **Hides "Suggested" posts** — the ones LinkedIn picks for you because someone you met at a conference in 2017 liked them.
- **Hides "Promoted" posts** — ads, but make it professional.
- **Hides the LinkedIn News widget** — top stories you didn't ask for, served daily.
- **Hides the Puzzles widget** — because your sudoku habit is none of LinkedIn's business.
- **In-page controls** — adds a "Reducer" button right in LinkedIn's top nav, next to "Me", with a popover for toggling everything on the fly.
- **Side panel UI** — same controls in Chrome's side panel if that's more your thing.
- **Two display modes**:
  - **Transparent** — dims filtered posts so you can see what got caught (great for debugging or morbid curiosity).
  - **Hidden** — removes them entirely. Out of sight, out of mind.

## Install (developer mode)

1. Clone this repo.
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select the [dist/](dist/) folder.
5. Visit [linkedin.com/feed](https://www.linkedin.com/feed/) and look for the **Reducer** button in the top nav.

## How it works

LinkedIn is a single-page app that re-renders aggressively and ships obfuscated CSS class names that change between sessions. So instead of brittle selectors, the [content script](dist/content.js):

- Finds the feed container by its `data-component-type="LazyColumn"` attribute.
- Identifies posts by walking children and looking for the literal text **"Suggested"** or **"Promoted"** inside them.
- Identifies sidebar widgets by their label text (`"LinkedIn News"`, `"Today's puzzles"`).
- Re-applies filters on every body mutation (debounced) plus a 2-second safety-net interval, so newly loaded posts on infinite scroll get caught without manual intervention.
- Injects the in-page nav button by cloning an existing nav `<li>` to inherit LinkedIn's styling — chameleon mode.

It's text-matching held together with hope, but it's *resilient* text-matching held together with hope.

## Project structure

```
dist/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker (message passing)
├── content.js             # The main attraction — DOM filtering + in-page UI
├── sidepanel/             # Chrome side panel UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
└── icons/
```

## Tech

- Chrome Extension Manifest V3
- Vanilla JavaScript (no build step, no framework, no apologies)
- `chrome.storage.sync` for settings persistence across devices

## Caveats

- Only matches the English LinkedIn UI. If your LinkedIn is in French, *toutes mes excuses*.
- LinkedIn could rename "Suggested" to "Things You'll Love" tomorrow and break everything. That's the deal you sign when you scrape a SPA.
- Does not, sadly, hide posts that begin with "Unpopular opinion:".

## License

MIT. Use it, fork it, ship a better version. Just don't promote it on LinkedIn.
