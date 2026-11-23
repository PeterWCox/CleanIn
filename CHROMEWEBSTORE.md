# Chrome Web Store Listing — CleanIn

Last updated: 2026-11-23

## Store listing

- Name: CleanIn - Hide LinkedIn promoted and suggested posts
- Short description: Hide suggested, promoted, and promoted-by posts on your LinkedIn feed.
- Version: 2.0.0 (Manifest V3)
- Item ID: `nhnfpheccmajiphgfdehelakpblamgjp`
- Category: Social Networking
- Language: English (United Kingdom)

### Detailed description

CleanIn is a simple Chrome extension that hides unwanted LinkedIn content like:

1. Suggested posts
2. Promoted and Promoted By posts
3. Sidebar content like News, Puzzles and Ads
4. Photos in posts and comments
5. Videos in posts and comments

Choose Show, Fade or Hide separately for each filter. Fade dims content instead of removing it. Hidden photos and videos have a small reveal button so you can open them when you want.

Your existing preferences carry over when you update. You can also export a backup of your settings and restore it later.

CleanIn works with the English LinkedIn interface. It does not collect browsing data or send page content to a server. Your preferences sync through Chrome.

Reviews are really appreciated, along with any suggestions for new features or bugs you may have found.

## Single purpose

Make the LinkedIn feed easier to read by letting users show, dim or hide unwanted feed content and sidebar sections using settings in the extension popup.

## Permissions justification

| Permission | Purpose |
| --- | --- |
| `scripting` | Load the feed filtering script on eligible LinkedIn tabs, including tabs already open when CleanIn starts. |
| `storage` | Save display preferences and sync them through Chrome; export and restore settings backups. No LinkedIn credentials or profile data are stored. |
| LinkedIn host permissions | Apply filters on the LinkedIn homepage and `/feed` paths. No other website access is requested. |

Permissions and host access are unchanged in 2.0.0.

## Privacy and data use

No developer-operated data collection, analytics or network transmission exists in the extension. Page content is inspected on the device to apply filters. Preferences use Chrome sync; backups are user-managed JSON files. Store dashboard analytics are separate from extension behaviour.

The existing dashboard has no data-collection categories selected and all three data-use certifications selected. Preserve these disclosures. The privacy-policy URL is currently blank in the dashboard; no policy URL was invented or added for this draft.

## Graphics and assets

The manifest references existing icons at 16, 32, 48, 64 and 128 pixels. The existing store icon and screenshot are retained. Review the screenshot for relevance before submission.

Generated promotional previews matching TLDA’s simple white layout, bold feature text and free badge:

| Asset | Dimensions | File | Status |
| --- | --- | --- | --- |
| Small promo tile | 440 × 280 | `store/promo-small-v1.jpg` | Generated; not uploaded |
| Marquee promo tile | 1400 × 560 | `store/promo-marquee-v1.jpg` | Generated; not uploaded |

Both exports are opaque JPEGs. They use CleanIn’s blue logo and describe current feed, sidebar, photo and video controls.

## Distribution and developer

Published listing: public, publisher `peter.w.cox`. The published version observed on 2026-11-23 is 1.5.2. Keep existing distribution, contact details and publication preferences.

## Build and release

GitHub Actions: `.github/workflows/build-extension.yml` follows TLDA’s release workflow: pushes to `main` and `codex/dev`, plus manual runs, install with a frozen pnpm lockfile, build a production package, check version consistency and JavaScript syntax, create a versioned ZIP, then upload it inside the `chrome-store-zip` artifact. The job has a 15-minute timeout and action versions are pinned to commit hashes. Run tests and type checking before pushing; they are separate from the release packaging flow. Store upload is manual and does not submit the item for review.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| 2.0.0 | 2026-11-23 | Show/Fade/Hide controls with icons and info tips; media reveal buttons; updated popup; backup and restore; legacy settings support. New-position artwork remains visible. | Draft |

## Review notes

Prepare and save the 2.0.0 package and listing as a draft only. Do not submit for review or publish as part of this task. English LinkedIn UI is required; LinkedIn layout changes can affect detection. The retired new-position preference is accepted only for legacy compatibility and has no filtering effect.
