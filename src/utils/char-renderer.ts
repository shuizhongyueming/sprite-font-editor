/**
 * 字符渲染工具
 * 提供离屏 Canvas 字符渲染功能
 */

export interface RenderCharacterOptions {
  text: string
  fontFamily: string
  fontSize: number
  color: string
  outline?: {
    enabled: boolean
    color: string
    width: number
  }
  cellWidth: number
  cellHeight: number
  alignment: {
    horizontal: 'left' | 'center' | 'right'
    vertical: 'top' | 'middle' | 'bottom'
  }
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

/**
 * 计算字符渲染位置和尺寸（object-fit 逻辑）
 */
export function calculateCharRenderSize(
  textWidth: number,
  textHeight: number,
  cellWidth: number,
  cellHeight: number,
  margin: { top: number; right: number; bottom: number; left: number }
): { x: number; y: number; width: number; height: number } {
  // 考虑 margin 后的可用空间
  const availableWidth = cellWidth - margin.left - margin.right
  const availableHeight = cellHeight - margin.top - margin.bottom

  if (availableWidth <= 0 || availableHeight <= 0) {
    return { x: margin.left, y: margin.top, width: 0, height: 0 }
  }

  // 计算缩放比例（保持宽高比）
  const widthRatio = availableWidth / textWidth
  const heightRatio = availableHeight / textHeight
  const scale = Math.min(widthRatio, heightRatio)

  // 计算渲染尺寸
  const renderWidth = textWidth * scale
  const renderHeight = textHeight * scale

  return {
    width: renderWidth,
    height: renderHeight,
    x: margin.left,
    y: margin.top
  }
}

/**
 * 计算对齐位置
 */
export function calculateAlignment(
  x: number,
  y: number,
  renderWidth: number,
  renderHeight: number,
  availableWidth: number,
  availableHeight: number,
  horizontalAlign: 'left' | 'center' | 'right',
  verticalAlign: 'top' | 'middle' | 'bottom'
): { x: number; y: number } {
  let alignedX = x
  let alignedY = y

  // 水平对齐
  switch (horizontalAlign) {
    case 'center':
      alignedX = x + (availableWidth - renderWidth) / 2
      break
    case 'right':
      alignedX = x + availableWidth - renderWidth
      break
    case 'left':
    default:
      alignedX = x
      break
  }

  // 垂直对齐
  switch (verticalAlign) {
    case 'middle':
      alignedY = y + (availableHeight - renderHeight) / 2
      break
    case 'bottom':
      alignedY = y + availableHeight - renderHeight
      break
    case 'top':
    default:
      alignedY = y
      break
  }

  return { x: alignedX, y: alignedY }
}

/**
 * 测量文本尺寸
 */
export function measureText(
  text: string,
  font: string,
  canvas: HTMLCanvasElement = document.createElement('canvas')
): { width: number; height: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { width: 0, height: 0 }

  ctx.font = font

  // 测量文本宽度
  const metrics = ctx.measureText(text)
  const width = metrics.width

  // 估算文本高度（实际字体高度）
  // 使用 measureText 的 fontBoundingBoxAscent 和 fontBoundingBoxDescent（如果支持）
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent ?? 0
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent ?? 0
  const height = ascent + descent || parseInt(font) || 16

  return { width, height }
}

/**
 * 在离屏 Canvas 上渲染字符
 */
export function renderCharacterOnCanvas(
  options: RenderCharacterOptions
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  // 设置 Canvas 尺寸为单元格尺寸
  canvas.width = options.cellWidth
  canvas.height = options.cellHeight

  // 避免透明区域渲染问题
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 设置字体
  const font = `${options.fontSize}px ${options.fontFamily}`
  ctx.font = font
  ctx.textBaseline = 'top'
  ctx.imageSmoothingEnabled = true

  // 测量文本
  const textMetrics = measureText(options.text, font, canvas)

  // 计算渲染尺寸（object-fit 逻辑）
  const renderSize = calculateCharRenderSize(
    textMetrics.width,
    textMetrics.height,
    options.cellWidth,
    options.cellHeight,
    options.margin
  )

  // 计算对齐位置
  const availableWidth = options.cellWidth - options.margin.left - options.margin.right
  const availableHeight = options.cellHeight - options.margin.top - options.margin.bottom

  const position = calculateAlignment(
    renderSize.x,
    renderSize.y,
    renderSize.width,
    renderSize.height,
    availableWidth,
    availableHeight,
    options.alignment.horizontal,
    options.alignment.vertical
  )

  // 如果有描边
  if (options.outline?.enabled) {
    ctx.strokeStyle = options.outline.color
    ctx.lineWidth = options.outline.width
    ctx.lineJoin = 'round'

    // 描边文本
    ctx.strokeText(options.text, position.x, position.y)
  }

  // 填充文本
  ctx.fillStyle = options.color
  ctx.fillText(options.text, position.x, position.y)

  return canvas
}

/**
 * 将离屏 Canvas 绘制到目标 Canvas
 */
export function drawCharacterToCanvas(
  charCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  if (!charCanvas || !targetCtx) return

  targetCtx.drawImage(charCanvas, x, y, width, height)
}

/**
 * 批量渲染多个字符
 */
export function renderCharacters(
  characters: string[],
  startIndex: number,
  options: Omit<RenderCharacterOptions, 'text'>
): HTMLCanvasElement[] {
  const canvases: HTMLCanvasElement[] = []
  const remainingChars = characters.slice(startIndex)

  for (const char of remainingChars) {
    const canvas = renderCharacterOnCanvas({
      ...options,
      text: char
    })
    canvases.push(canvas)
  }

  return canvases
}

/**
 * 将字符 Canvas 渲染到目标位置（考虑 cell margin）
 * 修改说明：字符渲染时使用完整的 cell 尺寸，margin 只参与定位调整
 */
export function renderCharacterToCell(
  character: string,
  targetCtx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  charMargin: { top: number; right: number; bottom: number; left: number },
  options: Omit<RenderCharacterOptions, 'text' | 'cellWidth' | 'cellHeight' | 'margin'>
): void {
  // 步骤 1: 在完整的 cell 尺寸内渲染字符（margin 不参与渲染尺寸计算）
  const charCanvas = renderCharacterOnCanvas({
    ...options,
    text: character,
    cellWidth: cellWidth,      // 不减去 margin
    cellHeight: cellHeight,     // 不减去 margin
    margin: { top: 0, right: 0, bottom: 0, left: 0 } // 渲染时忽略 margin
  })

  // 步骤 2: 通过 margin 调整字符在单元格内的位置（只改位置，不改尺寸）
  const targetX = cellX + charMargin.left
  const targetY = cellY + charMargin.top
  const targetWidth = cellWidth     // ✅ 保持完整尺寸，不减 margin
  const targetHeight = cellHeight   // ✅ 保持完整尺寸，不减 margin

  // 步骤 3: 将渲染好的字符绘制到目标位置
  drawCharacterToCanvas(
    charCanvas,
    targetCtx,
    targetX,
    targetY,
    targetWidth,
    targetHeight
  )
}
