# ADR 0001: Add Construct 3 Sprite Font Import/Export Mode

## Status
Accepted

## Context
The Sprite Font Editor currently supports a generic sprite-font workflow: upload a base image, configure a grid with cell width/height/margin/padding, upload a font, render characters with alignment and object-fit scaling, and export a PNG.

Construct 3 (C3) uses a different sprite-font model:
- The sprite sheet is a uniform grid of `characterWidth × characterHeight` cells.
- Characters are mapped row-major by an ordered `characterSet` string.
- Each character has a `displayWidth` (horizontal advance) defined by a `spacingData` JSON string.
- C3 draws each full cell top-left aligned; there is no internal alignment or padding at runtime.
- Extra `characterSpacing` and `lineHeight` control runtime text layout but are not part of the sprite sheet.

Our goal is to let users extend an existing C3 sprite font by importing its image and configuration, appending new characters, and exporting the updated image + configuration.

## Decision
We will add a dedicated **C3 mode** to the editor instead of trying to map C3 semantics onto the existing generic cell model.

Key consequences of this decision:
- C3 mode is entered by importing a C3 sprite font (image + C3 instance array).
- In C3 mode, horizontal cell alignment is fixed to left to match C3 drawing; vertical alignment remains configurable.
- Cell margin is forced to 0 because C3 cells are contiguous.
- Image margin and padding default to 0 but remain editable so a font inside a larger sprite atlas can be shifted into place.
- Character padding is retained as an image-generation offset; it determines where the glyph is drawn inside each exported cell.
- Imported characters are read-only. Users may only append new characters after the imported set.
- Appended characters are fully editable (delete, margin, display width) and trigger a re-render of all appended characters on top of the imported base image.
- Duplicate character detection blocks append input and highlights the input red.
- Space characters cannot be appended; imported space width handling is preserved unchanged.
- Display width for new characters is auto-calculated as `measured glyph pixel width + characterPadding.left` and can be manually fine-tuned.
- Character sets and user input are split by grapheme clusters to match C3's `SplitGraphemes` behavior.
- Export produces the PNG image (same filename as imported) and a modal with the updated full C3 instance array, where only `characterSet` and `spacingData` are changed.
- Full C3 state is persisted: imported image to IndexedDB, instance array and appended characters to localStorage.

## Alternatives Considered

### Alternative 1: Reuse the existing generic cell model
We could have tried to express C3 concepts using the existing cell width/height/margin/padding/alignment model. This was rejected because:
- C3 has no per-cell margin; cells are contiguous.
- C3 has a separate `displayWidth` concept that does not map to any existing editor concept.
- The existing horizontal alignment feature would mislead users, because C3 always draws cells left-aligned. (Vertical alignment was later made configurable for appended characters to help even out glyph baselines, but it does not affect C3 runtime layout.)
- The resulting UI would be confusing and error-prone.

### Alternative 2: Allow editing imported characters
We could have allowed users to re-render imported characters. This was rejected because:
- The imported image already contains the original characters.
- Re-rendering them would require the original font, which we may not have.
- The core use case is "extend an existing C3 font," not "replace existing characters."

### Alternative 3: Default display width to characterWidth
We could have defaulted every new character's display width to `characterWidth` and relied entirely on manual tuning. This was rejected because:
- Auto-measuring glyph width produces a much better default for narrow characters (e.g., `i`, `.`).
- Manual tuning remains available for cases where the auto value is wrong.

## Consequences

### Positive
- C3 mode is self-contained and does not complicate the existing generic editor flow.
- The UI accurately reflects C3 semantics, reducing user confusion.
- The import/export round-trip preserves all non-font C3 instance properties.
- Users can incrementally extend existing C3 sprite fonts without starting from scratch.

### Negative
- We must maintain two parallel UI/UX paths (generic mode and C3 mode).
- The store and components gain C3-specific branches.
- Display width auto-calculation depends on browser canvas text measurement and may need manual correction for some fonts.

## Related Documents
- `CONTEXT.md` — domain glossary for C3 terms
- `docs/plan-c3-sprite-font.md` — implementation plan
