/**
 * Canvas 工具函数
 */

/**
 * 获取设备像素比
 */
export function getDevicePixelRatio(): number {
  return window.devicePixelRatio || 1
}

/**
 * 设置 Canvas 的高 DPI 支持
 */
export function setupHiDPI(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = getDevicePixelRatio()
  
  // 设置 CSS 尺寸
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  
  // 设置实际像素尺寸
  canvas.width = width * dpr
  canvas.height = height * dpr
  
  // 缩放上下文
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
  }
}

/**
 * 清除 Canvas
 */
export function clearCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

/**
 * 在 Canvas 上绘制图片
 */
export function drawImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  x: number = 0,
  y: number = 0,
  width?: number,
  height?: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = getDevicePixelRatio()
  const actualX = x * dpr
  const actualY = y * dpr
  const actualWidth = width ? width * dpr : image.width * dpr
  const actualHeight = height ? height * dpr : image.height * dpr

  ctx.drawImage(image, actualX, actualY, actualWidth, actualHeight)
}

/**
 * 检测单元格是否为空（基于透明度）
 */
export function isCellEmpty(
  imageData: ImageData,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  threshold: number = 10
): boolean {
  const { data, width } = imageData
  
  for (let y = cellY; y < cellY + cellHeight; y++) {
    for (let x = cellX; x < cellX + cellWidth; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > threshold) return false
    }
  }
  return true
}

/**
 * 获取图片数据
 */
export function getImageData(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): ImageData | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  
  const dpr = getDevicePixelRatio()
  return ctx.getImageData(x * dpr, y * dpr, width * dpr, height * dpr)
}

/**
 * Canvas 坐标转换工具
 */
export class CanvasSpace {
  constructor(
    private canvasWidth: number,
    private canvasHeight: number,
    private cellWidth: number,
    private cellHeight: number,
    private cellMargin: { top: number; right: number; bottom: number; left: number },
    private imageMargin: { top: number; right: number; bottom: number; left: number },
    private imagePadding: { top: number; right: number; bottom: number; left: number },
    private fontSpriteWidth?: number,
    private fontSpriteHeight?: number
  ) {}

  /**
   * 获取可用宽度
   */
  get usableWidth(): number {
    const baseWidth = this.canvasWidth - this.imagePadding.left - this.imagePadding.right;
    if (!this.fontSpriteWidth) return baseWidth;
    return Math.min(baseWidth, this.fontSpriteWidth - this.imagePadding.left - this.imagePadding.right);
  }

  /**
   * 获取可用高度
   */
  get usableHeight(): number {
    const baseHeight = this.canvasHeight - this.imagePadding.top - this.imagePadding.bottom;
    if (!this.fontSpriteHeight) return baseHeight;
    return Math.min(baseHeight, this.fontSpriteHeight - this.imagePadding.top - this.imagePadding.bottom);
  }

  /**
   * 计算列数
   */
  get columns(): number {
    const cellTotalWidth = this.cellWidth + this.cellMargin.left + this.cellMargin.right;
    const startOffset = this.imageMargin.left + this.imagePadding.left;
    const availableWidth = this.usableWidth - startOffset;
    if (availableWidth < cellTotalWidth) return 0;
    return Math.floor((availableWidth - this.cellWidth) / cellTotalWidth) + 1;
  }

  /**
   * 计算行数
   */
  get rows(): number {
    const cellTotalHeight = this.cellHeight + this.cellMargin.top + this.cellMargin.bottom;
    const startOffset = this.imageMargin.top + this.imagePadding.top;
    const availableHeight = this.usableHeight - startOffset;
    if (availableHeight < cellTotalHeight) return 0;
    return Math.floor((availableHeight - this.cellHeight) / cellTotalHeight) + 1;
  }

  /**
   * 单元格索引转换为行列
   */
  indexToRowCol(index: number): { row: number; col: number } {
    const cols = this.columns
    return {
      row: Math.floor(index / cols),
      col: index % cols,
    }
  }

  /**
   * 行列转换为单元格索引
   */
  rowColToIndex(row: number, col: number): number {
    return row * this.columns + col
  }

  /**
   * 获取单元格的像素坐标
   */
  getCellPosition(row: number, col: number): { x: number; y: number } {
    const cellTotalWidth = this.cellWidth + this.cellMargin.left + this.cellMargin.right
    const cellTotalHeight = this.cellHeight + this.cellMargin.top + this.cellMargin.bottom
    
    return {
      x: this.imageMargin.left + this.imagePadding.left + col * cellTotalWidth,
      y: this.imageMargin.top + this.imagePadding.top + row * cellTotalHeight,
    }
  }

  /**
   * 检查坐标是否在有效范围内
   */
  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.canvasWidth && y < this.canvasHeight
  }

  /**
   * 获取单元格边界（包含 margin）
   */
  getCellBounds(row: number, col: number): { x: number; y: number; width: number; height: number } {
    const position = this.getCellPosition(row, col)
    const totalWidth = this.cellWidth + this.cellMargin.left + this.cellMargin.right
    const totalHeight = this.cellHeight + this.cellMargin.top + this.cellMargin.bottom
    
    return {
      x: position.x - this.cellMargin.left,
      y: position.y - this.cellMargin.top,
      width: totalWidth,
      height: totalHeight,
    }
  }

  /**
   * 画布坐标转换到单元格
   */
  positionToCell(x: number, y: number): { row: number; col: number } | null {
    const offsetX = x - this.imageMargin.left - this.imagePadding.left
    const offsetY = y - this.imageMargin.top - this.imagePadding.top
    
    const cellTotalWidth = this.cellWidth + this.cellMargin.left + this.cellMargin.right
    const cellTotalHeight = this.cellHeight + this.cellMargin.top + this.cellMargin.bottom
    
    if (offsetX < 0 || offsetY < 0) return null
    
    const col = Math.floor(offsetX / cellTotalWidth)
    const row = Math.floor(offsetY / cellTotalHeight)
    
    if (row >= 0 && col >= 0 && row < this.rows && col < this.columns) {
      return { row, col }
    }
    
    return null
  }

  /**
   * 获取所有单元格的中心点坐标（用于插入点检测）
   */
  getAllCellCenters(): Array<{ row: number; col: number; x: number; y: number }> {
    const centers = []
    
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const position = this.getCellPosition(row, col)
        centers.push({
          row,
          col,
          x: position.x + this.cellWidth / 2,
          y: position.y + this.cellHeight / 2,
        })
      }
    }
    
    return centers
  }

}