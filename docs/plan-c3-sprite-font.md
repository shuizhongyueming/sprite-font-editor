# Implementation Plan: Construct 3 Sprite Font Support

## Goal
Add Construct 3 (C3) Sprite Font import/export support to the existing Sprite Font Editor, allowing users to import an existing C3 sprite sheet + instance array, append new characters, and export the updated image + C3 instance array.

## Background
The existing editor uses a generic cell model: each cell has width/height/margin/padding, characters are rendered with alignment and object-fit scaling, and export produces a PNG matching the original image size.

C3 uses a different model:
- Uniform grid cells of `characterWidth × characterHeight`
- Characters mapped row-major by `characterSet`
- Per-character `displayWidth` via `spacingData` JSON string
- Cells drawn top-left aligned; no internal alignment/padding at runtime
- Extra `characterSpacing` between characters and `lineHeight` between lines

Therefore we introduce a dedicated **C3 mode** rather than forcing C3 semantics into the generic model.

## Domain Decisions (from grilling session)
- C3 mode is entered by importing a C3 sprite font (image + instance array).
- In C3 mode, cell alignment is fixed to top-left.
- Cell margin defaults to 0; image margin/padding default to 0 but remain editable for atlas offset.
- Character padding is retained as an image-generation offset.
- Imported characters are read-only; users can only append new characters.
- Appended characters are fully editable (delete, margin, display width) and trigger a full re-render of all appended characters on the imported base image.
- Duplicate characters in append input are blocked with red highlight + message.
- Space characters cannot be appended; imported space width is preserved.
- Display width for new characters = measured glyph pixel width + `characterPadding.left`.
- Character set and append input are split by grapheme clusters (`Intl.Segmenter`).
- Export downloads PNG with the original filename and shows a modal with the updated full C3 instance array (only indices 4 and 5 changed).
- Full C3 state is persisted (image to IndexedDB, config + appended chars to localStorage).

## Implementation Order

### Phase A: C3 Import + Grid Display
1. **Update `editor.ts` store**
   - Add `isC3Mode: boolean`
   - Add `c3InstanceArray: C3InstanceArray | null` using a typed tuple:
     ```typescript
     export type C3InstanceArray = [
       string,  // 0: _text
       boolean, // 1: _enableBBCode
       number,  // 2: _characterWidth
       number,  // 3: _characterHeight
       string,  // 4: _characterSet
       string,  // 5: spacingData
       number,  // 6: _characterScale
       number,  // 7: _characterSpacing
       number,  // 8: _lineHeight
       number,  // 9: _horizontalAlign
       number,  // 10: _verticalAlign
       number,  // 11: _wrapByWord
       boolean, // 12: initially-visible
       unknown, // 13: origin
       boolean, // 14: read-aloud
       ...unknown[] // future fields
     ];
     ```
   - Add `importedCharacterSet: string`
   - Add `importedSpacingData: string`
   - Add `importedCharacterSpacing: number`
   - Add `importedLineHeight: number`
   - Add `appendedCharacterEntries: C3CharacterEntry[]` with `displayWidth` field
   - Add `originalImportedImage: HTMLImageElement | null` (the base image before appended chars)
   - Add derived `effectiveCharacterSet` and `effectiveSpacingData`
   - Add actions: `importC3SpriteFont`, `appendC3Characters`, `removeAppendedC3Character`, `updateAppendedC3DisplayWidth`, `clearAppendedC3Characters`, `exportC3SpriteFont`
   - **Store mapping in C3 mode**:
     - `baseCellConfig.width` = `_characterWidth`
     - `baseCellConfig.height` = `_characterHeight`
     - `baseCellConfig.margin` = `{ top: 0, right: 0, bottom: 0, left: 0 }` (read-only in UI)
     - `cellAlignment` = `{ horizontal: "left", vertical: "top" }` (read-only in UI)
     - `characterEntries` is unused in C3 mode; appended chars live in `appendedCharacterEntries`

2. **Create `src/utils/c3-parser.ts`**
   - `parseC3InstanceArray(input: string): C3InstanceData`
   - Validate JSON, array length, required fields, positive dimensions, valid spacingData JSON
   - Validate image dimensions are exact multiples of characterWidth/Height
   - Validate characterSet fits in available cells
   - Split characterSet by grapheme clusters
   - Build a map of char → displayWidth from spacingData (handle spaceWidth fallback)
   - Return structured data

3. **Create `src/utils/grapheme.ts`**
   - `splitGraphemes(text: string): string[]` using `Intl.Segmenter`
   - Fallback: prompt user if `Intl.Segmenter` unavailable

4. **Update `Toolbar.vue`**
   - Add "Import C3 Sprite Font" button
   - Hide "Upload Image" button when `isC3Mode`
   - Keep "Upload Font" visible (used for appended chars)

5. **Create `src/components/C3ImportModal.vue`**
   - File input for image
   - Textarea for C3 instance array JSON
   - Font Sprite width/height inputs (default to image dimensions; editable for atlas support)
   - Validate button + import button
   - Show validation errors and import summary
   - **Re-import flow**: if `isC3Mode` is already true when the modal opens, show a confirmation dialog: "Re-importing will overwrite the current C3 project and any appended characters. Continue?"
   - Capacity is calculated with `Math.floor(fontSpriteWidth / characterWidth) × Math.floor(fontSpriteHeight / characterHeight)`

6. **Update `CanvasArea.vue`**
   - In C3 mode, use `characterWidth/Height` from C3 config for grid
   - Disable cell margin (force 0)
   - Allow image margin/padding
   - Do not render imported characters (they are already in the image)
   - Render appended characters into correct cells

7. **Update `ControlPanel.vue`**
   - In C3 mode, show C3-specific sections and hide generic ones where appropriate

### Phase B: Append Character Rendering
1. **Update `CharacterInput.vue`**
   - In C3 mode, input box appends characters instead of replacing
   - Validate no duplicates against imported set
   - Reject spaces
   - Split input by grapheme clusters
   - Show appended characters separately from imported characters

2. **Create `src/utils/c3-char-renderer.ts`**
   - `measureGlyphWidth(text, font, fontSize, cellWidth, cellHeight, padding)`
   - Renders character offscreen and scans alpha bounds
   - Returns `glyphWidth + padding.left` as display width
   - Handle fallback font

3. **Update rendering flow**
   - On append/render, reset canvas to `originalImportedImage`
   - Render all `appendedCharacterEntries` into their cells
   - Store each appended char's computed display width

4. **Character popup editing**
   - Add display width input to existing margin popup
   - Add "Reset to auto" button
   - Auto re-render on change

### Phase C: C3 Preview Area
1. **Create `src/components/C3Preview.vue`**
   - Sample text input (default = imported + appended character set)
   - Reset sample text button
   - Canvas rendering with C3 logic:
     - Draw full `characterWidth × characterHeight` cells
     - Advance by `displayWidth + importedCharacterSpacing`
     - New line by `characterHeight + importedLineHeight`
   - Handle space with imported space width or characterWidth

2. **Add to `ControlPanel.vue`**
   - Place after InsertPointInfo

### Phase D: C3 Export
1. **Update `Toolbar.vue` export flow**
   - In C3 mode, export triggers PNG download + modal

2. **Create `src/utils/c3-export.ts`**
   - `buildC3InstanceArray(originalArray, characterSet, spacingData)`
   - Keep all other fields unchanged
   - Convert spacingData to C3 format string
   - Group characters by display width for compact spacing data
   - Skip entries where displayWidth equals characterWidth

3. **Create `src/components/C3ExportModal.vue`**
   - Show full updated instance array as JSON
   - Copy to clipboard button
   - No confirmation dialog before export
   - Show a brief success notification after PNG download completes

### Phase E: Persistence
1. **Update `storage.ts`**
   - Add `C3ConfigStorage` for instance array + appended chars
   - Include a `storageVersion` field (start at `1`) in the persisted state

2. **Update `editor.ts` save/load**
   - Save/restore C3 mode state
   - Restore `originalImportedImage` from IndexedDB
   - On load, check `storageVersion`; if mismatched or missing, prompt user to re-import instead of silently restoring

### Phase F: Tests
1. Unit tests for `c3-parser.ts`
2. Unit tests for `c3-export.ts`
3. Unit tests for grapheme splitting
4. Unit tests for display width measurement
5. Integration tests for import/export round-trip

## Files to Create/Modify

### New files
- `src/utils/c3-parser.ts`
- `src/utils/c3-export.ts`
- `src/utils/c3-char-renderer.ts`
- `src/utils/grapheme.ts`
- `src/components/C3ImportModal.vue`
- `src/components/C3ExportModal.vue`
- `src/components/C3Preview.vue`
- `docs/adr/0001-c3-sprite-font-mode.md`

> File naming: new Vue components use PascalCase filenames to match existing components (`CanvasArea.vue`, `ControlPanel.vue`).

### Modified files
- `src/stores/editor.ts`
- `src/components/Toolbar.vue`
- `src/components/CanvasArea.vue`
- `src/components/ControlPanel.vue`
- `src/components/CharacterInput.vue`
- `src/components/SegmentControl.vue` (if needed)
- `src/utils/storage.ts`
- `src/utils/i18n.ts` (add C3-related translations)
- `src/utils/notification.ts` (if needed)
- `src/assets/styles/main.css` (if needed)

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Display width measurement inaccurate for thin glyphs | Use alpha scan with small threshold; allow manual override |
| Imported spacing data has edge cases (spaceWidth, malformed JSON) | Validate strictly and show clear errors |
| Browser lacks `Intl.Segmenter` | Prompt user to upgrade; this is rare in modern browsers |
| Image atlas offset confusion | Keep image margin/padding visible and editable with clear labels |
| State persistence gets out of sync with C3 project | Version the persisted state and allow manual re-import |

## Acceptance Criteria
- [ ] Can import a C3 sprite sheet + instance array
- [ ] Grid displays correctly in C3 mode
- [ ] Can append new characters without modifying imported ones
- [ ] Duplicate detection blocks input and highlights red
- [ ] Space characters are rejected
- [ ] Display width auto-calculates and is editable
- [ ] Preview renders text using C3 logic
- [ ] Export downloads PNG and shows updated instance array
- [ ] State persists across page reloads
- [ ] Existing non-C3 mode behavior unchanged
