# Font Setup Guide

## Folder Structure

Place your font folders in the `app/fonts` directory:

```
app/
  fonts/
    helvetica-neue/     (or helvetica-neue/)
      - HelveticaNeue-Light.woff2
      - HelveticaNeue-Light.woff
      - HelveticaNeue-Regular.woff2
      - HelveticaNeue-Regular.woff
      - HelveticaNeue-Medium.woff2
      - HelveticaNeue-Medium.woff
      - HelveticaNeue-Bold.woff2
      - HelveticaNeue-Bold.woff
      (or whatever files you have)
    
    graphik/            (or graphik/)
      - Graphik-Light.woff2
      - Graphik-Light.woff
      - Graphik-Regular.woff2
      - Graphik-Regular.woff
      - Graphik-Medium.woff2
      - Graphik-Medium.woff
      - Graphik-Bold.woff2
      - Graphik-Bold.woff
      (or whatever files you have)
```

## Steps

1. **Copy your font folders** to `app/fonts/`:
   - If your folders are named something else, rename them to `helvetica-neue` and `graphik`
   - Or keep their names and update the paths in `app/layout.tsx`

2. **Check the file formats**:
   - `.woff2` (preferred - smaller, better compression)
   - `.woff` (fallback)
   - `.ttf` (also works, but larger files)

3. **Update `app/layout.tsx`**:
   - The layout file will be updated to automatically detect and use your font files
   - Just make sure the file names match what's in the code

## File Naming

The code expects files named like:
- `HelveticaNeue-Light.woff2` or `HelveticaNeueLight.woff2`
- `HelveticaNeue-Regular.woff2` or `HelveticaNeueRegular.woff2`
- `HelveticaNeue-Medium.woff2` or `HelveticaNeueMedium.woff2`
- `HelveticaNeue-Bold.woff2` or `HelveticaNeueBold.woff2`

Same pattern for Graphik:
- `Graphik-Light.woff2` or `GraphikLight.woff2`
- `Graphik-Regular.woff2` or `GraphikRegular.woff2`
- etc.

If your files have different names, we can adjust the paths in the code.

## After Setup

Once you've copied the files, the fonts will automatically be used. The layout.tsx file is already configured to:
- Load Helvetica Neue as `font-display` (for headings, nav, card titles)
- Load Graphik as `font-body` (for paragraphs, UI, forms, buttons)
- Keep Geist Mono as `font-mono` (for addresses, amounts, hashes)

