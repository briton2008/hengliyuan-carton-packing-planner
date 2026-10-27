# Hengliyuan Carton Packing Planner

[![CI](https://github.com/briton2008/hengliyuan-carton-packing-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/briton2008/hengliyuan-carton-packing-planner/actions/workflows/ci.yml) [![Pages](https://github.com/briton2008/hengliyuan-carton-packing-planner/actions/workflows/pages.yml/badge.svg)](https://github.com/briton2008/hengliyuan-carton-packing-planner/actions/workflows/pages.yml) [![Release](https://img.shields.io/github/v/release/briton2008/hengliyuan-carton-packing-planner)](https://github.com/briton2008/hengliyuan-carton-packing-planner/releases) [![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[Company website](https://heng-li-yuan.com/) · [Live demo](https://briton2008.github.io/hengliyuan-carton-packing-planner/) · [Official company tool](https://heng-li-yuan.com/tools/carton-packing-planner/) · [中文](README.zh-CN.md)**

[![Hengliyuan Carton Packing Planner](assets/team-cover-en.png)](https://heng-li-yuan.com/)

Click the illustrated cover to visit the company website.

Plan single-SKU cartons or a mixed single-carton trial from measured packs, with interactive 3D and PDF. An independent, English-language browser project maintained by Guilin Hengliyuan Biotech Co., Ltd. No login or automatic submissions.

## What it does

- Single-SKU uniform orientation grids, optional order cartons and final carton.
- Mixed one-carton trial with unplaced counts; no order-level extrapolation.
- Customer-selected orientation/layers, optional measured gross limit, 3D angle/layer/SKU views and company PDF.

## Run locally

Node.js 22.12+ and npm:

```sh
npm ci --ignore-scripts
npm test
npm run check:release
npm run dev
```

Production: `npm run build`, then `npm run preview`. Deploy `dist/` to static hosting. GitHub Pages uses `.github/workflows/pages.yml`; project subdirectories need no rewrite rule. This distribution is interactive client code, not the company website's SEO prerenderer.

## Check the browser workflow

```sh
npm run build
npx playwright install chromium
npm run test:browser
```

This checks a real browser against a simulated Pages subdirectory, including a complete tool workflow, mobile layouts, clipboard and company PDF export. Example records are synthetic and written to temporary folders.

## Data and limits

Rectangular-envelope heuristics do not prove global optimality, physical support, carton strength, safe handling, pallet or container suitability.

All inputs stay in memory in the current tab. Refreshing or navigating away clears them. Copy or save a PDF first. No database, localStorage, analytics, remote calculation, API key or customer-submission endpoint is included. Contact buttons explain the handoff before opening the official contact page in another tab; input values are not attached.

Customer dimensions, weights, sample observations, project specifications and costs are not supplied by the project. No inventory, freight, price, MOQ, customer review or approval is invented. The company identity in PDFs is for review worksheets, not authorization to issue official commercial or technical documents.

## Reuse and contribute

MIT code; original third-party terms in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Company identifiers and PDF branding are separately reserved: see [TRADEMARKS.md](TRADEMARKS.md). Forks should replace the identity before redistribution. See [CONTRIBUTING.md](CONTRIBUTING.md), [Code of Conduct](CODE_OF_CONDUCT.md) and [security policy](.github/SECURITY.md).

This repository contains this tool only. Other Hengliyuan tools have independent repositories, demos and releases.
