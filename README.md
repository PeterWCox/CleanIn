<h2><img src="./dist/icons/icon48.png" alt="CleanIn" width="40" height="40" style="vertical-align: middle; margin-right: 10px;" /> CleanIn</h2>

CleanIn is a simple Chrome extension that hides unwanted feed content masquerading as real content, such as:

1. Suggested posts
2. Promoted and Promoted by posts
3. Sidebar content like News and Puzzles

They are hidden by default, but you can show them as transparent in the General settings if you prefer (dimmed on the page instead of removed).

![CleanIn demo](screenshots/cleanin-demo.png)

The source code is available if you'd prefer to build it yourself: [https://github.com/PeterWCox/CleanIn](https://github.com/PeterWCox/CleanIn). I'm open to adding additional functionality—feel free to e-mail me.

## Docs & store releases

- Chrome Web Store form copy and justifications: [docs/chrome-web-store-privacy-answers.md](docs/chrome-web-store-privacy-answers.md) (see also [docs/README.md](docs/README.md)).
- Release TLDR:
  1. Create a `VX.Y.Z` release branch, for example `V1.5.0`, and bump `dist/manifest.json` on that branch.
  2. Push the branch to start Azure. `main` does not trigger builds.
  3. Azure validates that the manifest version matches the branch name, validates the extension files, and publishes the `cleanin-chrome-store-v*.zip` artifact in `Build Dist`.
  4. In the `Upload to Chrome Store` manual stage, download the artifact, upload it to the Chrome Developer Store, and resume the pipeline.
  5. Release the uploaded package through the Chrome Web Store, then merge the release branch into `main` after production testing.

## Developer instructions

1. Clone this repo.
2. Optional: [snippets/](snippets/) has small reference HTML files for the feed and sidebar shapes the content script looks for.
3. Open `chrome://extensions` in Chrome.
4. Toggle Developer mode on (top right).
5. Click Load unpacked and select the `dist/` folder.
6. Visit [linkedin.com](https://www.linkedin.com/) or [linkedin.com/feed](https://www.linkedin.com/feed/) and open the extension side panel to adjust filters.

Chrome Web Store releases and local unpacked installs both use [dist/](dist/) directly, with the normal `CleanIn` name and production icon. There is no local source build step; Azure validates the checked-in folder and creates the Chrome Web Store artifact automatically in the first stage. The second stage is the manual store upload/release gate.

## Caveats
- Only matches the English LinkedIn UI. If your LinkedIn is in French, *toutes mes excuses*.
- LinkedIn could rename "Suggested" to "Things You'll Love" tomorrow and break everything. That's the deal you sign when you scrape a SPA.
- Does not, sadly, hide posts that begin with "Unpopular opinion:".

## License
- MIT. Use it, fork it, ship a better version. Just don't promote it on LinkedIn.
