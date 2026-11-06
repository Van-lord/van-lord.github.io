# Jiawei Guo

Single-screen personal workspace for research and photography. Published at https://van-lord.github.io/.

Selecting the laptop opens Research, Papers, and About directly inside its projected display. Only the content within that screen scrolls; there are no page sections below the main composition. Selecting the photo album turns through six distinct photographs. The last page contains the live Gallery and expands into the interactive archive without loading a new document.

## Build

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run build
npm run check
```

The static output is `_site/`. GitHub Actions publishes it on pushes to `main`.

Edit `app/components/JournalHome.tsx` for the homepage, `public/journal.css` for styles, `app/components/DeskScene.tsx` for the interactive workspace, and `data/portfolio.json` for publication records. `static-home/site-data.ts` contains the public contact and profile links.

## Photography archive

The [Gallery](https://van-lord.github.io/gallery/) and all seven photo stories are published here, including their original styles, fluid introductions and full-screen viewer. Update `data/gallery.json` and `public/photos/` to publish photo changes. Studio remains on the original host; its later changes must be exported and published to Pages.

## Assets

Photographs and CV belong to Jiawei Guo. Cormorant Garamond and Smiley Sans are included with their OFL licenses in `public/fonts/`. The scene is authored in Three.js and has an SVG fallback.

Portrait screens use a dedicated reading window and a portrait photo album. Touch or pen dragging changes the desk viewpoint; deliberate taps open the computer or album. The drag recognizer is covered by tests for accidental taps, cancellation and multiple pointers.
