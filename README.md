# InkScript Studio

Transform digital notes, rich text, and Markdown into realistic, print-ready A4 handwritten notebook sheets. Built with **React 19**, **TypeScript 5**, **Vite 6**, **Tailwind CSS v4**, **React Bits** interactive primitives, and a **Direct HTML5 Canvas 2D Vector Rendering Engine**.

---

## Key Features

### 1. Direct HTML5 Canvas 2D Vector Engine (`src/engine/canvasRenderer.ts`)
- **Zero-Lag High-DPI Rendering**: Renders pages directly onto an HTML5 `<canvas>` at up to **6× print resolution (500 DPI)** in milliseconds.
- **Independent Sheet Stencils**: Separate controls for **Top Margin** (`50px` header + horizontal pink rule), **Left Margin** (full-height vertical pink rule starting from `y = 0`), **Ruled Lines**, and **Lines Gap (`px`)** completely decoupled from font size.
- **Smart Baseline Compensation**: Automatically aligns cursive and print handwriting baselines onto ruled notebook lines at any font size (`6pt–26pt`) or line gap (`14px–42px`).
- **2D Affine Syllable Transforms**: Applies per-syllable slant (`skewX`), micro-rotation (`rotate`), rounded bowl scaling (`scale`), and multi-pass ballpoint ink pressure shadows anchored at `50% 82%`.
- **Glyph-Tight Hand-Drawn Underlines**: Measures exact text-node glyph bounds and merges inline segments across word spaces to draw continuous, level hand-drawn underlines with subtle ballpoint micro-skips.

### 2. Deterministic Human Handwriting Engine (`src/engine/humanizer.ts` & `src/engine/prng.ts`)
- Seeded **Mulberry32 + Gaussian PRNG** with one-click **Re-Roll** variation seed (`#seed`).
- Splits words into smooth `3–4` letter syllable chunks and breaks consecutive twin letters (`ll`, `ss`, `ff`, `ee`, `oo`) so adjacent identical letters never look identical.
- **Humanize-Before-Paginate Pipeline**: Applies handwriting realism before measuring page height so multi-page pagination has `0.0px` vertical drift and built-in widow/orphan protection for headings.

### 3. Notion-Inspired Studio UI & React Bits Primitives
- **`GlideSelect`**: Spring-animated dropdown chips for Font, Ink, Realism, Surface, Scale, Format, and Template selection.
- **`ScrubField`**: Drag-to-scrub or click-to-type numeric inputs for Font Size, Word Gap, Letter Gap, Top Pad, Left Offset, and Lines Gap.
- **`CallChip`**: Live status indicator with millisecond timer and progress wash during vector sheet rendering.
- **`HoldButton`**: Press-and-hold safety action to clear rendered sheets.
- **`WarmTooltip`**: Shared warm-window tooltips with keyboard shortcut badges across the studio and single-line formatting toolbar.
- **`Aurora` & `ClickSpark`**: Smooth ink-synced top banner aurora and subtle pointer click sparks in both Dark and Light themes.
- **Viewport-Fitted Pop-Up Editor**: Expand the live sheet canvas into a distraction-free modal that automatically scales to fit your window height without scrollbars.
- **Diagram Upload & Freehand Sketch Pad**: Upload existing diagram images (drag-and-drop or `Ctrl+V` paste) with automatic ink-color tinting, or sketch freehand diagrams.

### 4. Rich Markdown Paste, Copy & Full-Bleed A4 PDF Export
- Paste directly from ChatGPT, Notion, Google Docs, or Markdown (`# Heading`, `**bold**`, `*italic*`, `__underline__`, `- bullets`) and automatically convert into ruled-line-friendly handwriting.
- Export individual high-resolution PNG sheets or a multi-page **full-bleed A4 PDF** (`src/engine/pdfExporter.ts`).

---

## Getting Started

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
Opens `http://localhost:3000` with instant Vite HMR.

### Build for Production
```bash
npm run build
npm run preview
```

---

## Project Structure

```text
├── public/
│   ├── fonts/                 # Bundled custom handwriting fonts
│   ├── favicon.svg            # Vector studio favicon
│   └── manifest.webmanifest   # Web app manifest
├── src/
│   ├── components/
│   │   ├── reactbits/         # Aurora, CallChip, ClickSpark, GlideSelect, HoldButton, ScrubField, WarmTooltip
│   │   ├── ControlPanel.tsx   # Pen, Realism, Typography & Sheet Stencil customizer cards
│   │   ├── DrawModal.tsx      # Diagram image uploader (with ink tinting) & freehand sketch pad
│   │   ├── OutputGallery.tsx  # Rendered A4 sheet gallery, lightbox zoom & PDF/PNG export
│   │   └── Toolbar.tsx        # Single-line formatting & symbol toolbar
│   ├── engine/
│   │   ├── canvasRenderer.ts  # Direct HTML5 Canvas 2D vector renderer & multi-page paginator
│   │   ├── humanizer.ts       # Syllable splitter, twin-letter breaker & organic baseline engine
│   │   ├── markdownParser.ts  # Rich HTML & Markdown paste/copy sanitizer & logical block extractor
│   │   ├── pdfExporter.ts     # Full-bleed A4 PDF exporter
│   │   └── prng.ts            # Seeded Mulberry32 & Gaussian random number generator
│   ├── styles/
│   │   └── studio.css         # Studio theme, sheet stencil grid & responsive layout
│   ├── types/
│   │   └── studio.ts          # TypeScript interfaces, font presets & default settings
│   ├── App.tsx                # Root studio state, live sheet preview & Pop-Up View controller
│   └── main.tsx               # React 19 entry point
├── index.html                 # App entry HTML & webfont imports
├── package.json               # Scripts & dependencies
├── tsconfig.json              # Strict TypeScript 5 configuration
└── vite.config.ts             # Vite 6 + Tailwind v4 configuration
```
