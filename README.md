# PNG Snip

Tiny local PWA for transparent PNG cleanup.

PNG Snip trims excess transparent space around the visible graphic, centers the artwork, and downloads a copy using the original filename plus `_snip.png`.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5174`.

## Build

```powershell
npm run build
```

## Notes

- Processing happens entirely in the browser.
- Files are not uploaded anywhere.
- Default behavior auto-downloads the processed PNG.
- Use `Tight crop` to remove whitespace or `Original size` to keep the source canvas while centering the graphic.
