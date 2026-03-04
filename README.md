# Photinder

A Chrome extension for swiping through your Google Photos — **Keep** or **Delete**, one by one. Photos marked for deletion get selected in Google Photos so you can trash them all at once.

## How It Works

1. Go to [photos.google.com](https://photos.google.com) (library, album, or search results)
2. Click the Photinder extension icon and press **Start Swiping**
3. An overlay shows each photo enlarged — press **Keep** or **Delete**
4. **Delete** checks the photo's selection checkbox in Google Photos
5. When you're done, close the overlay — selected photos remain checked
6. Click the trash icon in Google Photos to delete all selected photos at once

No API keys, no OAuth, no server — it works directly on the page.

## Keyboard Shortcuts

| Action | Keys       |
| ------ | ---------- |
| Keep   | `K` or `→` |
| Delete | `D` or `←` |
| Undo   | `U` or `Z` |
| Close  | `Esc`      |

## Testing Locally

1. Clone this repo:

   ```bash
   git clone <repo-url>
   cd photinder
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the project directory (the folder containing `manifest.json`)

5. Navigate to [photos.google.com](https://photos.google.com)

6. Click the Photinder extension icon in the toolbar and press **Start Swiping**

To reload after making changes, click the refresh icon on the extension card at `chrome://extensions`.

## Linting

```bash
npm install
npm run lint
```

## Notes

- Google Photos uses virtualized rendering, so only ~50 photos are in the DOM at a time. The extension swipes through what's currently visible.
- DOM selectors may break if Google changes their markup. Check the browser console for errors if things stop working.
