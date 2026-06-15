# ADR 0006: C3 Appended Character Vertical Alignment Separation

## Status

Accepted

## Context

In C3 Sprite Font mode, the runtime draws every character at the top of its cell. ADR 0005 reused `cellAlignment.vertical` to control how appended characters were distributed vertically by writing the computed offset into `entry.margin.top`. That approach worked for simple cases, but it had two drawbacks:

1. It overloaded `cellAlignment.vertical` with different semantics in normal and C3 modes.
2. It made `entry.margin.top` a computed value in `middle`/`bottom` alignment, so users could not manually fine-tune individual characters while still using auto-distribution.

A common workflow is to keep text vertically centered overall while shifting specific characters (e.g., punctuation) down by a small manual amount. This requires the auto-distribution and the manual offset to be independent.

## Decision

We will separate C3 appended-character vertical distribution from `cellAlignment.vertical`:

- `cellAlignment.vertical` is restored to its normal-mode semantics and is hidden in C3 mode.
- A new C3-specific setting, `c3AppendedVerticalAlignment`, controls how appended glyphs share a common visual baseline.
- The auto-computed offset is stored as a new field `distributionOffset` on each `C3AppendedEntry`.
- `entry.margin.top` becomes a purely manual per-character fine-tuning offset.
- The final vertical offset inside a cell is:

  ```
  cellPadding.top + entry.distributionOffset + entry.margin.top
  ```

  The renderer is always called with `alignment.vertical = 'top'` because the effective offset is baked into the margin passed to it.

### Domain model

For every appended character entry:

- `autoGlyphHeight` is the visible pixel height of the glyph, measured by scanning the alpha bounds of an offscreen render.
- `maxHeight = max(autoGlyphHeight for all appended entries)`.
- `entry.distributionOffset` is computed from `c3AppendedVerticalAlignment`:
  - `top`: `0`
  - `middle`: `Math.round((maxHeight - entry.autoGlyphHeight) / 2)`
  - `bottom`: `Math.round(maxHeight - entry.autoGlyphHeight)`
- `entry.margin.top` is never overwritten by the distribution logic.

Imported characters are not analyzed; their original top-aligned sprites are preserved.

### UI changes

- `CellConfig.vue` hides the entire alignment control block in C3 mode.
- `ControlPanel.vue` shows a new `c3AppendedVerticalAlignment` select (top / middle / bottom) in the C3 section.
- `CharacterInput.vue` keeps `margin.top` always editable and shows a read-only "Final Top Offset" field equal to `distributionOffset + margin.top`.

### Re-computation triggers

- Changing `c3AppendedVerticalAlignment`.
- Appending a new character.
- Removing an appended character.
- Changing font, font size, color, or outline style.
- Loading a C3 project.

`cellAlignment.vertical` is no longer watched for C3 distribution re-computation.

## Alternatives Considered

### Alternative 1: Keep reusing `cellAlignment.vertical`

**Rejected because:**

- It prevents manual per-character `margin.top` adjustments while using auto-distribution, which is a common need for punctuation and symbols.
- It gives `cellAlignment.vertical` conflicting meanings between normal and C3 modes.

### Alternative 2: Compute vertical offset at render/export time and not store it

**Rejected because:**

- The exported PNG sprite sheet must contain the offset, otherwise C3 runtime would draw everything top-aligned and the visual distribution would be lost.
- Storing the offset as `distributionOffset` keeps the preview, export, and runtime consistent while leaving `margin.top` for manual tweaks.

### Alternative 3: Include imported characters when computing max height

**Rejected because:**

- Imported characters are intentionally read-only; their cell images come from the uploaded sprite sheet and should not be re-measured.
- Users can still shift the whole appended group relative to imported characters via `cellPadding.top`.

## Consequences

### Positive

- Appended characters can be auto-distributed and manually fine-tuned at the same time.
- `cellAlignment.vertical` has a single, consistent meaning across modes.
- The exported sprite sheet remains compatible with C3's top-aligned rendering.
- A dedicated `getEffectiveCharMargin(index)` helper ensures the preview, export, and canvas all compute the same offset.

### Negative

- A one-time migration is required for existing persisted C3 data and version-1 projects: `c3AppendedVerticalAlignment` defaults to `middle`, all `margin.top` values are reset to `0`, and `distributionOffset` is computed from the existing glyph heights.
- The UI adds one more control to the C3 panel.

## Related Documents

- `CONTEXT.md` — domain glossary entry for C3 mode and appended characters
- `docs/adr/0005-c3-vertical-alignment-reuse.md` — previous decision, now superseded
- `docs/adr/0001-c3-sprite-font-mode.md` — original C3 mode design
- `docs/adr/0003-appended-character-extra-spacing.md` — appended character spacing model
- `src/utils/c3-char-renderer.ts` — glyph bounds measurement
- `src/stores/editor.ts` — distribution computation and persistence
