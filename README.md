# Handwriting Studio

High-resolution humanized notebook and assignment sheet generator with real-time ruled baseline alignment, organic handwriting variation, rich Markdown/HTML formatting, and lossless print-ready PNG/PDF export.

---

## Key Features

- **Human Handwriting Realism Engine (`js/utils/humanize.mjs`)**:
  - Smooth syllable micro-strokes (`3–4` characters) with twin-glyph breaking (`ll`, `ss`, `ff`, `ee`).
  - Variable hand slant (`skewX`), micro-rotation (`rotate`), and loose rounded bowl formation (`scaleX` / `scaleY`) anchored to the ruled baseline (`50% 82%`).
  - Dynamic pen pressure simulation (multi-pass heavier ink strokes at word starts, capitals, and downstrokes; lighter skimming glides on fast transitions; punctuation ink pooling).
  - Subtly interrupted, level hand-drawn underlines across words and spaces.
  - Zero cumulative vertical line-height drift across 30+ lines.
- **1:1 Live Preview & Multi-Page Pagination (`js/generate-images.mjs`)**:
  - Infinite scrolling ruled and margin lines in live preview.
  - Humanize-Before-Paginate architecture guarantees `0.0px` layout shift between pagination measurement and final canvas/PDF export.
  - Built-in widow/orphan protection keeps section headings paired with their body lines and prevents mid-sentence cutoff at page breaks.
- **Rich Text & Markdown Editor (`js/utils/helpers.mjs`)**:
  - 8x2 Sharp AMOLED Monochrome formatting toolbar (Bold, Italic, Underline, Strikethrough, Align Left/Center/Right/Justify, Bullets, Numbered Lists, Headings, Symbols).
  - Automatic rich HTML paste (`Ctrl+V` from ChatGPT, Notion, Google Docs, Word) and Markdown parser (`# Heading`, `**bold**`, `*italic*`, `__underline__`, `- bullets`).
  - Markdown-preserving copy (`Ctrl+C` exports formatted content back as clean Markdown + HTML).
- **Ultra-High-Resolution Print & Full-Bleed PDF Export**:
  - Lossless PNG export up to `6x` resolution (300+ DPI).
  - Edge-to-edge full-bleed A4 PDF generation (`0, 0, width, height`).

---

## Quick Start

### Option 1: Double-Click Launcher (Windows)
Run [`start.bat`](./start.bat) to start the zero-dependency local Node server and open `http://localhost:3000`.

### Option 2: Command Line
```bash
node server.js
```
Then open `http://localhost:3000` in your browser.

---

## Project Structure

```text
├── css/
│   ├── index.css          # Sharp AMOLED Monochrome theme & sheet layout
│   └── features.css       # Switch toggles & drawing modal styles
├── fonts/                 # Local handwriting font assets
├── images/                # UI icons & favicons
├── js/
│   ├── app.mjs            # Event bindings & real-time preview state
│   ├── generate-images.mjs# Humanize-before-paginate engine & multi-page renderer
│   ├── utils/
│   │   ├── draw.mjs           # Diagram / sketch canvas tool
│   │   ├── generate-utils.mjs # Sheet style helpers & output gallery
│   │   ├── helpers.mjs        # Markdown/HTML paste-copy, PDF export & line grid sync
│   │   └── humanize.mjs       # Casual loose & irregular handwriting realism engine
│   └── vendors/
│       ├── html2canvas.min.js # Patched DOM-to-Canvas renderer (baseline transforms & natural underlines)
│       └── jspdf.min.js       # PDF document generator
├── index.html             # Studio UI
├── server.js              # Local static HTTP server (port 3000)
└── start.bat              # One-click Windows launcher
```
