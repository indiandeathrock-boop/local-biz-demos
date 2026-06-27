# Design Language: ホットペッパービューティー｜美容院・美容室・ヘアサロンの検索予約サイト

> Extracted from `https://beauty.hotpepper.jp` on June 6, 2026
> 1852 elements analyzed

This document describes the complete design language of the website. It is structured for AI/LLM consumption — use it to faithfully recreate the visual design in any framework.

## Color Palette

### Primary Colors

| Role | Hex | RGB | HSL | Usage Count |
|------|-----|-----|-----|-------------|
| Primary | `#0f94d2` | rgb(15, 148, 210) | hsl(199, 87%, 44%) | 1 |
| Secondary | `#e25983` | rgb(226, 89, 131) | hsl(342, 70%, 62%) | 1 |
| Accent | `#dcd6d2` | rgb(220, 214, 210) | hsl(24, 13%, 84%) | 1 |

### Neutral Colors

| Hex | HSL | Usage Count |
|-----|-----|-------------|
| `#4c4c80` | hsl(240, 25%, 40%) | 1936 |
| `#333333` | hsl(0, 0%, 20%) | 1367 |
| `#000000` | hsl(0, 0%, 0%) | 218 |
| `#444444` | hsl(0, 0%, 27%) | 58 |
| `#ffffff` | hsl(0, 0%, 100%) | 27 |
| `#666666` | hsl(0, 0%, 40%) | 22 |
| `#595959` | hsl(0, 0%, 35%) | 22 |
| `#999999` | hsl(0, 0%, 60%) | 20 |
| `#cdcdcd` | hsl(0, 0%, 80%) | 12 |
| `#bfb4ab` | hsl(27, 14%, 71%) | 8 |
| `#7b7169` | hsl(27, 8%, 45%) | 8 |
| `#f6f6f6` | hsl(0, 0%, 96%) | 3 |

### Background Colors

Used on large-area elements: `#fdfdf5`, `#bfb4ab`, `#ffffff`, `#f6f4f3`

### Text Colors

Text color palette: `#000000`, `#333333`, `#ffffff`, `#4c4c80`, `#666666`, `#7b7169`, `#444444`, `#463413`, `#595959`, `#999999`

### Gradients

```css
background-image: linear-gradient(rgb(255, 255, 255) 0px, rgb(255, 255, 255) 10px, rgb(216, 216, 216) 100%);
```

```css
background-image: linear-gradient(rgb(255, 255, 255) 0%, rgb(250, 229, 231) 100%);
```

### Full Color Inventory

| Hex | Contexts | Count |
|-----|----------|-------|
| `#4c4c80` | text, border | 1936 |
| `#333333` | text, border, background | 1367 |
| `#000000` | text, border | 218 |
| `#444444` | text, border | 58 |
| `#ffffff` | text, border, background | 27 |
| `#666666` | text, border | 22 |
| `#595959` | text, border | 22 |
| `#999999` | border, text | 20 |
| `#cdcdcd` | border, text | 12 |
| `#bfb4ab` | border, text, background | 8 |
| `#7b7169` | text, border | 8 |
| `#e53b4e` | text, border | 5 |
| `#463413` | text, border | 4 |
| `#f6f6f6` | background | 3 |
| `#e46c0a` | text, border | 2 |
| `#797979` | text, border | 2 |
| `#cc4466` | text, border | 2 |
| `#dcd6d2` | background | 1 |
| `#e5848e` | border | 1 |
| `#f0ebe5` | background | 1 |
| `#e25983` | background | 1 |
| `#d43666` | border | 1 |
| `#0f94d2` | background | 1 |
| `#0867a9` | border | 1 |
| `#e0e1e2` | border | 1 |

## Typography

### Font Families

- **Times** — used for body (106 elements)
- **lucida grande** — used for body (3 elements)

### Type Scale

| Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Used On |
|-----------|------------|--------|-------------|----------------|---------|
| 16px | 1rem | 400 | normal | normal | html, head, meta, title |
| 14px | 0.875rem | 700 | 14px | normal | h3, p, a, div |
| 13px | 0.8125rem | 700 | 19.5px | normal | h3, div, ul, li |
| 12px | 0.75rem | 400 | 18px | normal | body, script, div, a |
| 11px | 0.6875rem | 400 | 16.5px | normal | div, a |
| 10px | 0.625rem | 400 | 15px | normal | h1, ol, li, a |
| 0px | 0rem | 400 | 0px | normal | div |

### Heading Scale

```css
h3 { font-size: 14px; font-weight: 700; line-height: 14px; }
h3 { font-size: 13px; font-weight: 700; line-height: 19.5px; }
h2 { font-size: 12px; font-weight: 400; line-height: 18px; }
h1 { font-size: 10px; font-weight: 400; line-height: 15px; }
```

### Body Text

```css
body { font-size: 10px; font-weight: 400; line-height: 15px; }
```

### Font Weights in Use

`400` (1755x), `700` (96x), `900` (1x)

## Spacing

**Base unit:** 2px

| Token | Value | Rem |
|-------|-------|-----|
| spacing-1 | 1px | 0.0625rem |
| spacing-18 | 18px | 1.125rem |
| spacing-20 | 20px | 1.25rem |
| spacing-22 | 22px | 1.375rem |
| spacing-25 | 25px | 1.5625rem |
| spacing-28 | 28px | 1.75rem |
| spacing-30 | 30px | 1.875rem |
| spacing-32 | 32px | 2rem |
| spacing-37 | 37px | 2.3125rem |
| spacing-40 | 40px | 2.5rem |
| spacing-140 | 140px | 8.75rem |
| spacing-208 | 208px | 13rem |

## Border Radii

| Label | Value | Count |
|-------|-------|-------|
| xs | 2px | 2 |
| sm | 5px | 2 |

## CSS Custom Properties

### Semantic

```css
success: [object Object];
warning: [object Object];
error: [object Object];
info: [object Object];
```

## Transitions & Animations

### Common Transitions

```css
transition: all;
```

### Keyframe Animations

**fb_transform**
```css
@keyframes fb_transform {
  0% { opacity: 0; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
```

**rotateSpinner**
```css
@keyframes rotateSpinner {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

## Component Patterns

Detected UI component patterns and their most common styles:

### Buttons (6 instances)

```css
.button {
  background-color: rgb(220, 214, 210);
  color: rgb(123, 113, 105);
  font-size: 11px;
  font-weight: 700;
  padding-top: 0px;
  padding-right: 0px;
  border-radius: 0px 4px 4px 0px;
}
```

### Inputs (2 instances)

```css
.input {
  background-color: rgb(255, 255, 255);
  color: rgb(51, 51, 51);
  border-color: rgb(204, 204, 204);
  border-radius: 4px;
  font-size: 12px;
  padding-top: 0px;
  padding-right: 5px;
}
```

### Links (541 instances)

```css
.link {
  color: rgb(76, 76, 128);
  font-size: 10px;
  font-weight: 400;
}
```

### Navigation (6 instances)

```css
.navigatio {
  background-color: rgb(255, 255, 255);
  color: rgb(51, 51, 51);
  padding-top: 0px;
  padding-bottom: 0px;
  padding-left: 0px;
  padding-right: 0px;
  position: static;
}
```

### Footer (17 instances)

```css
.foote {
  background-color: rgb(246, 244, 243);
  color: rgb(51, 51, 51);
  padding-top: 0px;
  padding-bottom: 0px;
  font-size: 12px;
}
```

### Dropdowns (9 instances)

```css
.dropdown {
  border-radius: 0px;
  border-color: rgb(51, 51, 51);
  padding-top: 0px;
}
```

## Component Clusters

Reusable component instances grouped by DOM structure and style similarity:

### Input — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgb(255, 255, 255);
  color: rgb(51, 51, 51);
  padding: 0px 5px 0px 5px;
  border-radius: 4px;
  border: 1px solid rgb(204, 204, 204);
  font-size: 12px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(229, 59, 78);
  padding: 0px 1px 0px 1px;
  border-radius: 3px;
  border: 1px solid rgb(229, 132, 142);
  font-size: 12px;
  font-weight: 700;
```

## Layout System

**0 grid containers** and **33 flex containers** detected.

### Flex Patterns

| Direction/Wrap | Count |
|----------------|-------|
| row/nowrap | 33x |

## Accessibility (WCAG 2.1)

**Overall Score: 20%** — 1 passing, 4 failing color pairs

### Failing Color Pairs

| Foreground | Background | Ratio | Level | Used On |
|------------|------------|-------|-------|---------|
| `#7b7169` | `#dcd6d2` | 3.31:1 | FAIL | a (1x) |
| `#797979` | `#fbfaf5` | 4.17:1 | FAIL | dt (1x) |
| `#ffffff` | `#e25983` | 3.51:1 | FAIL | a (1x) |
| `#ffffff` | `#0f94d2` | 3.39:1 | FAIL | a (1x) |

### Passing Color Pairs

| Foreground | Background | Ratio | Level |
|------------|------------|-------|-------|
| `#666666` | `#ffffff` | 5.74:1 | AA |

## Design System Score

**Overall: 76/100 (Grade: C)**

| Category | Score |
|----------|-------|
| Color Discipline | 92/100 |
| Typography Consistency | 100/100 |
| Spacing System | 85/100 |
| Shadow Consistency | 85/100 |
| Border Radius Consistency | 100/100 |
| Accessibility | 20/100 |
| CSS Tokenization | 50/100 |

**Strengths:** Tight, disciplined color palette, Consistent typography system, Well-defined spacing scale, Clean elevation system, Consistent border radii

**Issues:**
- 4 WCAG contrast failures
- 34 !important rules — prefer specificity over overrides
- 60% of CSS is unused — consider purging
- 705 duplicate CSS declarations

## Gradients

**2 unique gradients** detected.

| Type | Direction | Stops | Classification |
|------|-----------|-------|----------------|
| linear | — | 3 | bold |
| linear | — | 2 | brand |

```css
background: linear-gradient(rgb(255, 255, 255) 0px, rgb(255, 255, 255) 10px, rgb(216, 216, 216) 100%);
background: linear-gradient(rgb(255, 255, 255) 0%, rgb(250, 229, 231) 100%);
```

## Z-Index Map

**9 unique z-index values** across 3 layers.

| Layer | Range | Elements |
|-------|-------|----------|
| dropdown | 100,999 | div.g.e.n.d.e.r.S.e.l.e.c.t, a, a.p.a.g.e.T.o.p.I.m.g |
| sticky | 10,11 | div.m.y.M.e.n.u.M.a.i.n.B.o.x. .p.o.i.n.t.B.o.x. .y.S, div.m.y.M.e.n.u.M.a.i.n.B.o.x. .y.S, div.w.o.r.d.A.s.s.i.s.t.E.x.P.a.n.e.l. .b.g.L.L.P.i.n.k |
| base | 0,3 | div, div, div.b.g.S.a.l.o.n.M.a.p. .m.T.1.0. .p.B.2.0 |

## Image Style Patterns

| Pattern | Count | Key Styles |
|---------|-------|------------|
| thumbnail | 63 | objectFit: fill, borderRadius: 0px, shape: square |
| general | 1 | objectFit: fill, borderRadius: 0px, shape: square |

**Aspect ratios:** 3:2 (21x), 3:4 (15x), 1:1 (9x), 16:9 (8x), 4.68:1 (2x), 4.67:1 (2x), 1.18:1 (1x), 9:16 (1x)

## Motion Language

**Feel:** mixed · **Scroll-linked:** yes

## Page Intent

**Type:** `landing` (confidence 0.45)
**Description:** 美容院・美容室・ヘアサロンが探せる日本最大級の検索・予約サイト。2359万点あるスタイルや、ブログ、口コミをチェックして、気になるスタイリストを直接指名。２４時間いつでもネット予約OK。美容院や美容室、ヘアサロンを検索・予約するならホットペッパービューティー

## Material Language

**Label:** `flat` (confidence 0)

| Metric | Value |
|--------|-------|
| Avg saturation | 0.3 |
| Shadow profile | none |
| Avg shadow blur | 0px |
| Max radius | 5px |
| backdrop-filter in use | no |
| Gradients | 2 |

## Imagery Style

**Label:** `photography` (confidence 0.036)
**Counts:** total 64, svg 0, icon 18, screenshot-like 0, photo-like 4
**Dominant aspect:** landscape
**Radius profile on images:** square

## Quick Start

To recreate this design in a new project:

1. **Install fonts:** Add `Times` from Google Fonts or your font provider
2. **Import CSS variables:** Copy `variables.css` into your project
3. **Tailwind users:** Use the generated `tailwind.config.js` to extend your theme
4. **Design tokens:** Import `design-tokens.json` for tooling integration
