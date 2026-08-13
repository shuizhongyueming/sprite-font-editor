/**
 * 字符渲染工具
 * 提供离屏 Canvas 字符渲染功能
 */

export interface RenderedCharacter {
  canvas: HTMLCanvasElement;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface RenderCharacterOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  outline?: {
    enabled: boolean;
    color: string;
    width: number;
  };
  contentWidth: number;
  contentHeight: number;
  alignment: {
    horizontal: "left" | "center" | "right";
    vertical: "top" | "middle" | "bottom";
  };
}

/**
 * 计算字符渲染位置和尺寸（object-fit 逻辑）
 */
export function calculateCharRenderSize(
  textWidth: number,
  textHeight: number,
  availableWidth: number,
  availableHeight: number,
): { width: number; height: number; scale: number } {
  if (textWidth <= availableWidth && textHeight <= availableHeight) {
    return {
      width: textWidth,
      height: textHeight,
      scale: 1,
    };
  }

  // 计算缩放比例（保持宽高比）
  const widthRatio = availableWidth / textWidth;
  const heightRatio = availableHeight / textHeight;
  const scale = Math.min(widthRatio, heightRatio);

  // 计算渲染尺寸
  const renderWidth = textWidth * scale;
  const renderHeight = textHeight * scale;

  return {
    width: renderWidth,
    height: renderHeight,
    scale,
  };
}

/**
 * 计算对齐位置
 */
export function calculateAlignment(
  renderWidth: number,
  renderHeight: number,
  availableWidth: number,
  availableHeight: number,
  horizontalAlign: "left" | "center" | "right",
  verticalAlign: "top" | "middle" | "bottom",
): { x: number; y: number } {
  let alignedX = 0;
  let alignedY = 0;

  // 水平对齐
  switch (horizontalAlign) {
    case "center":
      alignedX = (availableWidth - renderWidth) / 2;
      break;
    case "right":
      alignedX = availableWidth - renderWidth;
      break;
    case "left":
    default:
      alignedX = 0;
      break;
  }

  // 垂直对齐
  switch (verticalAlign) {
    case "middle":
      alignedY = (availableHeight - renderHeight) / 2;
      break;
    case "bottom":
      alignedY = availableHeight - renderHeight;
      break;
    case "top":
    default:
      alignedY = 0;
      break;
  }

  return { x: alignedX, y: alignedY };
}

/**
 * 扫描 Canvas 确定文本边界（基于透明度）
 */
export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function scanTextBoundsOptimized(
  canvasWidth: number,
  canvasHeight: number,
  imageData: ImageData,
  threshold: number = 0,
): TextBounds {
  const { data } = imageData;
  const width = canvasWidth;
  const height = canvasHeight;

  // 初始化边界
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  // 全扫描
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 如果没找到文本，返回整个区域
  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width, height };
  }

  // 返回边界框（包含最后一个像素）
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * 测量文本尺寸
 */
export function measureText(
  text: string,
  font: string,
  canvas: HTMLCanvasElement = document.createElement("canvas"),
): { width: number; height: number } {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: 0, height: 0 };

  ctx.font = font;

  // 测量文本宽度
  const metrics = ctx.measureText(text);
  const width = metrics.width;

  // 估算文本高度（实际字体高度）
  // 使用 measureText 的 fontBoundingBoxAscent 和 fontBoundingBoxDescent（如果支持）
  const ascent =
    metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? 0;
  const descent =
    metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0;
  const height = ascent + descent || parseInt(font) || 16;

  return { width, height };
}

/**
 * 在离屏 Canvas 上渲染字符（原始尺寸）
 */
export function renderCharacterOnCanvas(
  options: RenderCharacterOptions,
): RenderedCharacter {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  canvas.width = options.contentWidth;
  canvas.height = options.contentHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const font = `${options.fontSize}px ${options.fontFamily}`;
  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.imageSmoothingEnabled = true;

  // 默认做一些偏移量去渲染文本
  // 有些文本，在某些字体下，可能是会有一些溢出的
  let drawX = 2;
  let drawY = 2;

  if (options.outline?.enabled) {
    ctx.strokeStyle = options.outline.color;
    ctx.lineWidth = options.outline.width;
    ctx.lineJoin = "round";

    // 有描边的实话，开始绘制的节点需要考虑到描边的宽度
    // 如果还是紧贴左上角绘制，会导致左边和顶部的描边被裁剪掉
    drawX += options.outline.width;
    drawY += options.outline.width;
    ctx.strokeText(options.text, drawX, drawX);
  }

  ctx.fillStyle = options.color;
  ctx.fillText(options.text, drawX, drawY);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = scanTextBoundsOptimized(
    canvas.width,
    canvas.height,
    imageData,
  );

  return {
    canvas,
    sourceX: bounds.x,
    sourceY: bounds.y,
    sourceWidth: bounds.width,
    sourceHeight: bounds.height,
  };
}

/**
 * 将离屏 Canvas 绘制到目标 Canvas（支持缩放）
 */
export function drawCharacterToCanvas(
  charCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  pixelStyle: boolean = false,
): void {
  if (!charCanvas || !targetCtx) return;

  if (pixelStyle) {
    targetCtx.imageSmoothingEnabled = false;
  }

  targetCtx.drawImage(charCanvas, sx, sy, sw, sh, dx, dy, dw, dh);

  if (pixelStyle) {
    targetCtx.imageSmoothingEnabled = true;
  }
}

/**
 * 将字符渲染到目标位置（原始尺寸，不缩放）
 * 字符会在 cell 内进行 object-fit 缩放
 */
export function renderCharacterToCell(
  character: string,
  targetCtx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  charMargin: { top: number; right: number; bottom: number; left: number },
  cellPadding: { top: number; right: number; bottom: number; left: number },
  options: Omit<
    RenderCharacterOptions,
    "text" | "contentWidth" | "contentHeight"
  >,
  pixelStyle: boolean = false,
): void {
  const contentWidth = cellWidth - cellPadding.left - cellPadding.right;
  const contentHeight = cellHeight - cellPadding.top - cellPadding.bottom;

  const rendered = renderCharacterOnCanvas({
    ...options,
    text: character,
    contentWidth: cellWidth,
    contentHeight: cellHeight,
  });

  const renderSize = calculateCharRenderSize(
    rendered.sourceWidth,
    rendered.sourceHeight,
    contentWidth,
    contentHeight,
  );

  const position = calculateAlignment(
    renderSize.width,
    renderSize.height,
    contentWidth,
    contentHeight,
    options.alignment.horizontal,
    options.alignment.vertical,
  );

  const targetX = cellX + cellPadding.left + position.x + charMargin.left;
  const targetY = cellY + cellPadding.top + position.y + charMargin.top;

  drawCharacterToCanvas(
    rendered.canvas,
    targetCtx,
    rendered.sourceX,
    rendered.sourceY,
    rendered.sourceWidth,
    rendered.sourceHeight,
    targetX,
    targetY,
    renderSize.width,
    renderSize.height,
    pixelStyle,
  );
}

export interface MeasureGlyphExtentOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  outline?: { enabled: boolean; width: number };
}

export interface GlyphExtent {
  width: number;
  height: number;
}

/**
 * 估算字形的测量上界（含 outline 与安全边缘），用于不缩放渲染的离屏画布尺寸。
 * 基于 CanvasTextMetrics 的 actualBoundingBox* / fontBoundingBox*，
 * 缺失时回退到 fontSize 与 metrics.width；cell 尺寸只作为最小离屏尺寸。
 * context 缺失 / measureText 抛错属于兼容回退：记录 console.warn 后返回
 * 基于 fontSize 的保守上界（不静默）。
 */
export function measureGlyphExtent(
  options: MeasureGlyphExtentOptions,
): GlyphExtent {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    console.warn(
      "[CharRenderer] measureGlyphExtent: canvas context unavailable; falling back to fontSize bounds",
    );
    return { width: options.fontSize * 2, height: options.fontSize * 2 };
  }
  ctx.font = `${options.fontSize}px ${options.fontFamily}`;
  let metrics: TextMetrics;
  try {
    metrics = ctx.measureText(options.text);
  } catch (error) {
    console.warn(
      "[CharRenderer] measureGlyphExtent: measureText failed; falling back to fontSize bounds",
      error,
    );
    metrics = { width: options.fontSize } as TextMetrics;
  }
  const ascent =
    metrics.actualBoundingBoxAscent ??
    metrics.fontBoundingBoxAscent ??
    options.fontSize;
  const descent =
    metrics.actualBoundingBoxDescent ??
    metrics.fontBoundingBoxDescent ??
    Math.ceil(options.fontSize * 0.2);
  const left = metrics.actualBoundingBoxLeft ?? 0;
  const right =
    metrics.actualBoundingBoxRight ??
    Math.max(metrics.width ?? 0, options.fontSize);

  const outlinePad = options.outline?.enabled ? options.outline.width * 2 : 0;
  // renderCharacterOnCanvas 从 (2,2) 起画；额外安全边缘覆盖负 bearing 与描边
  const SAFETY = 4;
  return {
    width: Math.ceil(
      Math.max(0, left < 0 ? -left : left) + right + outlinePad + SAFETY,
    ),
    height: Math.ceil(ascent + descent + outlinePad + SAFETY),
  };
}

/**
 * 将字符按原尺寸渲染到目标位置（不做 fit 缩放，供 C3 追加字符使用）。
 *
 * 与 renderCharacterToCellScaled 的区别：跳过 calculateCharRenderSize，
 * 字形按测量出的原始尺寸绘制，溢出部分由调用方的 cell clip 截断，而不是
 * 按比例缩小到可用区域。离屏画布尺寸由字形测量上界（measureGlyphExtent）
 * 决定，cell 尺寸只作为最小离屏尺寸——因此 cell 缩小（如 149 → 34）不会
 * 提前截断字形，传给目标 drawImage 的 glyph 尺寸保持不变。
 * cell padding / margin 与对齐定位语义与 scaled 版本保持一致。
 */
export function renderCharacterToCellUnscaled(
  character: string,
  targetCtx: CanvasRenderingContext2D,
  baseCellX: number,
  baseCellY: number,
  baseCellWidth: number,
  baseCellHeight: number,
  renderScale: number,
  charMargin: { top: number; right: number; bottom: number; left: number },
  cellPadding: { top: number; right: number; bottom: number; left: number },
  options: Omit<
    RenderCharacterOptions,
    "text" | "contentWidth" | "contentHeight"
  >,
  pixelStyle: boolean = false,
): void {
  const targetX = baseCellX * renderScale;
  const targetY = baseCellY * renderScale;

  const contentWidth = baseCellWidth - cellPadding.left - cellPadding.right;
  const contentHeight = baseCellHeight - cellPadding.top - cellPadding.bottom;

  // 离屏画布尺寸由字形测量上界决定（cell 只作最小尺寸），
  // 保证 cell 缩小不会在离屏边缘提前截断字形
  const extent = measureGlyphExtent({
    text: character,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    outline: options.outline,
  });
  const offscreenWidth = Math.max(baseCellWidth, extent.width);
  const offscreenHeight = Math.max(baseCellHeight, extent.height);

  const rendered = renderCharacterOnCanvas({
    ...options,
    text: character,
    contentWidth: offscreenWidth,
    contentHeight: offscreenHeight,
  });

  // 原尺寸（不做 object-fit 缩放）
  const renderSize = {
    width: rendered.sourceWidth,
    height: rendered.sourceHeight,
  };

  const position = calculateAlignment(
    renderSize.width,
    renderSize.height,
    contentWidth,
    contentHeight,
    options.alignment.horizontal,
    options.alignment.vertical,
  );

  const baseTargetX = cellPadding.left + position.x + charMargin.left;
  const baseTargetY = cellPadding.top + position.y + charMargin.top;

  drawCharacterToCanvas(
    rendered.canvas,
    targetCtx,
    rendered.sourceX,
    rendered.sourceY,
    rendered.sourceWidth,
    rendered.sourceHeight,
    targetX + baseTargetX * renderScale,
    targetY + baseTargetY * renderScale,
    renderSize.width * renderScale,
    renderSize.height * renderScale,
    pixelStyle,
  );
}

/**
 * 将字符渲染到目标位置（支持整体缩放）
 * 先按原始尺寸渲染，然后使用 drawImage 缩放到目标尺寸
 */
export function renderCharacterToCellScaled(
  character: string,
  targetCtx: CanvasRenderingContext2D,
  baseCellX: number,
  baseCellY: number,
  baseCellWidth: number,
  baseCellHeight: number,
  renderScale: number,
  charMargin: { top: number; right: number; bottom: number; left: number },
  cellPadding: { top: number; right: number; bottom: number; left: number },
  options: Omit<
    RenderCharacterOptions,
    "text" | "contentWidth" | "contentHeight"
  >,
  pixelStyle: boolean = false,
): void {
  // 目标尺寸（缩放后）
  const targetX = baseCellX * renderScale;
  const targetY = baseCellY * renderScale;

  // 内容区域
  const contentWidth = baseCellWidth - cellPadding.left - cellPadding.right;
  const contentHeight = baseCellHeight - cellPadding.top - cellPadding.bottom;

  // 离屏渲染（原始尺寸）
  const rendered = renderCharacterOnCanvas({
    ...options,
    text: character,
    contentWidth: baseCellWidth,
    contentHeight: baseCellHeight,
  });

  // 计算字符在 cell 内的位置（object-fit）
  const renderSize = calculateCharRenderSize(
    rendered.sourceWidth,
    rendered.sourceHeight,
    contentWidth,
    contentHeight,
  );

  const position = calculateAlignment(
    renderSize.width,
    renderSize.height,
    contentWidth,
    contentHeight,
    options.alignment.horizontal,
    options.alignment.vertical,
  );

  // 字符在原始 cell 内的位置
  const baseTargetX = cellPadding.left + position.x + charMargin.left;
  const baseTargetY = cellPadding.top + position.y + charMargin.top;

  // 缩放后绘制到目标位置
  drawCharacterToCanvas(
    rendered.canvas,
    targetCtx,
    rendered.sourceX,
    rendered.sourceY,
    rendered.sourceWidth,
    rendered.sourceHeight,
    targetX + baseTargetX * renderScale,
    targetY + baseTargetY * renderScale,
    renderSize.width * renderScale,
    renderSize.height * renderScale,
    pixelStyle,
  );
}
