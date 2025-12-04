import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ImageConfig {
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  width?: number
  height?: number
}

export interface CellConfig {
  width: number
  height: number
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
  padding: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface CellAlignmentConfig {
  horizontal: 'left' | 'center' | 'right'
  vertical: 'top' | 'middle' | 'bottom'
}

export interface GlobalCharacterStyle {
  fontFamily: string
  fontSize: number
  color: string
  outline: {
    enabled: boolean
    color: string
    width: number
  }
}

export interface CharacterEntry {
  char: string
  margin: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

export interface InsertPointConfig {
  mode: 'auto' | 'manual'
  startCellIndex?: number
}

export const useEditorStore = defineStore('editor', () => {
  // 图片配置
  const imageConfig = ref<ImageConfig>({
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  })

  // Cell 配置
  const cellConfig = ref<CellConfig>({
    width: 32,
    height: 32,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 2, right: 2, bottom: 2, left: 2 },
  })

  // 网格显示配置
  const gridConfig = ref({
    enabled: true,
    cellBorder: true,
    cellBorderColor: 'rgba(0, 255, 0, 0.5)',
    cellBorderWidth: 1,
    marginLines: false,
    marginLineColor: 'rgba(255, 0, 0, 0.3)',
    paddingLines: false,
    paddingLineColor: 'rgba(0, 0, 255, 0.3)',
  })

  // 对齐配置
  const cellAlignment = ref<CellAlignmentConfig>({
    horizontal: 'center',
    vertical: 'middle',
  })

  // 字符样式
  const characterStyle = ref<GlobalCharacterStyle>({
    fontFamily: 'Arial',
    fontSize: 16,
    color: '#000000',
    outline: {
      enabled: false,
      color: '#ffffff',
      width: 1,
    },
  })

  // 插入点配置
  const insertPointConfig = ref<InsertPointConfig>({
    mode: 'auto',
    startCellIndex: 0,
  })

  // 字符输入
  const characterEntries = ref<CharacterEntry[]>([])

  // Canvas 和底图相关
  const baseImage = ref<HTMLImageElement | null>(null)
  const originalImageWidth = ref(0)
  const originalImageHeight = ref(0)
  const displayedCanvasWidth = ref(0)
  const displayedCanvasHeight = ref(0)
  const canvasScale = ref(1)
  const maxCanvasWidth = ref(1000)
  const maxCanvasHeight = ref(700)
  const currentFont = ref<FontFace | null>(null)

  // 插入点检测结果
  const detectedInsertPoints = ref<number[]>([])
  const currentInsertPoint = ref<number>(0)

  // 设置底图
  function setBaseImage(image: HTMLImageElement) {
    baseImage.value = image
    originalImageWidth.value = image.width
    originalImageHeight.value = image.height
    
    // 计算缩放比例以适应最大尺寸限制
    let scale = 1
    const widthRatio = maxCanvasWidth.value / image.width
    const heightRatio = maxCanvasHeight.value / image.height
    
    // 如果图片超过最大尺寸限制，则按比例缩放
    if (image.width > maxCanvasWidth.value || image.height > maxCanvasHeight.value) {
      scale = Math.min(widthRatio, heightRatio)
    }
    
    canvasScale.value = scale
    displayedCanvasWidth.value = Math.floor(image.width * scale)
    displayedCanvasHeight.value = Math.floor(image.height * scale)
  }

  // 设置字体
  function setFont(font: FontFace) {
    currentFont.value = font
    characterStyle.value.fontFamily = font.family
  }

  // 更新字符输入
  function updateCharacters(input: string) {
    characterEntries.value = [...input].map(char => ({
      char,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }))
  }

  // 检测插入点（基于透明度）
  function detectInsertPoints(canvas: HTMLCanvasElement) {
    if (!baseImage.value) {
      detectedInsertPoints.value = []
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      detectedInsertPoints.value = []
      return
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const emptyCells: number[] = []

    // 根据当前配置检测所有单元格
    const cellTotalWidth = cellConfig.value.width + cellConfig.value.margin.left + cellConfig.value.margin.right
    const cellTotalHeight = cellConfig.value.height + cellConfig.value.margin.top + cellConfig.value.margin.bottom
    
    const startX = imageConfig.value.margin.left + imageConfig.value.padding.left
    const startY = imageConfig.value.margin.top + imageConfig.value.padding.top
    
    const cols = Math.floor((displayedCanvasWidth.value - imageConfig.value.padding.left - imageConfig.value.padding.right) / cellTotalWidth)
    const rows = Math.floor((displayedCanvasHeight.value - imageConfig.value.padding.top - imageConfig.value.padding.bottom) / cellTotalHeight)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellX = startX + col * cellTotalWidth + cellConfig.value.margin.left
        const cellY = startY + row * cellTotalHeight + cellConfig.value.margin.top
        const cellWidth = cellConfig.value.width
        const cellHeight = cellConfig.value.height
        
        // 检查单元格是否为空（透明）
        if (isCellEmpty(imageData, cellX, cellY, cellWidth, cellHeight)) {
          const index = row * cols + col
          emptyCells.push(index)
        }
      }
    }

    detectedInsertPoints.value = emptyCells
    
    // 如果当前有插入点配置，确保它在检测到的列表中
    if (insertPointConfig.value.mode === 'auto' && emptyCells.length > 0) {
      insertPointConfig.value.startCellIndex = emptyCells[0]
      currentInsertPoint.value = 0
    }
  }

  // 检查单元格是否为空（基于透明度）
  function isCellEmpty(
    imageData: ImageData,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    threshold: number = 10
  ): boolean {
    const { data, width } = imageData
    
    // 边界检查
    if (cellX + cellWidth > width || cellY + cellHeight > imageData.height) {
      return false
    }
    
    for (let y = cellY; y < cellY + cellHeight; y++) {
      for (let x = cellX; x < cellX + cellWidth; x++) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha > threshold) return false
      }
    }
    return true
  }

  // 保存到 localStorage
  function saveToLocalStorage() {
    const state = {
      imageConfig: imageConfig.value,
      cellConfig: cellConfig.value,
      cellAlignment: cellAlignment.value,
      characterStyle: characterStyle.value,
      insertPointConfig: insertPointConfig.value,
      characterEntries: characterEntries.value,
      gridConfig: gridConfig.value,
    }
    localStorage.setItem('sprite-font-editor-state', JSON.stringify(state))
  }

  // 从 localStorage 恢复
  function loadFromLocalStorage() {
    const saved = localStorage.getItem('sprite-font-editor-state')
    if (saved) {
      try {
        const state = JSON.parse(saved)
        imageConfig.value = state.imageConfig || imageConfig.value
        cellConfig.value = state.cellConfig || cellConfig.value
        cellAlignment.value = state.cellAlignment || cellAlignment.value
        characterStyle.value = state.characterStyle || characterStyle.value
        insertPointConfig.value = state.insertPointConfig || insertPointConfig.value
        characterEntries.value = state.characterEntries || []
        gridConfig.value = state.gridConfig || gridConfig.value
      } catch (error) {
        console.warn('Failed to load state from localStorage:', error)
      }
    }
  }

  // 清空状态
  function clearState() {
    imageConfig.value = {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }
    cellConfig.value = {
      width: 32,
      height: 32,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 2, right: 2, bottom: 2, left: 2 },
    }
    cellAlignment.value = {
      horizontal: 'center',
      vertical: 'middle',
    }
    characterStyle.value = {
      fontFamily: 'Arial',
      fontSize: 16,
      color: '#000000',
      outline: {
        enabled: false,
        color: '#ffffff',
        width: 1,
      },
    }
    insertPointConfig.value = {
      mode: 'auto',
      startCellIndex: 0,
    }
    gridConfig.value = {
      enabled: true,
      cellBorder: true,
      cellBorderColor: 'rgba(0, 255, 0, 0.5)',
      cellBorderWidth: 1,
      marginLines: false,
      marginLineColor: 'rgba(255, 0, 0, 0.3)',
      paddingLines: false,
      paddingLineColor: 'rgba(0, 0, 255, 0.3)',
    }
    characterEntries.value = []
    baseImage.value = null
    currentFont.value = null
    originalImageWidth.value = 0
    originalImageHeight.value = 0
    displayedCanvasWidth.value = 0
    displayedCanvasHeight.value = 0
    canvasScale.value = 1
    localStorage.removeItem('sprite-font-editor-state')
  }

  return {
    // state
    imageConfig,
    cellConfig,
    cellAlignment,
    characterStyle,
    insertPointConfig,
    characterEntries,
    baseImage,
    // Canvas 尺寸相关（使用缩放后的尺寸）
    canvasWidth: displayedCanvasWidth,
    canvasHeight: displayedCanvasHeight,
    originalImageWidth,
    originalImageHeight,
    canvasScale,
    maxCanvasWidth,
    maxCanvasHeight,
    currentFont,
    gridConfig,
    detectedInsertPoints,
    currentInsertPoint,
    // actions
    setBaseImage,
    setFont,
    updateCharacters,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearState,
    detectInsertPoints,
  }
})