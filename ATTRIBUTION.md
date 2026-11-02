# Third-party attributions

InkScript's MIT license applies to InkScript's original code. It does not replace or override the licenses for third-party fonts, icons, or packages listed here.

## Fonts loaded from Google Fonts

These fonts are requested at runtime from the Google Fonts CSS API in `index.html`; their font files are not stored in this repository:

- **Noto Sans Devanagari** — Copyright 2022 The Noto Project Authors. SIL Open Font License 1.1. Source: [notofonts/devanagari](https://github.com/notofonts/devanagari); upstream license: [OFL.txt](https://github.com/google/fonts/blob/main/ofl/notosansdevanagari/OFL.txt).
- **Inter** — Copyright 2016 The Inter Project Authors. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/inter).
- **JetBrains Mono** — Copyright 2020 The JetBrains Mono Project Authors. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono).
- **Caveat** — Copyright 2014 The Caveat Project Authors. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/caveat).
- **Cedarville Cursive** — Copyright 2010 Kimberly Geswein. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/cedarvillecursive).
- **Homemade Apple** — Copyright 2010 Font Diner, Inc. Apache License 2.0. [Upstream](https://github.com/google/fonts/tree/main/apache/homemadeapple).
- **Kalam** — Copyright 2014 Indian Type Foundry. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/kalam).
- **Liu Jian Mao Cao** — Copyright 2018 The Liu Jian Mao Cao Project Authors. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/liujianmaocao).
- **Patrick Hand** — Copyright 2010–2012 Patrick Wagesreiter. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/patrickhand).
- **Shadows Into Light** — Copyright 2010 Kimberly Geswein. SIL Open Font License 1.1. [Upstream](https://github.com/google/fonts/tree/main/ofl/shadowsintolight).

The full Noto Sans Devanagari OFL 1.1 notice is included in [`public/fonts/OFL-Noto-Sans-Devanagari.txt`](./public/fonts/OFL-Noto-Sans-Devanagari.txt).

## Icons

- **Phosphor Icons Web** — Copyright 2020–2021 Phosphor Icons. MIT License. Loaded from unpkg via `index.html`. Source and license: [phosphor-icons/web](https://github.com/phosphor-icons/web).
- **Hugeicons Free Icons** (`@hugeicons/core-free-icons`, `@hugeicons/react`) — MIT License. Installed as npm dependencies; see package metadata and upstream notices.

## npm packages

Direct npm dependencies use their own package licenses. The installed versions of React, React DOM, Vite, Tailwind CSS, jsPDF, Motion, Hugeicons, and their React/Vite plugins are MIT-licensed; TypeScript is Apache-2.0-licensed. The lockfile records the dependency graph, and each package's published license file remains authoritative.

The installed dependency tree also includes packages under Apache-2.0, BSD-3-Clause, CC-BY-4.0, MPL-2.0, 0BSD, ISC, and dual-license terms. These include build-time/browser-data packages such as `caniuse-lite` (CC-BY-4.0), `lightningcss` (MPL-2.0), `source-map-js` (BSD-3-Clause), and `tslib` (0BSD). Their package license files and notices must be retained when those packages are redistributed; this project does not relicense them under MIT.

## Project acknowledgment

The project acknowledges [Text to Handwriting by Saurabh Daware](https://github.com/saurabhdaware/text-to-handwriting) as an earlier project in this space. Its repository declares an MIT license. InkScript does not include its source code. The `Hindi_Type.ttf` binary previously present in InkScript has been removed because its separate rights and license could not be verified; no permission for that font is implied by the upstream repository's code license.
