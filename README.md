<h2><img src="./dist/icons/icon48.png" alt="CleanIn" width="40" height="40" style="vertical-align: middle; margin-right: 10px;" /> CleanIn</h2>

CleanIn is a simple Chrome extension that hides unwanted feed content masquerading as real content, such as:

1. Suggested posts
2. Promoted and Promoted by posts
3. Feed or sidebar cards matching custom phrases
4. Sidebar content like News and Puzzles

They are hidden by default, but you can show them as transparent in the side panel if you prefer (dimmed on the page instead of removed). Custom phrase matches are highlighted in yellow when transparent mode is enabled, and removed entirely when hidden mode is enabled.

![CleanIn demo](screenshots/cleanin-demo.png)

The source code is available if you'd prefer to build it yourself: [https://github.com/PeterWCox/CleanIn](https://github.com/PeterWCox/CleanIn). I'm open to adding additional functionality—feel free to e-mail me.

## Docs & store releases

- Chrome Web Store form copy and justifications: [docs/chrome-web-store-privacy-answers.md](docs/chrome-web-store-privacy-answers.md) (see also [docs/README.md](docs/README.md)).
- Packaged extension ZIPs for upload: [release/](release/).

## Developer instructions

1. Clone this repo.
2. Optional: [snippets/](snippets/) has small reference HTML files for the feed and sidebar shapes the content script looks for.
3. Run `npm install`.
4. Run `npm run build`.
5. Open `chrome://extensions` in Chrome.
6. Toggle Developer mode on (top right).
7. Click Load unpacked and select the generated `dist/` folder.
8. Visit [linkedin.com](https://www.linkedin.com/) or [linkedin.com/feed](https://www.linkedin.com/feed/) and open the extension side panel to adjust filters.

Chrome Web Store releases and local unpacked installs both use [dist/](dist/) directly, with the normal `CleanIn` name and production icon. The folder is generated from [extension-src/](extension-src/) by [vite.config.ts](vite.config.ts): use `npm run build` or `npm run build:prod` for the extension, and `npm run package:prod` to create the upload ZIP.

## Caveats
- Only matches the English LinkedIn UI. If your LinkedIn is in French, *toutes mes excuses*.
- LinkedIn could rename "Suggested" to "Things You'll Love" tomorrow and break everything. That's the deal you sign when you scrape a SPA.
- Does not, sadly, hide posts that begin with "Unpopular opinion:".

## License
- MIT. Use it, fork it, ship a better version. Just don't promote it on LinkedIn.
