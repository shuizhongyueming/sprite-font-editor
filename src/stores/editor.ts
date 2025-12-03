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
  const canvasWidth = ref(0)
  const canvasHeight = ref(0)
  const currentFont = ref<FontFace | null>(null)

  // 设置底图
  function setBaseImage(image: HTMLImageElement) {
    baseImage.value = image
    canvasWidth.value = image.width
    canvasHeight.value = image.height
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

  // 保存到 localStorage
  function saveToLocalStorage() {
    const state = {
      imageConfig: imageConfig.value,
      cellConfig: cellConfig.value,
      cellAlignment: cellAlignment.value,
      characterStyle: characterStyle.value,
      insertPointConfig: insertPointConfig.value,
      characterEntries: characterEntries.value,
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
    characterEntries.value = []
    baseImage.value = null
    currentFont.value = null
    canvasWidth.value = 0
    canvasHeight.value = 0
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
    canvasWidth,
    canvasHeight,
    currentFont,
    // actions
    setBaseImage,
    setFont,
    updateCharacters,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearState,
  }
})