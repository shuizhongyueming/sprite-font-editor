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
