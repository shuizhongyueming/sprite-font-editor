import { renderCharacterToCellUnscaled } from "@/utils/char-renderer";
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
 * 单字符可见 alpha bbox：width/height 为视觉宽高，
 * left/top 为可见左缘/上缘相对画布（cell）原点的偏移（alpha bbox 的 minX/minY）。
 * 无可见像素时 width/height 为 0，left/top 为 0。
 */
export interface GlyphBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * Render a single character offscreen and scan its visible alpha bounds.
 * Returns the visible glyph width and height, excluding padding,
 * plus the glyph's visible left/top offset relative to the cell origin.
 */
export function measureGlyphBounds(
  options: MeasureGlyphBoundsOptions,
): GlyphBounds {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      width: options.characterWidth,
      height: options.characterHeight,
      left: 0,
      top: 0,
    };
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
  return {
    width: visibleGlyphWidth,
    height: visibleGlyphHeight,
    left: maxX >= minX ? minX : 0,
    top: maxY >= minY ? minY : 0,
  };
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
 * Render one appended character at the correct C3 cell position,
 * strictly clipped to the current cell boundary.
 * Horizontal alignment is always left to match C3's cell drawing,
 * but vertical alignment can be adjusted to even out glyph baselines.
 *
 * The glyph is rendered at its measured original size (no fit-scaling —
 * appended characters keep font/fontSize/padding/margin/outline as configured;
 * see renderCharacterToCellUnscaled). Any part overflowing the cell is cut off
 * by `save → clip(cell rect × renderScale) → render → finally restore`, and a
 * render failure still restores the context in the finally block.
 */
export function renderC3AppendedCharacter(
  options: RenderC3AppendedCharacterOptions,
): void {
  const { targetCtx, renderScale } = options;
  targetCtx.save();
  try {
    targetCtx.beginPath();
    // 裁剪区域必须与渲染的绘制坐标一致（按 renderScale 缩放），
    // 否则缩放画布（CanvasArea 传 canvasScale）时裁切矩形会错位/过小。
    targetCtx.rect(
      options.baseCellX * renderScale,
      options.baseCellY * renderScale,
      options.baseCellWidth * renderScale,
      options.baseCellHeight * renderScale,
    );
    targetCtx.clip();
    renderCharacterToCellUnscaled(
      options.char,
      targetCtx,
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
  } finally {
    targetCtx.restore();
  }
}
