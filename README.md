# Handwriting Studio v3.0

High-resolution humanized notebook and assignment sheet generator built with **React 19**, **TypeScript 5**, **Vite 6**, and a **Direct HTML5 Canvas 2D Vector Rendering Engine**.

---

## Architecture Highlights (v3.0 Hybrid Engine)

1. **Direct HTML5 Canvas 2D Vector Renderer ([`src/engine/canvasRenderer.ts`](./src/engine/canvasRenderer.ts))**
   - Eliminates `html2canvas` DOM cloning overhead — renders pages in **< 35ms** at up to **6× print resolution (300+ DPI)**.
   - **Vector Ruled & Margin Lines**: Draws crisp horizontal ruled lines (`#94a3b8`) and dual vertical pink margin lines (`#f43f5e`) directly via Canvas 2D vector paths.
   - **2D Affine Syllable Transforms**: Queries live glyph bounding boxes via `Range.getClientRects()` and applies per-syllable `translate` + `rotate` + `skewX` + `scale(scaleX, scaleY)` anchored at the baseline (`50% 82%`).
   - **Multi-Pass Pen Pressure & Ink Pooling**: Simulates real ballpoint/gel pen pressure (`#0f296b`, `#141824`, `#991b1b`) with heavier multi-pass downstrokes at word starts and capitals, lighter skimming strokes on fast transitions, and ink pooling on terminal punctuation.
   - **Subtly Interrupted Level Underlines**: Draws continuous, level hand-drawn underlines across words and spaces using `3px` micro-strokes with `±0.30px` organic hand tremor and `5.5%` ballpoint micro-skips.

2. **Deterministic Human Handwriting Engine ([`src/engine/humanizer.ts`](./src/engine/humanizer.ts) & [`src/engine/prng.ts`](./src/engine/prng.ts))**
   - Seeded `Mulberry32` + `Gaussian` PRNG ensures every preview matches exported sheets.
   - Splits words into smooth `3–4` character syllable strokes while separating consecutive twin letters (`ll`, `ss`, `ff`, `ee`) so identical letters never look copy-pasted.
   - Zero cumulative vertical line-height drift across 30+ lines.

3. **Humanize-Before-Paginate Multi-Page Pipeline ([`src/engine/canvasRenderer.ts`](./src/engine/canvasRenderer.ts))**
   - Applies handwriting realism **before** measuring `scrollHeight`, guaranteeing `0.0px` layout shift and preventing clipped sentences at page breaks.
   - Built-in widow/orphan protection keeps headings paired with their body paragraphs.

4. **Rich Markdown & Clipboard Engine ([`src/engine/markdownParser.ts`](./src/engine/markdownParser.ts))**
   - 8×2 Sharp AMOLED Monochrome formatting toolbar (`Bold`, `Italic`, `Underline`, `Strikethrough`, `Align Left/Center/Right/Justify`, `Bullets`, `Numbered Lists`, `Headings`, `Symbols`).
   - Automatic rich HTML paste (`Ctrl+V` from ChatGPT, Notion, Google Docs, Word) and Markdown parser (`# Heading`, `**bold**`, `*italic*`, `__underline__`, `- bullets`).
   - Markdown-preserving copy (`Ctrl+C` exports formatted sheet content back as clean Markdown + HTML).

5. **Full-Bleed A4 PDF Exporter ([`src/engine/pdfExporter.ts`](./src/engine/pdfExporter.ts))**
   - Edge-to-edge full-bleed A4 PDF generation (`0, 0, width, height`) with zero added white borders.

---

## Quick Start

### Development Mode (Vite HMR)
```bash
npm run dev
```
Opens `http://localhost:3000` with instant TypeScript + React Hot Module Replacement.

### Production Build & Local Server
```bash
npm run build
npm start
```
Or double-click [`start.bat`](./start.bat) on Windows.

---

## Project Structure

```text
├── public/
│   ├── fonts/                 # Local handwriting font assets (Cedarville Cursive, Homemade Apple, etc.)
│   ├── images/                # UI icons & favicons
│   └── manifest.webmanifest   # Web app manifest
├── src/
│   ├── components/
│   │   ├── ControlPanel.tsx   # Typography, alignment, paper lines & template controls
│   │   ├── DrawModal.tsx      # Interactive diagram & freehand sketch canvas modal
│   │   ├── OutputGallery.tsx  # Generated sheet gallery, reordering & PNG/PDF actions
│   │   └── Toolbar.tsx        # 8×2 Sharp AMOLED formatting toolbar & custom font loader
│   ├── engine/
│   │   ├── canvasRenderer.ts  # Direct HTML5 Canvas 2D vector handwriting & pagination engine
│   │   ├── humanizer.ts       # Syllable splitter, twin-glyph breaker & baseline humanizer
│   │   ├── markdownParser.ts  # HTML-to-Markdown & Markdown-to-HTML clipboard converter
│   │   ├── pdfExporter.ts     # Full-bleed A4 PDF generator
│   │   └── prng.ts            # Deterministic Mulberry32 & Gaussian PRNG
│   ├── styles/
│   │   └── studio.css         # Sharp AMOLED Monochrome UI & ruled sheet styles
│   ├── types/
│   │   └── studio.ts          # Strict TypeScript interfaces & presets
│   ├── App.tsx                # Studio state management & live preview sync
│   └── main.tsx               # React 19 entry point
├── index.html                 # Vite entry HTML
├── package.json               # Scripts & dependencies
├── server.js                  # Zero-dependency production static server (port 3000)
├── start.bat                  # One-click Windows launcher
├── tsconfig.json              # Strict TypeScript 5 configuration
└── vite.config.ts             # Vite bundler configuration
```
