# ADR 0005: C3 Appended Character Vertical Auto-Centering via Reused `cellAlignment.vertical`

## Status

Superseded by [ADR 0006: C3 Appended Character Vertical Alignment Separation](0006-c3-appended-vertical-alignment-separation.md)

## Context

In C3 Sprite Font mode, the runtime draws every character at the top of its cell. The editor previously exposed `cellAlignment.vertical` directly to `renderC3AppendedCharacter`, which made appended characters align differently from imported characters and produced inconsistent line layout.

Users still want a way to vertically center or bottom-align appended characters relative to each other, while keeping the exported sprite sheet compatible with C3's top-aligned drawing.

## Decision

We will reuse the existing `cellAlignment.vertical` setting for C3 mode, but with a new meaning:

- **Normal mode**: unchanged — controls how each rendered glyph is aligned inside its cell.
- **C3 mode**: controls how appended characters are distributed vertically within the maximum visible glyph height of all appended characters.
  - `top`: no automatic distribution; `entry.margin.top = 0`.
  - `middle`: vertically center each appended glyph within the max height.
  - `bottom`: bottom-align each appended glyph within the max height.

The actual offset is stored as `entry.margin.top` on each appended character. Rendering still passes `vertical: 'top'` to `renderC3AppendedCharacter`, because the margin itself carries the offset. This keeps C3 runtime behavior unchanged.

### Domain model

For every appended character entry:

- `autoGlyphHeight` is the visible pixel height of the glyph, measured by scanning the alpha bounds of an offscreen render.
- `maxHeight = max(autoGlyphHeight for all appended entries)`.
- `entry.margin.top` is computed from `cellAlignment.vertical`:
  - `top`: `0`
  - `middle`: `Math.round((maxHeight - entry.autoGlyphHeight) / 2)`
  - `bottom`: `Math.round(maxHeight - entry.autoGlyphHeight)`

Imported characters are not analyzed; their original top-aligned sprites are preserved.

### UI changes

- `CellConfig.vue` shows the vertical alignment control in C3 mode, but hides the horizontal control.
- `CharacterInput.vue` makes the `margin.top` input read-only when C3 vertical alignment is `middle` or `bottom`, because the value is auto-computed.

### Re-computation triggers

- Appending a new character.
- Removing an appended character.
- Changing `cellAlignment.vertical`.
- Changing font, font size, color, or outline style.
- Loading a C3 project that already has appended characters.

## Alternatives Considered

### Alternative 1: Add a separate "C3 appended vertical alignment" setting

**Rejected because:**

- It would introduce a second control for a concept that already has a natural home in `cellAlignment.vertical`.
- Horizontal alignment is meaningless in C3 mode (runtime is fixed left), so the existing `cellAlignment.horizontal` is already unused there; reusing `vertical` avoids adding UI clutter.

### Alternative 2: Compute vertical offset at render time instead of storing it in `margin.top`

**Rejected because:**

- The exported PNG sprite sheet must contain the offset, otherwise C3 runtime would draw everything top-aligned and the visual centering would be lost.
- Storing the offset as `margin.top` makes the preview, export, and runtime consistent.

### Alternative 3: Include imported characters when computing max height

**Rejected because:**

- Imported characters are intentionally read-only; their cell images come from the uploaded sprite sheet and should not be re-measured.
- Users can still shift the whole appended group relative to imported characters via `cellPadding.top`.

## Consequences

### Positive

- Appended characters can be visually centered or bottom-aligned without changing C3 runtime behavior.
- No new persistent configuration field is needed.
- The exported sprite sheet remains compatible with C3's top-aligned rendering.

### Negative

- `cellAlignment.vertical` has different semantics in normal and C3 modes, which must be documented clearly.
- `margin.top` is overwritten automatically in C3 mode when vertical alignment is not `top`, so manual per-character top margin adjustments are only possible in `top` mode.

## Related Documents

- `CONTEXT.md` — domain glossary entry for C3 appended character vertical distribution
- `docs/adr/0001-c3-sprite-font-mode.md` — original C3 mode design
- `docs/adr/0003-appended-character-extra-spacing.md` — appended character spacing model
- `src/utils/c3-char-renderer.ts` — glyph bounds measurement
- `src/stores/editor.ts` — alignment application and re-computation logic
