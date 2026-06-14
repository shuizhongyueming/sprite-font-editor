import { renderCharacterToCellScaled } from "@/utils/char-renderer";
import type { RenderCharacterOptions } from "@/utils/char-renderer";

/**
 * Options for measuring a glyph's visible bounds in C3 mode.
 */
export interface MeasureGlyphBoundsOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  characterWidth: number;
  characterHeight: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  color?: string;
  outline?: RenderCharacterOptions["outline"];
}

/**
 * @deprecated Use {@link MeasureGlyphBoundsOptions} instead.
 */
export type MeasureGlyphDisplayWidthOptions = MeasureGlyphBoundsOptions;

/**
 * Render a single character offscreen and scan its visible alpha bounds.
 * Returns the visible glyph width and height, excluding padding.
 */
export function measureGlyphBounds(
  options: MeasureGlyphBoundsOptions,
): { width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { width: options.characterWidth, height: options.characterHeight };
  }

  canvas.width = options.characterWidth;
  canvas.height = options.characterHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const font = `${options.fontSize}px ${options.fontFamily}`;
  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.imageSmoothingEnabled = false;

  let drawX = options.padding.left;
  let drawY = options.padding.top;

  if (options.outline?.enabled) {
    ctx.strokeStyle = options.outline.color;
    ctx.lineWidth = options.outline.width;
    ctx.lineJoin = "round";

    drawX += options.outline.width;
    drawY += options.outline.width;

    ctx.strokeText(options.text, drawX, drawY);
  }

  ctx.fillStyle = options.color || "#000000";
  ctx.fillText(options.text, drawX, drawY);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }

  const visibleGlyphWidth = maxX >= minX ? maxX - minX + 1 : 0;
  const visibleGlyphHeight = maxY >= minY ? maxY - minY + 1 : 0;
  return { width: visibleGlyphWidth, height: visibleGlyphHeight };
}

/**
 * Render a single character offscreen and scan its visible alpha bounds.
 * Returns the visible glyph width plus left padding, which is the C3 display
 * width used for horizontal advancement.
 */
export function measureGlyphDisplayWidth(
  options: MeasureGlyphDisplayWidthOptions,
): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    return options.characterWidth;
  }

  const bounds = measureGlyphBounds(options);
  return bounds.width + options.padding.left;
}

/**
 * Options for rendering an appended C3 character into a target canvas.
 */
export interface RenderC3AppendedCharacterOptions {
  char: string;
  targetCtx: CanvasRenderingContext2D;
  baseCellX: number;
  baseCellY: number;
  baseCellWidth: number;
  baseCellHeight: number;
  renderScale: number;
  charMargin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  cellPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontFamily: string;
  fontSize: number;
  color: string;
  outline?: RenderCharacterOptions["outline"];
  pixelStyle?: boolean;
  alignment?: {
    horizontal: "left" | "center" | "right";
    vertical: "top" | "middle" | "bottom";
  };
}

/**
 * Render one appended character at the correct C3 cell position.
 * Horizontal alignment is always left to match C3's cell drawing,
 * but vertical alignment can be adjusted to even out glyph baselines.
 */
export function renderC3AppendedCharacter(
  options: RenderC3AppendedCharacterOptions,
): void {
  renderCharacterToCellScaled(
    options.char,
    options.targetCtx,
    options.baseCellX,
    options.baseCellY,
    options.baseCellWidth,
    options.baseCellHeight,
    options.renderScale,
    options.charMargin,
    options.cellPadding,
    {
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      color: options.color,
      outline: options.outline,
      alignment: {
        horizontal: "left",
        vertical: options.alignment?.vertical ?? "top",
      },
    },
    options.pixelStyle ?? false,
  );
}
