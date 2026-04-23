# Chrome Web Store — Privacy tab answers (CleanIn)

Copy you can paste into the Chrome Web Store **Privacy** tab. Written to match a packaged manifest with side panel, storage, and host permissions limited to the LinkedIn home page and feed URLs only (no `activeTab` unless you add it back).

---

## Single purpose description

CleanIn has one job: make the LinkedIn home/feed experience easier to read by hiding feed clutter the user does not want (for example suggested posts, promoted posts, and optional sections such as news or puzzles), using on-device rules the user controls in the extension’s side panel. It does not change LinkedIn outside the specific home page and feed URLs it is allowed to run on, and it does not perform unrelated functions.

---

## sidePanel justification

The side panel is the extension’s settings UI. Users turn filters on or off and choose display options there. Chrome’s `sidePanel` permission is required so the extension can register and show that panel next to the page while the user is on LinkedIn.

---

## storage justification

Settings (which categories to hide and display preferences) are saved with `chrome.storage.sync` so choices persist across sessions and devices signed into the same Chrome profile. No LinkedIn credentials or personal profile data are stored—only the extension’s own boolean/options keys.

---

## activeTab justification

If the packaged manifest only lists `sidePanel` and `storage`, and the dashboard still asks for `activeTab`, either re-upload the package so it matches the manifest, or add this only if you actually request that permission:

*Not used in the current version; content scripts are limited to `https://www.linkedin.com/` and `https://www.linkedin.com/feed*` via host permissions, so `activeTab` is unnecessary.*

If you **remove** `activeTab` from the uploaded extension, that field may disappear from the form.

---

## Host permission justification

Host access is limited to `https://www.linkedin.com/` and `https://www.linkedin.com/feed` (and feed path variants). That is where the content script runs so it can observe the LinkedIn home/feed experience and hide matching UI nodes according to saved settings. The extension does not request broad `<all_urls>` access; it only targets the specific LinkedIn URLs needed for this single purpose.

---

## Remote code

The extension should **not** load or execute remote code (no dynamic script URLs, `eval`, or network-loaded extension logic). For the store you should answer **No, I am not using remote code** and leave the remote-code justification empty. Answering “Yes” when the extension is fully bundled will slow review and create inconsistent disclosures.

If you already selected “Yes,” switch to **No** after confirming the shipped build has no remote code.

---

## What user data do you plan to collect?

CleanIn does **not** collect, transmit, or sell user data to the developer. Processing happens locally in the browser to adjust the page the user is viewing. **Do not check** PII, health, financial, authentication, personal communications, location, web history, user activity logging, or website content **for collection**, unless Google’s wording in your region explicitly treats purely local DOM styling as something you must declare (in that edge case, some teams tick **Website content** with a note that nothing is sent off-device—your privacy policy should match whatever you select).

For this extension, **no boxes** is usually correct if the form allows it and your policy states no collection/transmission.

---

## Certification

After using the above, the disclosures should match: single purpose (feed cleanup), minimal permissions, no remote code, no user data collection.

You can add a short **privacy policy** on your site or listing that matches these answers if the store requires a policy URL.
