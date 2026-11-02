<div align="center">
  <img src="./public/favicon.svg" alt="InkScript Logo" width="72" height="72" />
  <h1>InkScript</h1>
  <p>Convert typed notes and Markdown into clean, realistic handwritten notebook pages.</p>
</div>

---

## About

I built **InkScript** to turn digital text into natural-looking handwritten A4 sheets without the usual alignment issues or slow rendering.

You can paste notes directly from ChatGPT, Notion, or Google Docs, tweak the pen style and page lines in real time, and export print-ready PNGs or a full A4 PDF.

## What It Does

- **Live Sheet Preview & Pop-Up View** — Edit directly on the notebook sheet, or open it in a larger pop-up view for comfortable writing.
- **Direct Canvas 2D Export** — Renders crisp, high-resolution pages (up to 6× scale) in milliseconds with text locked accurately to the ruled lines.
- **Custom Stencil & Margins** — Toggle the top margin, left margin, and ruled lines independently. Adjust line spacing without breaking text alignment.
- **Natural Handwriting Controls** — Pick from multiple handwriting fonts (or upload your own `.ttf`/`.otf`), including Noto Sans Devanagari for Unicode Hindi, switch ink colors, and fine-tune font size, word gap, and letter gap.
- **Diagram Upload & Sketch Pad** — Drop in existing diagram images (with an option to tint lines to match your pen ink) or draw a quick sketch.
- **Smart Paste & PDF Export** — Preserves headings, bold/underlined text, and bullet points when pasting, and exports everything as a clean A4 PDF.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** + **Tailwind CSS v4**
- **HTML5 Canvas 2D** + **jsPDF**

## Run Locally

```bash
# Install dependencies
npm install

# Start the dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build
```

## License

InkScript's original code is licensed under the MIT License. Third-party fonts, icons, and packages retain their own licenses and notices; see [ATTRIBUTION.md](./ATTRIBUTION.md). Noto Sans Devanagari is licensed under the SIL Open Font License 1.1 and is loaded from Google Fonts.

### Hindi input

The Hindi font option uses Unicode Devanagari. Legacy Kruti Dev keyboard-encoded text is not converted automatically; convert it to Unicode before pasting.

