# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Photinder is a Chrome Extension (Manifest V3) that adds a swipe-based triage overlay to Google Photos. Users click the extension icon on `photos.google.com` to start swiping through photos — Keep or Delete. "Delete" clicks the photo's native checkbox in the DOM; when done, the user trashes all selected photos via Google Photos' built-in UI. No API keys or authentication needed.

## Commands

- `npm run lint` — ESLint
- `npm run lint:fix` — ESLint with auto-fix
- `npm run format` — Prettier write
- `npm run format:check` — Prettier check (used in CI)

## CI

GitHub Actions (`.github/workflows/lint.yml`) runs `npm run lint` and `npm run format:check` on pushes/PRs to `main`.

## Architecture

All extension logic lives in three files at the repo root:

- **`background.js`** — Service worker. Listens for extension icon clicks (`chrome.action.onClicked`) and sends a `toggleTriage` message to the content script.
- **`content.js`** — Injected on `photos.google.com`. Contains all triage logic: DOM discovery, overlay UI, keyboard handling, undo, and load-more scrolling. Wrapped in an IIFE for scope isolation.
- **`content.css`** — Overlay styles. Uses `#pt-` prefixed IDs to avoid collisions with Google Photos.

### Key content.js internals

- **`scanPhotos()`** finds photos via `a[href*="/photo/"]` links, extracts sibling `[role="checkbox"]` elements and thumbnail URLs from CSS `background-image`. Skips already-swiped photos using `seenHrefs` set.
- **`triageAction("delete")`** dispatches a click on the checkbox to select it in Google Photos.
- **`undoAction()`** reverses the last action using a `history` stack.
- **`loadMorePhotos()`** hides the overlay, scrolls the page to trigger lazy loading, rescans for new photos, and resumes.
- Keyboard listener runs in the **capture phase** with `stopImmediatePropagation()` to prevent Google Photos from intercepting keys (especially Escape clearing selections).

### Google Photos DOM assumptions

These selectors are fragile and may break if Google changes their markup:

- Photo items: `a[href*="/photo/"]` with `ariaLabel` like `"Photo - Portrait - Feb 20, 2026..."`
- Checkboxes: `[role="checkbox"]` in the same parent container as the photo link
- Thumbnails: CSS `background-image` on divs using `usercontent.google.com` URLs
- Google Photos virtualizes the grid — only ~50 photos exist in the DOM at a time

## Code style

- ESLint 9 flat config with browser + `chrome` globals
- Prettier defaults
- Source files use `sourceType: "script"` (not ES modules) since they run as Chrome extension scripts
