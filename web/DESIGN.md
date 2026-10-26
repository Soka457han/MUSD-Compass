---
name: MUSD Compass
description: Where Mezo MUSD earns the most after costs, read like a shelf-edge price label.
colors:
  label-yellow: "#ffd200"
  on-yellow: "#111214"
  offer-red: "#c8202a"
  on-sticker: "#ffffff"
  shelf-steel: "#e6e9ed"
  label-stock: "#ffffff"
  ink: "#111214"
  ink-muted: "#474c54"
  rule-grey: "#c3c9d0"
  danger-text: "#b3141c"
  shelf-charcoal: "#15171a"
  label-graphite: "#22252a"
  ink-dark: "#f1f2f0"
  ink-muted-dark: "#b2b8bf"
  rule-grey-dark: "#3b4048"
  danger-text-dark: "#ff8a8f"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 68"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.375
    fontVariation: "\"wdth\" 90"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "\"tnum\""
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    fontFeature: "\"tnum\""
rounded:
  focus: "2px"
  sm: "4px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.label-stock}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  segmented-option:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "0 8px"
    height: "44px"
  segmented-option-checked:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.label-stock}"
  input-amount:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "44px"
  price-field-lead:
    backgroundColor: "{colors.label-yellow}"
    textColor: "{colors.on-yellow}"
    typography: "{typography.display}"
    padding: "12px 16px"
  unit-price-box:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    padding: "4px 8px"
  offer-sticker:
    backgroundColor: "{colors.offer-red}"
    textColor: "{colors.on-sticker}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  tag-chip:
    backgroundColor: "{colors.shelf-steel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  nav-item-current:
    backgroundColor: "{colors.on-yellow}"
    textColor: "{colors.label-yellow}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "44px"
---

> **Visual language changed on 26 Oct 2026.** The live UI now uses the "dark creative" look chosen from the prototype canvas: page `#0f1015` / card `#222328` / line `#2e2f36`, accent `#a370fc` with dark text (light theme: white page, accent `#7c3aed` with white text), pastel tiles with `#16171d` text, locked veMEZO on a `#f6d8ff` pill, pill-shaped controls, Plus Jakarta Sans. Tokens live in `src/app/globals.css`. The shelf-label sections below describe the earlier look; layout, copy and data rules still apply.


# Design System: MUSD Compass

## Overview

**Creative North Star: "The Shelf-Edge Price Label"**

Every venue is a supermarket shelf tag: white label stock clipped to a cool steel shelf, a heavy condensed price figure, and beside it the small boxed "unit price" a careful shopper uses to compare true cost. The big number is always cash carry after costs; the box underneath states exactly what produced it. Value that is not cash (locked veMEZO) is a red offer sticker slapped on the label, slightly askew, never printed inside the price.

The world is dense, legible and plain-spoken. One saturated colour, label yellow, marks the shop's own band (the header) and the best deal's price field; black ink does everything else. Borders are printed rules, not decoration: a thick black top rule on each label, 2px ink outlines on controls, 1px boxes around assumptions. Motion is a single event: labels slide to their new rank when the calculator changes.

Dark mode is the same shop after hours: a charcoal shelf, graphite label stock, and price figures that turn yellow on the shelf labels while the lead price field stays a yellow block with black ink.

**Key Characteristics:**
- Steel-grey ground, white label cards with a 4px black top rule.
- One accent (label yellow), one alarm (offer red); both used as flat fills, never gradients.
- One family, Archivo Variable, with width as the hierarchy axis: 68% for prices, 88–90% for titles, 100% for reading text.
- Every cash figure carries its own boxed assumption line.
- Tabular figures everywhere.

## Colors

A retail-shelf palette: steel and white stock carrying black ink, with yellow for the price field and red reserved for the offer sticker.

### Primary
- **Label Yellow** (`label-yellow`): the header band, the lead label's price field, the notice strip in the calculator, text selection, and the shelf-label price figures in dark mode. Always paired with On-Yellow ink when used as a fill.
- **On-Yellow Ink** (`on-yellow`): text and marks on yellow; also the fill of the current nav item, which inverts to yellow text.

### Secondary
- **Offer Red** (`offer-red`) with **Sticker White** (`on-sticker`): the locked-veMEZO sticker only.
- **Danger Text** (`danger-text`, dark `danger-text-dark`): validation error text only, a separate token from the sticker so errors stay legible on both white and graphite stock.

### Neutral
- **Shelf Steel** (`shelf-steel`): page ground, browser/manifest background, and tag-chip fill.
- **Label Stock** (`label-stock`): cards, calculator bar, footer, size-only list, control backgrounds.
- **Ink** (`ink`): all text, the 4px and 2px rules, primary button fill, checked segment fill, focus ring in light mode.
- **Muted Ink** (`ink-muted`): definition-list terms, secondary metadata, shelf-label unit captions.
- **Rule Grey** (`rule-grey`): 1px internal dividers (label action row, size-only list rows).
- **Dark set** (`shelf-charcoal`, `label-graphite`, `ink-dark`, `ink-muted-dark`, `rule-grey-dark`): the same roles under `prefers-color-scheme: dark`. Yellow, red and on-yellow do not change between schemes; the focus ring switches to Label Yellow, except inside the yellow band, where it is always On-Yellow ink.

### Named Rules
**The One Price Field Rule.** Yellow fills exactly one price per screen: the lead label's. Every other label prints its figure on white stock (yellow ink only in dark mode).

**The Sticker Is Not The Price Rule.** Offer Red belongs to locked value. It never colours a cash figure, and locked value never appears inside the price field.

## Typography

**Display Font:** Archivo Variable (with system-ui, sans-serif), width axis loaded
**Body Font:** Archivo Variable at normal width
**Label/Mono Font:** none; tabular numerals are set globally on the root

**Character:** a single grotesque stretched and squeezed like shop lettering. Prices are tall, heavy and narrow; everything around them is small and regular-width so the figure reads first.

### Hierarchy
- **Display** (800, 3.5rem, 0.9, width 68%): the lead label's cash figure only. Decimals and the % sign drop to 0.55em and sit top-aligned, like tag lettering; below 1% the decimals stay full size because they carry the difference.
- **Headline** (800, 2.5rem, 0.9, width 68%): every other ranked label's cash figure. The amount input uses the same price face at 1.5rem.
- **Title** (700, 1rem, width 90%): venue names; section headings use the same face at 0.875rem; the wordmark sits at width 88%.
- **Body** (400–600, 0.875rem): controls, buttons (700), notices, list rows.
- **Label** (600, 0.75rem): field legends, unit-price box, chain badge, tags, footer text (400, relaxed leading), "cash / yr after costs" captions.

### Named Rules
**The Width Ladder Rule.** Hierarchy comes from width before size: 68% prices, 88–90% names and headings, 100% reading text. Don't introduce a second family to make a contrast width already makes.

**The Tabular Rule.** All numerals are tabular so labels compare digit-for-digit.

## Layout

A single centred column capped at 64rem with a 16px gutter on every band (header, calculator, main, footer), so the bands read as full-bleed shelf strips with aligned content. Built 360px first.

- **Calculator bar:** a 2-column grid on phones (amount spans both), 4 columns from 640px; Borrow mode adds rate and trove cells to the same grid. 12px gaps.
- **Label stack:** one column on phones with 16px between labels; from 768px a two-column grid where the lead label spans both columns, capped at 48rem.
- **Inside a label:** 16px horizontal padding, 8–12px vertical steps between figure, unit-price box, sticker, facts, tags, and action row.
- **Size-only venues** sit below the ranked labels as a compact ruled list, 32px after the stack.
- All interactive targets are at least 44px tall.

## Elevation & Depth

Mostly flat and printed. Bands are separated by 2px ink rules, not shadow. The one exception is the price label itself, which carries a soft two-layer shadow so the white stock reads as a card sitting slightly proud of the steel shelf.

### Shadow Vocabulary
- **Label lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 8px 20px -12px rgb(0 0 0 / 0.25)`): ranked price labels only.

### Named Rules
**The Rules Not Shadows Rule.** Structure is drawn with ink rules (4px label top, 2px controls and band edges, 1px boxes and dividers). Shadow is reserved for the label card.

## Shapes

Near-square. Controls, buttons, badges, chips and the sticker share a tight 4px radius; label cards and bands are square-cornered; the focus outline rounds to 2px. The sticker is the only rotated element (-1deg), the way a real sticker lands on a tag. Icons are one stroke family: 24px grid, 2px round strokes, `currentColor`.

## Components

### Buttons
Blunt, inked, full-height touch targets.
- **Shape:** gently squared (4px radius), min height 44px, 16px side padding, 700 weight.
- **Primary:** Ink fill with Label Stock text; used once per screen, on the lead label's action.
- **Outline:** 2px Ink border on label stock; the action on every other label.
- **External links** append the 16px arrow-up-right icon.
- **Disclosure ("Why this number"):** a text-only summary with a chevron that rotates 90deg open over 200ms.

### Segmented Control
- **Style:** 2px Ink frame on label stock, equal-width options 44px tall, 600 weight.
- **State:** the checked option fills Ink with Label Stock text (150ms colour transition); focus draws the global ring on the option.

### Inputs / Fields
- **Style:** 2px Ink border, 4px radius, 44px tall, label stock background. The amount field is set in the price face at 1.5rem; the select uses body 600.
- **Focus:** the global 3px outline, offset 2px.
- **Error:** an alert line in Danger Text, 600 weight, beneath the grid.

### Chips
- **Tag chip:** Shelf Steel fill, 4px radius, label size; risk and context facts.
- **Chain badge:** 1px Ink outline, 4px radius, label 600; sits top-right of a label.

### Navigation
The header is the yellow band: compass mark and wordmark left, nav right. Items are 44px tall, 600 weight, underline on hover; the current page inverts to an On-Yellow block with yellow text. Focus rings inside the band are On-Yellow ink in both schemes.

### Price Label (signature)
The system's unit. White stock, 4px Ink top rule, label lift shadow. Top row: venue title and chain badge. Then the price figure with its two-line "cash / yr after costs" caption; on the lead label the figure sits in a yellow price field. Then the **unit-price box**: a 1px Ink box reading "Unit price: yield − costs · assumes N-day hold". Then the offer sticker if locked value exists, a two-column fact list, tag chips, and an action row divided by a 1px Rule Grey line. Unavailable sources print "Source unavailable right now" in place of the figure.

### Offer Sticker (signature)
Offer Red fill, white 700 text, 4px radius, rotated -1deg, lock icon leading: "+X% locked veMEZO · total Y%". Only locked value goes here.

### Re-rank motion
When a calculator choice changes, labels slide to their new positions with a view transition (260ms, `cubic-bezier(0.16, 1, 0.3, 1)`). Typing does not animate; reduced motion removes it.

## Do's and Don'ts

### Do:
- **Do** give every cash figure its own boxed unit-price line stating costs and holding period.
- **Do** print price figures in Archivo at width 68%, weight 800, line-height 0.9, with tabular numerals.
- **Do** keep yellow to the header band, the lead price field, notices and selection; pair it with On-Yellow ink.
- **Do** put locked value on the red, -1deg offer sticker with the lock icon, outside the price.
- **Do** draw structure with ink rules: 4px label top rule, 2px controls and band edges, 1px boxes.
- **Do** keep every interactive target at least 44px tall and keep the single re-rank motion behind reduced-motion.

### Don't:
- **Don't** fold locked or reward value into the big cash figure.
- **Don't** fill more than one price per screen with yellow.
- **Don't** use Offer Red for anything but the locked-value sticker; errors use Danger Text.
- **Don't** let a focus ring match its ground: on the yellow band it is On-Yellow ink in both schemes.
- **Don't** add a second typeface; vary width and weight instead.
- **Don't** add shadows to controls, bands or chips; only the label card lifts.
