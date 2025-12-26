/**
 * 网格自动检测工具
 *
 * 算法思路：
 * 1. 对图片的每一行/列计算不透明像素的投影
 * 2. 找到透明区域（波谷）作为分隔线
 * 3. 计算间距的众数，反推单元格尺寸
 */

export interface GridDetectionResult {
  cellWidth: number;
  cellHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
  rows: number;
  cols: number;
  confidence: number; // 0-1，检测结果的置信度
}

/**
 * 计算数组的众数
 */
function getMode(arr: number[]): number {
  if (arr.length === 0) return 0;
  const frequency: Record<number, number> = {};
  let maxFreq = 0;
  let mode = arr[0];

  for (const value of arr) {
    frequency[value] = (frequency[value] || 0) + 1;
    if (frequency[value] > maxFreq) {
      maxFreq = frequency[value];
      mode = value;
    }
  }

  return mode;
}

/**
 * 计算数组的统计信息
 */
function getStats(arr: number[]): {
  min: number;
  max: number;
  avg: number;
  std: number;
} {
  if (arr.length === 0) {
    return { min: 0, max: 0, avg: 0, std: 0 };
  }

  const sum = arr.reduce((a, b) => a + b, 0);
  const avg = sum / arr.length;
  const variance =
    arr.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / arr.length;
  const std = Math.sqrt(variance);

  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg,
    std,
  };
}

/**
 * 获取图片的 alpha 通道投影
 */
function getAlphaProjection(imageData: ImageData): {
  rowAlpha: number[];
  colAlpha: number[];
} {
  const { data, width, height } = imageData;
  const rowAlpha = new Array(height).fill(0);
  const colAlpha = new Array(width).fill(0);

  // 计算每行/列的不透明像素数量
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        // 不透明像素
        rowAlpha[y]++;
        colAlpha[x]++;
      }
    }
  }

  return { rowAlpha, colAlpha };
}

/**
 * 找到透明区域的起止位置
 * 透明行/列定义为：不透明像素数量小于阈值的行/列
 */
function findTransparentRegions(
  projection: number[],
  thresholdRatio: number = 0.02,
): Array<{ start: number; end: number }> {
  const maxCount = Math.max(...projection);
  const threshold = maxCount * thresholdRatio;

  const regions: Array<{ start: number; end: number }> = [];
  let inTransparent = false;
  let start = 0;

  for (let i = 0; i < projection.length; i++) {
    const isTransparent = projection[i] <= threshold;

    if (isTransparent && !inTransparent) {
      inTransparent = true;
      start = i;
    } else if (!isTransparent && inTransparent) {
      inTransparent = false;
      regions.push({ start, end: i - 1 });
    }
  }

  // 处理结尾的透明区域
  if (inTransparent) {
    regions.push({ start, end: projection.length - 1 });
  }

  return regions;
}

/**
 * 计算相邻分隔线的间距
 */
function calculateGaps(
  transparentRegions: Array<{ start: number; end: number }>,
): number[] {
  if (transparentRegions.length < 2) return [];

  const gaps: number[] = [];

  for (let i = 1; i < transparentRegions.length; i++) {
    const prevEnd = transparentRegions[i - 1].end;
    const currStart = transparentRegions[i].start;
    gaps.push(currStart - prevEnd - 1);
  }

  return gaps;
}

/**
 * 检测网格结构
 *
 * 算法思路：
 * 1. 在全图范围内检测透明行/列（不使用 margin/padding 排除区域）
 * 2. 第一条透明线的起始位置 = 图片的 padding
 * 3. 第二条透明线的起始位置 - 第一条透明线的起始位置 = 单元格尺寸
 *
 * @param canvas Canvas 元素
 * @returns 检测结果
 */
export function detectGrid(
  canvas: HTMLCanvasElement,
): GridDetectionResult | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;

  // 获取图片数据
  const imageData = ctx.getImageData(0, 0, width, height);

  // 计算全图的投影
  const { rowAlpha, colAlpha } = getAlphaProjection(imageData);

  // 找到透明行和透明列
  const transparentRows = findTransparentRegions(rowAlpha);
  const transparentCols = findTransparentRegions(colAlpha);

  console.log(
    `[GridDetector] 全图透明行: ${transparentRows.length}, 透明列: ${transparentCols.length}`,
  );

  if (transparentRows.length < 2 || transparentCols.length < 2) {
    console.warn("[GridDetector] 透明区域不足以推断网格");
    return null;
  }

  // 第一条透明线的起始位置 = 图片的 padding
  const paddingTop = transparentRows[0].start;
  const paddingLeft = transparentCols[0].start;

  // 单元格尺寸 = 第二条透明线起始位置 - 第一条透明线起始位置
  const cellHeight = transparentRows[1].start - transparentRows[0].start;
  const cellWidth = transparentCols[1].start - transparentCols[0].start;

  if (cellWidth <= 0 || cellHeight <= 0) {
    console.warn("[GridDetector] 计算出的单元格尺寸无效");
    return null;
  }

  // 计算行数和列数
  const rows = transparentRows.length + 1;
  const cols = transparentCols.length + 1;

  // 计算间距（用于置信度评估）
  const rowGaps = calculateGaps(transparentRows);
  const colGaps = calculateGaps(transparentCols);

  // 计算置信度
  let confidence = 1;
  if (rowGaps.length > 0) {
    const rowGap = getMode(rowGaps);
    const rowStats = getStats(rowGaps);
    const rowConfidence =
      rowStats.std < rowGap * 0.3
        ? 1
        : Math.max(0.5, 1 - rowStats.std / rowGap);
    confidence *= rowConfidence;
  }
  if (colGaps.length > 0) {
    const colGap = getMode(colGaps);
    const colStats = getStats(colGaps);
    const colConfidence =
      colStats.std < colGap * 0.3
        ? 1
        : Math.max(0.5, 1 - colStats.std / colGap);
    confidence *= colConfidence;
  }

  console.log(
    `[GridDetector] 检测结果: 单元格=${cellWidth}x${cellHeight}, 网格=${rows}行×${cols}列, padding=(${paddingTop}, ${paddingLeft}), 置信度=${(confidence * 100).toFixed(1)}%`,
  );

  // margin 设为 0，由用户自行调整
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };
  // padding 直接使用检测到的值
  const padding = {
    top: paddingTop,
    right: paddingTop,
    bottom: paddingTop,
    left: paddingLeft,
  };

  return {
    cellWidth,
    cellHeight,
    margin,
    padding,
    rows,
    cols,
    confidence,
  };
}

/**
 * 对图片进行降采样（使用最近邻插值）
 */
function downsampleImage(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number,
): ImageData {
  const srcWidth = imageData.width;
  const srcHeight = imageData.height;
  const srcData = imageData.data;
  const dstData = new Uint8ClampedArray(targetWidth * targetHeight * 4);

  const xRatio = srcWidth / targetWidth;
  const yRatio = srcHeight / targetHeight;

  for (let dy = 0; dy < targetHeight; dy++) {
    for (let dx = 0; dx < targetWidth; dx++) {
      const sx = Math.floor(dx * xRatio);
      const sy = Math.floor(dy * yRatio);

      const srcIndex = (sy * srcWidth + sx) * 4;
      const dstIndex = (dy * targetWidth + dx) * 4;

      dstData[dstIndex] = srcData[srcIndex];
      dstData[dstIndex + 1] = srcData[srcIndex + 1];
      dstData[dstIndex + 2] = srcData[srcIndex + 2];
      dstData[dstIndex + 3] = srcData[srcIndex + 3];
    }
  }

  return new ImageData(dstData, targetWidth, targetHeight);
}

/**
 * 快速检测网格（使用降采样）
 * 适用于大图片，可以提高检测速度
 */
export function detectGridFast(
  canvas: HTMLCanvasElement,
  maxDimension: number = 500,
): GridDetectionResult | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;

  // 如果图片已经足够小，直接检测
  if (width <= maxDimension && height <= maxDimension) {
    return detectGrid(canvas);
  }

  // 计算降采样比例
  const scale = Math.min(maxDimension / width, maxDimension / height);
  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);

  console.log(
    `[GridDetector] 降采样: ${width}x${height} -> ${newWidth}x${newHeight}`,
  );

  // 创建临时 canvas 进行降采样
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = newWidth;
  tempCanvas.height = newHeight;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return null;

  tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

  // 在降采样后的图片上检测
  const result = detectGrid(tempCanvas);

  if (!result) return null;

  // 将结果放大回原始尺寸
  const invScale = 1 / scale;
  return {
    cellWidth: Math.round(result.cellWidth * invScale),
    cellHeight: Math.round(result.cellHeight * invScale),
    margin: {
      top: Math.round(result.margin.top * invScale),
      right: Math.round(result.margin.right * invScale),
      bottom: Math.round(result.margin.bottom * invScale),
      left: Math.round(result.margin.left * invScale),
    },
    padding: {
      top: Math.round(result.padding.top * invScale),
      right: Math.round(result.padding.right * invScale),
      bottom: Math.round(result.padding.bottom * invScale),
      left: Math.round(result.padding.left * invScale),
    },
    rows: result.rows,
    cols: result.cols,
    confidence: result.confidence,
  };
}
