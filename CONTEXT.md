# Context

## Domain glossary

### Sprite Font Editor
The web-based editor project itself. Its current domain model assumes every cell in the grid has the same render size, same margin, and same padding, and characters are rendered into those cells at the current zoom level for preview. Export produces a PNG whose dimensions match the original base image. In C3 mode the editor becomes a C3 sprite sheet generator: it produces the sprite sheet image and the accompanying C3 font configuration, while runtime-only object properties (text, scale, alignment, wrapping, visibility) are intentionally not exported.

### Project
A self-contained, portable snapshot of the editor's editable state, represented as a folder (or a ZIP archive containing that folder). A Project can be exported from and imported back into the editor, enabling users to switch between different works and allowing external scripts to edit the configuration JSON. A Project covers both the normal sprite-font mode and C3 mode. It contains a `project.json` file, the original base image, an optional custom font file, and — in C3 mode — a separate `c3-instance.json` file. Project export preserves editable source state rather than baked output: for C3 mode this means the original imported sprite sheet and the appended character entries are stored separately so they remain editable after re-import. Projects are versioned and migrated on import; missing assets abort the import, while a missing font only warns and falls back to the system font.

### C3 Mode
An editor mode entered when importing a C3 sprite font. In this mode the editor uses C3 semantics (uniform grid, row-major character set, per-character display widths). Both horizontal and vertical cell alignment are fixed and hidden from the UI because C3 draws cells left-aligned and top-aligned at runtime. Appended characters are distributed vertically by a dedicated `c3AppendedVerticalAlignment` setting instead. The final vertical offset inside a cell is the sum of three independent values: `cellPadding.top`, the auto-computed `distributionOffset` for the appended entry, and the manual `entry.margin.top` fine-tuning offset. `c3AppendedVerticalAlignment` computes `distributionOffset` from the maximum visible glyph height among all appended entries: `top` yields `0`, `middle` centers each glyph within the max height, and `bottom` aligns each glyph to the bottom of the max height. The default is `middle`. Cell margin defaults to 0 because C3 cells are contiguous. Character padding remains available because it offsets the glyph within the exported cell. Image margin and image padding default to 0 but remain editable so that a font located inside a larger sprite atlas can be shifted into place. The generic Upload Image button is hidden in C3 mode; the only way to change the base image is to import another C3 sprite font. If no custom font is uploaded, appended characters are rendered with a fallback system font.

### Imported Character Set
The character set loaded from a C3 instance array when importing. It is kept in memory as the baseline. Users may append new characters, but they cannot edit or reorder existing characters because the imported sprite sheet image already contains them.

### Appended Characters
New characters added by the user after importing a C3 sprite font. They are rendered into the next empty cells after the imported character set and concatenated to the exported `characterSet` and `spacingData`. Appended characters are fully editable: they can be deleted, their margins can be changed, and their display widths can be fine-tuned. Each appended entry stores an auto-computed `distributionOffset` that controls how the glyph shares a common visual baseline with other appended glyphs, plus a manual `margin.top` fine-tuning offset. The effective top offset used at render/export time is `distributionOffset + margin.top`; `cellPadding.top` is applied separately by the renderer. Any change triggers a re-render of all appended characters on top of the imported base image. If the user clears all appended characters, the editor remains in C3 mode and returns to the just-imported state. If the user tries to append a character that already exists in the imported set, the input is rejected: the character input box is highlighted in red and a message lists the duplicated characters. Space characters cannot be appended; if the user enters a space they are prompted to remove it.

### C3 Preview
A read-only preview rendered with C3's exact drawing rules. It uses the imported `characterSpacing` and `lineHeight` values and does not allow changing them, because the original font must not be altered. Users may edit the sample text; the default sample text is the full current character set (imported + appended) and can be reset to that value. Space characters in the preview are rendered using the imported spacing data if a space width is defined, otherwise using `characterWidth`.

### C3 Space Handling
The editor does not allow adding or editing the space character. Imported spacing data may contain a space width override (either through a space entry in `spacingData` or through the dedicated `spaceWidth` fallback). This imported space width is preserved on export and used in the preview.

### C3 Export
Exporting a C3 sprite font produces two artifacts: a PNG image with the same filename as the imported image, and a modal displaying the updated C3 instance JSON. The `spacingData` remains a JSON-encoded string, matching C3's native format. The modal shows the full instance array with only `characterSet` (index 4) and `spacingData` (index 5) changed; all other fields are preserved from the imported array. The modal includes a copy-to-clipboard button and no export confirmation dialog.

### C3 Import Validation
Importing a C3 sprite font is validated strictly. Invalid JSON, non-array input, missing required fields, invalid dimensions, or unparseable `spacingData` block the import and show a clear error. The image does **not** need to be an exact multiple of `characterWidth`/`characterHeight`; the user enters the Font Sprite size (width and height) in the import dialog, and capacity is calculated with `Math.floor`. The import is blocked only if the `characterSet` contains more characters than the configured Font Sprite area can hold. A summary is shown after a successful import, for example: "Imported 95 characters; 5 characters omitted because the image is too small."

### C3 Re-import
If the user imports another C3 sprite font while already in C3 mode, a confirmation dialog is shown because the current project and any appended characters will be overwritten.

### C3 Persistence
The full C3 import state is persisted: the imported base image goes to IndexedDB, and the instance array plus appended characters (with their margins and display widths) go to localStorage. On page reload the editor automatically restores the C3 project.

### Base Image
The uploaded source image that serves as the canvas/background. In the current editor this is also the image that gets exported, with characters painted on top. In a Construct 3 context this corresponds to the sprite sheet texture.

### Cell
A rectangular slot in the grid where one character can be rendered. In the current editor a cell has `width`, `height`, `margin`, and `padding`. The cell dimensions are stored as absolute pixel values relative to the original image (`baseCellConfig`) and scaled for on-screen display (`cellConfig`).

### Canvas View Mode
The zoom strategy used to display the base image and grid inside the editor viewport. Two modes are supported: **Fit to view** scales the image so the entire image fits within the available viewport; **Actual size** (also called 1:1) renders the image at its original pixel dimensions, which may require scrolling.

### Fit to View
A Canvas View Mode that scales the image to fit within the available viewport. This is the default mode because most source images are larger than the viewport.

### Actual Size (1:1)
A Canvas View Mode that renders the image at its original pixel dimensions (`originalImageWidth × originalImageHeight`). When the image is larger than the viewport, the user can scroll or use Space-pan to navigate.

### Space Pan
A canvas interaction where the user holds the Space key and drags to scroll the viewport. It is only active inside the canvas area, changes the cursor to `grab`/`grabbing`, and disables cell-click selection while panning.

### Reference Lines Grid
A grid rendering strategy that draws only row and column boundary lines instead of creating a DOM element for every cell. It reduces the DOM node count from O(rows × cols) to O(rows + cols). Cell highlighting, selection, and click handling are performed with a single temporary highlight div positioned by coordinate calculation.

### Temporary Highlight Div
A single absolutely positioned DOM element used to highlight the currently selected cell or the cell containing the selected character. It is created and positioned on demand rather than being rendered for every cell.

### Character Set
An ordered string of characters. The order determines which grid cell each character occupies, reading left-to-right and top-to-bottom (row-major order). In C3 mode the character set is split using grapheme clusters (`Intl.Segmenter` with `granularity: 'grapheme'`) to match C3's `SplitGraphemes` behavior. User input in the append text box is also split by grapheme clusters. If the browser does not support `Intl.Segmenter`, the editor prompts the user to upgrade their browser.

### Construct 3 Sprite Font (C3 Sprite Font)
A Construct 3 object type that renders text using a sprite sheet. It stores:
- the sprite sheet image
- `characterWidth` and `characterHeight`: the uniform cell size of the grid
- `characterSet`: the ordered list of characters mapped to cells
- `spacingData`: a JSON string representing per-character display widths

### Character Width / Character Height (C3)
The uniform width and height of every cell in the C3 sprite sheet grid. This is **not** the visual width of every glyph; it is the size of the source rectangle cut from the sprite sheet. The equivalent concept in the current editor is the cell size plus padding if the glyph is expected to fill the cell content area.

### Display Width (C3)
The horizontal advance width used when laying out a specific character in C3. Defaults to `characterWidth` unless overridden by spacing data. Multiple characters can share the same display width. For a character `c`, `displayWidth(c)` is:
- `spaceWidth` if `c` is a space and not present in the character set;
- the override from spacing data if `c` appears there and the override differs from `characterWidth`;
- `characterWidth` otherwise.

### Appended Character Extra Spacing
An editor-specific horizontal offset applied **only to appended characters** in C3 mode. It is **not** a native C3 concept; the editor folds it into each appended character's `displayWidth` before exporting `spacingData`. It has two layers:
- **Global default**: a single value configured in the C3 panel and applied to every appended character.
- **Per-character override**: an additional value configured per appended character in the character edit popup.

Both layers are additive: for an appended character `c`,

```
displayWidth(c) = autoDisplayWidth(c) + globalExtraSpacing + perCharExtraSpacing(c)
```

where `autoDisplayWidth(c)` is the measured glyph pixel width plus `padding.left`. Changing the global default immediately recomputes every appended character's `displayWidth`; the per-character override is always added on top of the current global default.

### Spacing Data (C3)
A JSON-encoded array of `[displayWidth, characters]` tuples. Each tuple assigns the same `displayWidth` to every character in the `characters` string. C3 ignores any tuple whose `displayWidth` equals `characterWidth`. The space character may receive a special `spaceWidth` value if it is not present in the character set.

### Space Width (C3)
A dedicated override for the space character when it is not included in the character set. If negative, C3 falls back to `characterWidth`.

### Character Spacing (C3)
An extra horizontal gap added between characters in C3 text layout, independent of `displayWidth`. It is added after every character, including the last one, and can be negative to pull characters closer together. The visual distance from the start of one character cell to the start of the next is `displayWidth + spacing`. In the C3 instance array this is `_characterSpacing` (index 7).

### C3 Sprite Font Instance Array
The serialized form of a C3 Sprite Font object instance. Fields relevant to the font asset are:

| Index | Field | Meaning |
|-------|-------|---------|
| 0 | `_text` | Default text shown in the editor |
| 1 | `_enableBBCode` | Whether BBCode is enabled |
| 2 | `_characterWidth` | Uniform cell width in the sprite sheet |
| 3 | `_characterHeight` | Uniform cell height in the sprite sheet |
| 4 | `_characterSet` | Ordered string of characters mapped to cells |
| 5 | `spacingData` | JSON string of `[[displayWidth, chars], ...]` |
| 6 | `_characterScale` | Runtime render scale |
| 7 | `_characterSpacing` | Extra horizontal gap between characters |
| 8 | `_lineHeight` | Extra vertical gap between lines |
| 9 | `_horizontalAlign` | `0=left`, `1=center`, `2=right` |
| 10 | `_verticalAlign` | `0=top`, `1=center`, `2=bottom` |
| 11 | `_wrapByWord` | `0=word`, `1=cjk`, `2=character` |
| 12 | `initially-visible` | Whether the object starts visible |
| 13 | `origin` | Appears unused |
| 14 | `read-aloud` | Screen reader flag (R344+) |

C3 also uses a JSON save format with short keys: `t`, `ebbc`, `csc`, `csp`, `lh`, `ha`, `va`, `w`, `cw`, `ch`, `cs`, `sd`.

### Row-Major Order
The mapping convention where the first character in the character set occupies the top-left cell, the next cell is to the right, and cells continue left-to-right across each row before moving to the next row. C3 uses row-major order for its sprite sheet grid.

### Cell Placement (C3)
C3 draws each character using a quad whose size is exactly `characterWidth × characterHeight`, placed so that its top-left corner is at the current pen position. C3 does **not** center, pad, or otherwise align the glyph inside the cell; the glyph position inside the sprite sheet cell is whatever the artist drew. The only horizontal offset between characters comes from `displayWidth + spacing`.

For appended characters, the editor emulates vertical centering or bottom alignment by adding a per-character `distributionOffset` (plus any manual `margin.top`) before rendering the glyph into the cell. The exported sprite sheet therefore contains the offset, so the C3 runtime still sees top-aligned cells but the glyphs appear centered or bottom-aligned within a shared maximum height. This does **not** change `displayWidth` or exported `spacingData`.
