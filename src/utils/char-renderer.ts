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

  // 全扫描（Canvas 通常不大，性能可接受）
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
 * 在离屏 Canvas 上渲染字符
 * 修改说明：cellPadding 参与尺寸计算，margin 只影响定位
 */
export function renderCharacterOnCanvas(
  options: RenderCharacterOptions,
): RenderedCharacter {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  // 设置 Canvas 尺寸为单元格内的内容尺寸
  canvas.width = options.contentWidth;
  canvas.height = options.contentHeight;

  // 避免透明区域渲染问题
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 设置字体
  const font = `${options.fontSize}px ${options.fontFamily}`;
  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.imageSmoothingEnabled = true;

  // 默认做一些偏移量去渲染文本
  // 有些文本，在某些字体下，可能是会有一些溢出的
  let drawX = 2;
  let drawY = 2;

  // 如果有描边
  if (options.outline?.enabled) {
    ctx.strokeStyle = options.outline.color;
    ctx.lineWidth = options.outline.width;
    ctx.lineJoin = "round";

    // 有描边的实话，开始绘制的节点需要考虑到描边的宽度
    // 如果还是紧贴左上角绘制，会导致左边和顶部的描边被裁剪掉
    drawX += options.outline.width;
    drawY += options.outline.width;

    // 描边文本
    ctx.strokeText(options.text, drawX, drawX);
  }

  // 填充文本
  ctx.fillStyle = options.color;
  ctx.fillText(options.text, drawX, drawY);

  // ============ 新增扫描逻辑 ============
  // 在文本绘制完成后，扫描确定文本边界
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = scanTextBoundsOptimized(
    canvas.width,
    canvas.height,
    imageData,
  );

  // 返回 canvas 和边界信息
  return {
    canvas,
    sourceX: bounds.x,
    sourceY: bounds.y,
    sourceWidth: bounds.width,
    sourceHeight: bounds.height,
  };
}

/**
 * 将离屏 Canvas 绘制到目标 Canvas
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
): void {
  if (!charCanvas || !targetCtx) return;

  targetCtx.drawImage(charCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * 批量渲染多个字符
 */
export function renderCharacters(
  characters: string[],
  startIndex: number,
  options: Omit<RenderCharacterOptions, "text">,
): RenderedCharacter[] {
  const results: RenderedCharacter[] = [];
  const remainingChars = characters.slice(startIndex);

  for (const char of remainingChars) {
    const rendered = renderCharacterOnCanvas({
      ...options,
      text: char,
    });
    results.push(rendered);
  }

  return results;
}

/**
 * 将字符 Canvas 渲染到目标位置（考虑 cell margin 和 cell padding）
 * 修改说明：
 * 1. cellPadding 参与内容区域尺寸计算
 * 2. margin 只参与定位调整
 * 3. 离屏 Canvas 使用完整 cell 尺寸
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
): void {
  // 计算内容区域尺寸（减去 cell padding）
  const contentWidth = cellWidth - cellPadding.left - cellPadding.right;
  const contentHeight = cellHeight - cellPadding.top - cellPadding.bottom;

  // 步骤 1: 离屏渲染字符，获取 canvas 和真实边界
  const rendered = renderCharacterOnCanvas({
    ...options,
    text: character,
    contentWidth: cellWidth, // 完整尺寸
    contentHeight: cellHeight, // 完整尺寸
  });

  // 基于真实文本尺寸计算缩放（object-fit）
  const renderSize = calculateCharRenderSize(
    rendered.sourceWidth, // ✅ 使用实际文本宽度
    rendered.sourceHeight, // ✅ 使用实际文本高度
    contentWidth,
    contentHeight,
  );

  // 在 content 内，基于 alignment 计算偏移
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
  const targetWidth = renderSize.width;
  const targetHeight = renderSize.height;

  if (character === "你") {
    console.log({
      cellWidth,
      cellHeight,
      sourceX: rendered.sourceX,
      sourceY: rendered.sourceY,
      sourceWidth: rendered.sourceWidth,
      sourceHeight: rendered.sourceHeight,
      contentWidth,
      contentHeight,
      targetWidth,
      targetHeight,
      scale: renderSize.scale,
    });
  }

  // 步骤 3: 将渲染好的字符绘制到目标位置
  drawCharacterToCanvas(
    rendered.canvas,
    targetCtx,
    rendered.sourceX,
    rendered.sourceY,
    rendered.sourceWidth,
    rendered.sourceHeight,
    targetX,
    targetY,
    targetWidth,
    targetHeight,
  );
}
