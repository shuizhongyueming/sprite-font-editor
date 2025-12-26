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
  rows: number;
  cols: number;
  confidence: number; // 0-1，检测结果的置信度
}

/**
 * 计算数组的众数
 */
function getMode(arr: number[]): number {
  if (arr.length === 0) return 0
  const frequency: Record<number, number> = {}
  let maxFreq = 0
  let mode = arr[0]

  for (const value of arr) {
    frequency[value] = (frequency[value] || 0) + 1
    if (frequency[value] > maxFreq) {
      maxFreq = frequency[value]
      mode = value
    }
  }

  return mode
}

/**
 * 计算数组的统计信息
 */
function getStats(arr: number[]): { min: number; max: number; avg: number; std: number } {
  if (arr.length === 0) {
    return { min: 0, max: 0, avg: 0, std: 0 }
  }

  const sum = arr.reduce((a, b) => a + b, 0)
  const avg = sum / arr.length
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / arr.length
  const std = Math.sqrt(variance)

  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg,
    std,
  }
}

/**
 * 获取图片的 alpha 通道投影
 */
function getAlphaProjection(imageData: ImageData): {
  rowAlpha: number[];
  colAlpha: number[];
} {
  const { data, width, height } = imageData
  const rowAlpha = new Array(height).fill(0)
  const colAlpha = new Array(width).fill(0)

  // 计算每行/列的不透明像素数量
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 10) {
        // 不透明像素
        rowAlpha[y]++
        colAlpha[x]++
      }
    }
  }

  return { rowAlpha, colAlpha }
}

/**
 * 找到透明区域的起止位置
 * 透明行/列定义为：不透明像素数量小于阈值的行/列
 */
function findTransparentRegions(
  projection: number[],
  thresholdRatio: number = 0.02
): Array<{ start: number; end: number }> {
  const maxCount = Math.max(...projection)
  const threshold = maxCount * thresholdRatio

  const regions: Array<{ start: number; end: number }> = []
  let inTransparent = false
  let start = 0

  for (let i = 0; i < projection.length; i++) {
    const isTransparent = projection[i] <= threshold

    if (isTransparent && !inTransparent) {
      inTransparent = true
      start = i
    } else if (!isTransparent && inTransparent) {
      inTransparent = false
      regions.push({ start, end: i - 1 })
    }
  }

  // 处理结尾的透明区域
  if (inTransparent) {
    regions.push({ start, end: projection.length - 1 })
  }

  return regions
}

/**
 * 计算相邻分隔线的间距
 */
function calculateGaps(
  transparentRegions: Array<{ start: number; end: number }>
): number[] {
  if (transparentRegions.length < 2) return []

  const gaps: number[] = []

  for (let i = 1; i < transparentRegions.length; i++) {
    const prevEnd = transparentRegions[i - 1].end
    const currStart = transparentRegions[i].start
    gaps.push(currStart - prevEnd - 1)
  }

  return gaps
}

/**
 * 检测网格结构
 * @param canvas Canvas 元素
 * @param imageMargin 图片的外边距（用于排除边缘）
 * @param imagePadding 图片的内边距（用于排除边缘）
 * @returns 检测结果
 */
export function detectGrid(
  canvas: HTMLCanvasElement,
  imageMargin: { top: number; right: number; bottom: number; left: number },
  imagePadding: { top: number; right: number; bottom: number; left: number }
): GridDetectionResult | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const width = canvas.width
  const height = canvas.height

  // 获取图片数据
  const imageData = ctx.getImageData(0, 0, width, height)

  // 计算有效区域（排除 margin 和 padding）
  const startX = imageMargin.left + imagePadding.left
  const startY = imageMargin.top + imagePadding.top
  const endX = width - imageMargin.right - imagePadding.right
  const endY = height - imageMargin.bottom - imagePadding.bottom

  if (startX >= endX || startY >= endY) {
    console.warn('[GridDetector] 有效区域太小')
    return null
  }

  // 提取有效区域的投影数据
  const { rowAlpha, colAlpha } = getAlphaProjection(imageData)

  // 提取有效区域的子数组
  const validRowAlpha = rowAlpha.slice(startY, endY)
  const validColAlpha = colAlpha.slice(startX, endX)

  // 找到透明行和透明列
  const transparentRows = findTransparentRegions(validRowAlpha)
  const transparentCols = findTransparentRegions(validColAlpha)

  console.log(
    `[GridDetector] 找到 ${transparentRows.length} 条透明行，${transparentCols.length} 条透明列`
  )

  if (transparentRows.length < 2 || transparentCols.length < 2) {
    console.warn('[GridDetector] 透明区域不足以推断网格')
    return null
  }

  // 计算间距
  const rowGaps = calculateGaps(transparentRows)
  const colGaps = calculateGaps(transparentCols)

  if (rowGaps.length === 0 || colGaps.length === 0) {
    console.warn('[GridDetector] 无法计算间距')
    return null
  }

  // 取众数作为标准间距
  const rowGap = getMode(rowGaps)
  const colGap = getMode(colGaps)

  // 计算统计信息
  const rowStats = getStats(rowGaps)
  const colStats = getStats(colGaps)

  // 计算置信度（基于标准差）
  const rowConfidence = rowStats.std < rowGap * 0.3 ? 1 : Math.max(0.5, 1 - rowStats.std / rowGap)
  const colConfidence = colStats.std < colGap * 0.3 ? 1 : Math.max(0.5, 1 - colStats.std / colGap)
  const confidence = (rowConfidence + colConfidence) / 2

  console.log(
    `[GridDetector] 行间距: ${rowGap} (std: ${rowStats.std.toFixed(2)}), 列间距: ${colGap} (std: ${colStats.std.toFixed(2)})`
  )
  console.log(`[GridDetector] 置信度: ${(confidence * 100).toFixed(1)}%`)

  // 计算单元格尺寸
  // 单元格尺寸 = (两行之间的总像素 - 间距) / 1
  // 因为我们假设 margin 和 padding 都体现在间距中
  const cellHeight = transparentRows[1].start - transparentRows[0].start - rowGap
  const cellWidth = transparentCols[1].start - transparentCols[0].start - colGap

  if (cellWidth <= 0 || cellHeight <= 0) {
    console.warn('[GridDetector] 计算出的单元格尺寸无效')
    return null
  }

  // 计算行数和列数
  const rows = transparentRows.length + 1
  const cols = transparentCols.length + 1

  console.log(
    `[GridDetector] 单元格尺寸: ${cellWidth}x${cellHeight}, 网格: ${rows}行 × ${cols}列`
  )

  // 估算 margin（假设均匀分布）
  const margin = Math.max(0, Math.round(rowGap / 2))

  return {
    cellWidth,
    cellHeight,
    margin: { top: margin, right: margin, bottom: margin, left: margin },
    rows,
    cols,
    confidence,
  }
}

/**
 * 对图片进行降采样（使用最近邻插值）
 */
function downsampleImage(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  const srcWidth = imageData.width
  const srcHeight = imageData.height
  const srcData = imageData.data
  const dstData = new Uint8ClampedArray(targetWidth * targetHeight * 4)

  const xRatio = srcWidth / targetWidth
  const yRatio = srcHeight / targetHeight

  for (let dy = 0; dy < targetHeight; dy++) {
    for (let dx = 0; dx < targetWidth; dx++) {
      const sx = Math.floor(dx * xRatio)
      const sy = Math.floor(dy * yRatio)

      const srcIndex = (sy * srcWidth + sx) * 4
      const dstIndex = (dy * targetWidth + dx) * 4

      dstData[dstIndex] = srcData[srcIndex]
      dstData[dstIndex + 1] = srcData[srcIndex + 1]
      dstData[dstIndex + 2] = srcData[srcIndex + 2]
      dstData[dstIndex + 3] = srcData[srcIndex + 3]
    }
  }

  return new ImageData(dstData, targetWidth, targetHeight)
}

/**
 * 快速检测网格（使用降采样）
 * 适用于大图片，可以提高检测速度
 */
export function detectGridFast(
  canvas: HTMLCanvasElement,
  imageMargin: { top: number; right: number; bottom: number; left: number },
  imagePadding: { top: number; right: number; bottom: number; left: number },
  maxDimension: number = 500
): GridDetectionResult | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const width = canvas.width
  const height = canvas.height

  // 如果图片已经足够小，直接检测
  if (width <= maxDimension && height <= maxDimension) {
    return detectGrid(canvas, imageMargin, imagePadding)
  }

  // 计算降采样比例
  const scale = Math.min(maxDimension / width, maxDimension / height)
  const newWidth = Math.floor(width * scale)
  const newHeight = Math.floor(height * scale)

  console.log(`[GridDetector] 降采样: ${width}x${height} -> ${newWidth}x${newHeight}`)

  // 创建临时 canvas 进行降采样
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = newWidth
  tempCanvas.height = newHeight
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return null

  tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight)
  const scaledImageData = tempCtx.getImageData(0, 0, newWidth, newHeight)

  // 调整 margin 和 padding（按比例缩放）
  const scaledMargin = {
    top: Math.round(imageMargin.top * scale),
    right: Math.round(imageMargin.right * scale),
    bottom: Math.round(imageMargin.bottom * scale),
    left: Math.round(imageMargin.left * scale),
  }
  const scaledPadding = {
    top: Math.round(imagePadding.top * scale),
    right: Math.round(imagePadding.right * scale),
    bottom: Math.round(imagePadding.bottom * scale),
    left: Math.round(imagePadding.left * scale),
  }

  // 在降采样后的图片上检测
  const result = detectGrid(tempCanvas, scaledMargin, scaledPadding)

  if (!result) return null

  // 将结果放大回原始尺寸
  const invScale = 1 / scale
  return {
    cellWidth: Math.round(result.cellWidth * invScale),
    cellHeight: Math.round(result.cellHeight * invScale),
    margin: {
      top: Math.round(result.margin.top * invScale),
      right: Math.round(result.margin.right * invScale),
      bottom: Math.round(result.margin.bottom * invScale),
      left: Math.round(result.margin.left * invScale),
    },
    rows: result.rows,
    cols: result.cols,
    confidence: result.confidence,
  }
}
