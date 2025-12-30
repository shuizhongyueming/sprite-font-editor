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
 * @param userPadding 用户配置的 padding（会累加到检测到的 padding 上）
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
  console.log({ rowAlpha, colAlpha });

  // 找到透明行和透明列
  const transparentRows = findTransparentRegions(rowAlpha);
  const transparentCols = findTransparentRegions(colAlpha);

  console.log(
    `[GridDetector] 全图透明行: ${transparentRows.length}, 透明列: ${transparentCols.length}`,
  );

  let cellWidth = 0;
  let cellHeight = 0;
  if (transparentRows.length <= 1) {
    console.warn(
      "[GridDetector] Row 透明区域不足以推断网格，至少需要3条透明线",
    );
    return null;
  } else if (transparentRows.length === 2) {
    cellHeight = transparentRows[1].end - transparentRows[0].end;
  } else {
    // 计算单元格尺寸（不包含分隔线）
    // 使用第2、3条透明线计算，避免第1条可能包含 padding
    cellHeight = transparentRows[2].end - transparentRows[1].end;
  }

  if (transparentCols.length <= 1) {
    console.warn(
      "[GridDetector] Column 透明区域不足以推断网格，至少需要3条透明线",
    );
    return null;
  } else if (transparentCols.length === 2) {
    cellWidth = transparentCols[1].end - transparentCols[0].end;
  } else {
    cellWidth = transparentCols[2].end - transparentCols[1].end;
  }

  if (cellWidth <= 0 || cellHeight <= 0) {
    console.warn("[GridDetector] 计算出的单元格尺寸无效");
    return null;
  }

  // 判断第一个透明区域是否包含 padding
  // transparentRows[0].start === 0：顶部有透明区域，可能包含 padding
  // transparentRows[0].start > 0：文字贴顶，padding = 0
  const firstRowContainsPadding = transparentRows[0].start === 0;
  const firstColContainsPadding = transparentCols[0].start === 0;

  // 只检测 top 和 left（基于透明区域）
  const detectedPaddingTop = firstRowContainsPadding
    ? transparentRows[0].end + 1
    : 0;
  const detectedPaddingLeft = firstColContainsPadding
    ? transparentCols[0].end + 1
    : 0;

  // 最终 padding = 检测到的 + 用户设置的
  const padding = {
    top: detectedPaddingTop,
    left: detectedPaddingLeft,
    right: 0,
    bottom: 0,
  };

  console.log({
    cellWidth,
    cellHeight,
    detectedPaddingTop,
    detectedPaddingLeft,
    finalPadding: padding,
    firstRowContainsPadding,
    firstColContainsPadding,
    transparentCols,
    transparentRows,
  });

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
    `[GridDetector] 检测结果: 单元格=${cellWidth}x${cellHeight}, 网格=${rows}行×${cols}列, padding=(${padding.top}, ${padding.left}, ${padding.right}, ${padding.bottom}), 置信度=${(confidence * 100).toFixed(1)}%`,
  );

  // margin 设为 0，由用户自行调整
  const margin = { top: 0, right: 0, bottom: 0, left: 0 };

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
 * 检测网格结构（支持裁剪区域）
 * @param originalImage 原始图片
 * @param imageConfig 图片配置（包含 margin、padding 和 font sprite 尺寸）
 */
export function detectGridFast(
  originalImage: HTMLImageElement,
  imageConfig?: {
    margin: { top: number; right: number; bottom: number; left: number };
    padding?: { top: number; right: number; bottom: number; left: number };
    fontSpriteWidth?: number;
    fontSpriteHeight?: number;
  },
): GridDetectionResult | null {
  // 创建 canvas
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 计算裁剪区域
  const cropX = imageConfig?.margin.left || 0;
  const cropY = imageConfig?.margin.top || 0;

  // 确定裁剪区域的宽高
  let cropWidth = originalImage.width;
  let cropHeight = originalImage.height;

  if (imageConfig?.fontSpriteWidth && imageConfig?.fontSpriteHeight) {
    // 如果有明确的 font sprite 尺寸，使用该尺寸
    cropWidth = imageConfig.fontSpriteWidth;
    cropHeight = imageConfig.fontSpriteHeight;
  } else {
    // 否则使用原图尺寸减去 margin
    cropWidth =
      originalImage.width -
      (imageConfig?.margin.left || 0) -
      (imageConfig?.margin.right || 0);
    cropHeight =
      originalImage.height -
      (imageConfig?.margin.top || 0) -
      (imageConfig?.margin.bottom || 0);
  }

  console.log({ cropX, cropY, cropWidth, cropHeight });

  // 设置 canvas 尺寸为裁剪区域尺寸
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  // 裁剪并绘制图片
  ctx.drawImage(
    originalImage,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  // 在裁剪后的图片上检测网格，传入用户配置的 padding
  return detectGrid(canvas);
}
