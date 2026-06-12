# ADR 0002: Canvas View Modes and Reference-Lines Grid Rendering

## Status

Accepted

## Context

The Sprite Font Editor currently renders the base image scaled to fit the viewport (`maxCanvasWidth × maxCanvasHeight`). The grid is rendered as one DOM element per cell (`<div class="grid-cell">`), which is simple but creates O(rows × cols) DOM nodes. For large sprite sheets this becomes a performance bottleneck and makes the UI sluggish.

We need to support two related improvements:

1. **View the image at its original pixel size.** Users want to inspect and align the grid against the actual source pixels, especially for pixel-art fonts and precise font metrics.
2. **Reduce the grid rendering cost.** The per-cell div approach does not scale to dense grids.

At the same time, we want to preserve existing interactions (cell selection, character highlighting, margin/padding lines, rulers) without a complete rewrite.

## Decision

We will introduce two Canvas View Modes and replace the per-cell grid with a reference-lines implementation.

### Canvas View Modes

- **Fit to view** (default): scales the image so the entire image fits inside the viewport, preserving the current behavior.
- **Actual size (1:1)**: renders the image at `originalImageWidth × originalImageHeight`. If the image is larger than the viewport, the browser scrollbar appears and the user can navigate by scrolling or by using Space-pan.

A segmented control `[Fit to view] [1:1]` is placed in the top-right corner of `CanvasArea`, together with the current zoom percentage. The selected mode is persisted to `localStorage`, but the default is always `Fit to view` so new users do not open a huge image at 100% by accident.

When switching modes, the viewport tries to keep the same relative center point so the user does not lose context.

### Space Pan

In `Actual size` mode (and whenever the canvas is scrollable), the user can hold `Space` and drag inside the canvas area to pan the viewport by updating `scrollLeft/scrollTop` of `.canvas-area`. The cursor changes to `grab`/`grabbing`. While Space is held, cell-click selection is disabled to avoid accidental selection when panning.

We deliberately use native scroll rather than CSS transforms:

- It works with the existing DOM-based overlay (grid, highlights, rulers) without extra synchronization.
- It preserves accessibility and standard scroll behavior (scroll wheel, trackpad, keyboard).

### Reference-Lines Grid

The per-cell `<div class="grid-cell">` loop is replaced by reference lines:

- Render `rows + 1` horizontal lines and `cols + 1` vertical lines as 1px divs.
- This reduces DOM node count from O(rows × cols) to O(rows + cols).
- Line color follows `gridConfig.cellBorderColor`; visibility follows `gridConfig.enabled`.

Cell selection and highlighting are handled by a single temporary highlight div positioned via `CanvasSpace.positionToCell()` and `CanvasSpace.getCellPosition()`. Only two highlight states are retained:

- The currently selected insert point (red border).
- The cell containing the selected character (green border).

The previous "show all detected insert points" highlight is removed because it could reintroduce many DOM nodes in auto-detection mode, defeating the performance goal.

### Margin/Padding Lines

Margin and padding lines remain single DOM divs as they are today. Their performance cost is O(1) and independent of grid density, so they do not need to be migrated into the reference-lines system.

### Rulers

Rulers remain inside `.canvas-container` and scroll with the content. We do not implement frozen viewport rulers at this time; Space-pan and scrollbars provide sufficient navigation.

## Alternatives Considered

### Alternative 1: Add a second canvas layer for grid UI

We could draw the grid, highlights, and rulers on a dedicated UI canvas on top of the image canvas.

**Rejected because:**

- It requires synchronizing two canvases for size, DPI scaling, and redraw events.
- It complicates hit-testing for cell clicks.
- Reference lines with a temporary highlight div achieve similar performance for grid rendering while keeping the existing DOM event model.

### Alternative 2: Keep per-cell divs and virtualize them

We could render only the visible cells using virtual scrolling.

**Rejected because:**

- It adds significant complexity for viewport tracking and cell recycling.
- Reference lines are simpler and handle arbitrarily large grids with a small, fixed number of DOM nodes.

### Alternative 3: Use CSS transforms for panning instead of native scroll

We could hide scrollbars and translate `.canvas-container` based on Space-drag delta.

**Rejected because:**

- It would require manually offsetting rulers and overlays.
- It breaks standard scroll interactions and accessibility.
- Native scroll already solves the problem and works with the existing layout.

### Alternative 4: Always render at actual size

We could remove the fit-to-view scaling entirely and always render at original size.

**Rejected because:**

- Most source images are larger than the viewport; defaulting to actual size would make the first impression confusing.
- A toggle gives users explicit control without sacrificing the current convenient default.

## Consequences

### Positive

- Large sprite sheets render without creating thousands of grid-cell DOM nodes.
- Users can inspect pixel-perfect alignment at actual size.
- Space-pan provides a familiar canvas navigation interaction.
- Native scroll keeps the implementation accessible and simple.

### Negative

- Grid interactions (click, highlight) must be recalculated from coordinates instead of relying on per-cell DOM elements.
- The "all detected insert points" highlight is removed; users see only the active insert point and selected character.
- Rulers scroll with the content rather than staying fixed to the viewport.

## Related Documents

- `CONTEXT.md` — domain glossary for view modes and reference-lines grid
- `src/components/CanvasArea.vue` — main canvas and grid rendering component
- `src/stores/editor.ts` — canvas scale and view state
- `src/utils/canvas.ts` — `CanvasSpace` coordinate conversion utilities
