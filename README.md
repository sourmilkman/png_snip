# PNG Snip

Tiny local PWA for transparent PNG cleanup.

PNG Snip trims excess transparent space around the visible graphic, centers the artwork, and prepares a downloadable copy using the original filename plus `_snip.png`.

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:5174`.

## Install From GitHub Pages

After GitHub Pages deploys, open:

```text
https://sourmilkman.github.io/png_snip/
```

Use your browser's install button or menu option, such as `Install app`.

## Build

```powershell
npm run build
```

## Notes

- Processing happens entirely in the browser.
- Files are not uploaded anywhere.
- Use the download button when you are happy with the processed PNG.
- Use `Tight crop` to remove whitespace or `Original size` to keep the source canvas while centering the graphic.
