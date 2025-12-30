<template>
  <div
    ref="canvasArea"
    class="canvas-area"
  >
    <div
      v-if="!hasImage"
      class="upload-placeholder"
    >
      <div class="placeholder-content">
        <h3>请上传图片开始编辑</h3>
        <p>支持 PNG, JPG, GIF, WebP 格式</p>
      </div>
    </div>

    <div
      v-else
      ref="canvasContainer"
      class="canvas-container"
      :style="containerStyle"
    >
      <!-- 标尺容器 -->
      <div class="ruler-container">
        <!-- 标尺角落 -->
        <Ruler
          position="corner"
          :width="0"
          :height="0"
          :cell-width="cellConfig.width"
          :cell-height="cellConfig.height"
          :cell-margin="cellConfig.margin"
          :highlight-row="highlightedRow"
          :highlight-col="highlightedCol"
          :insert-point-row="insertPointRow"
          :insert-point-col="insertPointCol"
          :image-margin="imageConfig.margin"
          :image-padding="imageConfig.padding"
          :font-sprite-width="editorStore.baseImageConfig.fontSpriteWidth"
          :font-sprite-height="editorStore.baseImageConfig.fontSpriteHeight"
        />

        <!-- 顶部横向标尺 -->
        <Ruler
          position="top"
          :width="canvasWidth"
          :height="0"
          :cell-width="cellConfig.width"
          :cell-height="cellConfig.height"
          :cell-margin="cellConfig.margin"
          :highlight-row="highlightedRow"
          :highlight-col="highlightedCol"
          :insert-point-row="insertPointRow"
          :insert-point-col="insertPointCol"
          :image-margin="imageConfig.margin"
          :image-padding="imageConfig.padding"
          :font-sprite-width="editorStore.baseImageConfig.fontSpriteWidth"
          :font-sprite-height="editorStore.baseImageConfig.fontSpriteHeight"
        />

        <!-- 左侧纵向标尺 -->
        <Ruler
          position="left"
          :width="0"
          :height="canvasHeight"
          :cell-width="cellConfig.width"
          :cell-height="cellConfig.height"
          :cell-margin="cellConfig.margin"
          :highlight-row="highlightedRow"
          :highlight-col="highlightedCol"
          :insert-point-row="insertPointRow"
          :insert-point-col="insertPointCol"
          :image-margin="imageConfig.margin"
          :image-padding="imageConfig.padding"
          :font-sprite-width="editorStore.baseImageConfig.fontSpriteWidth"
          :font-sprite-height="editorStore.baseImageConfig.fontSpriteHeight"
        />
      </div>

      <!-- Canvas 层（底层）-->
      <canvas
        ref="canvasLayer"
        class="canvas-layer"
        :width="canvasWidth"
        :height="canvasHeight"
      />

      <!-- UI 层（上层）-->
      <div
        ref="uiLayer"
        class="ui-layer"
        :style="uiLayerStyle"
        @click="handleCellClick"
      >
        <!-- 网格容器 -->
        <div
          v-if="editorStore.gridConfig.enabled"
          class="grid-container"
        >
          <!-- 网格单元格 -->
          <div
            v-for="cell in gridCells"
            :key="cell.index"
            class="grid-cell"
            :style="cell.style"
          />

          <!-- Margin 线条（可选）-->
          <div
            v-if="editorStore.gridConfig.marginLines"
            class="margin-lines"
            :style="marginLinesStyle"
          />

          <!-- Padding 线条（可选）-->
          <div
            v-if="editorStore.gridConfig.paddingLines"
            class="padding-lines"
            :style="paddingLinesStyle"
          />

          <!-- 高亮单元格 -->
          <div
            v-for="(cell, index) in highlightedCells"
            :key="`highlight-${index}`"
            class="cell-highlight"
            :style="cell.style"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, watchEffect } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'
import { renderCharacterToCellScaled } from '@/utils/char-renderer'
import { notify } from '@/utils/notification'
import Ruler from './Ruler.vue'

const editorStore = useEditorStore()

const canvasArea = ref<HTMLDivElement>()
const canvasContainer = ref<HTMLDivElement>()
const canvasLayer = ref<HTMLCanvasElement>()
const uiLayer = ref<HTMLDivElement>()

const highlightedCellIndex = ref<number>(0)

// 监听 canvasLayer 变化，设置到 store
watchEffect(() => {
  if (canvasLayer.value) {
    editorStore.setCanvas(canvasLayer.value)
  }
})

// 存储容器的最大可用尺寸
const containerMaxSize = ref({ width: 0, height: 0 })

const hasImage = computed(() => editorStore.baseImage !== null)

const canvasWidth = computed(() => editorStore.canvasWidth)
const canvasHeight = computed(() => editorStore.canvasHeight)

// 已缩放的配置（用于渲染和 UI）
const cellConfig = computed(() => editorStore.cellConfig)
const imageConfig = computed(() => editorStore.imageConfig)

const containerStyle = computed(() => ({
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
  background: getCanvasBackground(),
}))

function getCanvasBackground(): string {
  const bg = editorStore.canvasBg;
  switch (bg) {
    case 'black':
      return '#000000';
    case 'checkerboard':
      return 'repeating-conic-gradient(#d2d2d2 0% 25%, #ffffff 0% 50%) 50% / 40px 40px';
    case 'white':
    default:
      return 'white';
  }
}

const uiLayerStyle = computed(() => ({
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
}))

// 使用已缩放的配置创建 CanvasSpace
const canvasSpace = computed(() => {
  if (!hasImage.value) return null

  console.log('computed canvasSpace', cellConfig.value, imageConfig.value);
  return new CanvasSpace(
    canvasWidth.value,
    canvasHeight.value,
    cellConfig.value.width,
    cellConfig.value.height,
    cellConfig.value.margin,
    imageConfig.value.margin,
    imageConfig.value.padding,
    editorStore.baseImageConfig.fontSpriteWidth || undefined,
    editorStore.baseImageConfig.fontSpriteHeight || undefined
  )
})

const gridCells = computed(() => {
  if (!canvasSpace.value) return []

  const cells = []
  const rows = canvasSpace.value.rows
  const cols = canvasSpace.value.columns

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = canvasSpace.value.rowColToIndex(row, col)
      const position = canvasSpace.value.getCellPosition(row, col)

      cells.push({
        index,
        row,
        col,
        x: position.x,
        y: position.y,
        width: cellConfig.value.width,
        height: cellConfig.value.height,
        style: {
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${cellConfig.value.width}px`,
          height: `${cellConfig.value.height}px`,
          border: editorStore.gridConfig.cellBorder
            ? `${editorStore.gridConfig.cellBorderWidth}px dashed ${editorStore.gridConfig.cellBorderColor}`
            : 'none',
        },
      })
    }
  }

  return cells
})

const highlightedCells = computed(() => {
  if (!canvasSpace.value) return []

  const cells = []

  // 1. 显示检测到的所有插入点（弱化显示）
  if (editorStore.insertPointConfig.mode === 'auto' && editorStore.detectedInsertPoints.length > 0) {
    editorStore.detectedInsertPoints.forEach((index) => {
      const rowCol = canvasSpace.value!.indexToRowCol(index)
      const position = canvasSpace.value!.getCellPosition(rowCol.row, rowCol.col)

      cells.push({
        type: 'insert-point',
        style: {
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${cellConfig.value.width}px`,
          height: `${cellConfig.value.height}px`,
          border: '1px dashed rgba(0, 255, 255, 0.6)',
          backgroundColor: 'rgba(0, 255, 255, 0.1)',
        },
      })
    })
  }

  // 2. 高亮当前选中的单元格（强显示）
  const activeIndex = editorStore.insertPointConfig.mode === 'manual'
    ? highlightedCellIndex.value
    : editorStore.insertPointConfig.startCellIndex || 0

  if (activeIndex !== undefined) {
    const rowCol = canvasSpace.value.indexToRowCol(activeIndex)
    const position = canvasSpace.value.getCellPosition(rowCol.row, rowCol.col)

    cells.push({
      type: 'active',
      style: {
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${cellConfig.value.width}px`,
        height: `${cellConfig.value.height}px`,
        border: '1px solid #ff0000',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
      },
    })
  }

  // 3. 高亮选中的字符所在的单元格
  if (editorStore.selectedCharIndex !== null && editorStore.characterEntries.length > 0) {
    const startIndex = editorStore.insertPointConfig.startCellIndex || 0
    const charCellIndex = startIndex + editorStore.selectedCharIndex

    if (charCellIndex < canvasSpace.value.rows * canvasSpace.value.columns) {
      const rowCol = canvasSpace.value.indexToRowCol(charCellIndex)
      const position = canvasSpace.value.getCellPosition(rowCol.row, rowCol.col)

      cells.push({
        type: 'selected-char',
        style: {
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${cellConfig.value.width}px`,
          height: `${cellConfig.value.height}px`,
          border: '2px solid #28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.2)',
          boxShadow: '0 0 12px rgba(40, 167, 69, 0.4)',
          zIndex: 20,
        },
      })
    }
  }

  console.log('highlighted cells:', cells);
  return cells
})

const marginLinesStyle = computed(() => {
  const margin = imageConfig.value.margin
  return {
    position: 'absolute' as const,
    left: `${margin.left}px`,
    top: `${margin.top}px`,
    right: `${margin.right}px`,
    bottom: `${margin.bottom}px`,
    border: `1px dashed ${editorStore.gridConfig.marginLineColor}`,
    pointerEvents: 'none' as const,
  }
})

const paddingLinesStyle = computed(() => {
  const margin = imageConfig.value.margin
  const padding = imageConfig.value.padding
  return {
    position: 'absolute' as const,
    left: `${margin.left + padding.left}px`,
    top: `${margin.top + padding.top}px`,
    right: `${margin.right + padding.right}px`,
    bottom: `${margin.bottom + padding.bottom}px`,
    border: `1px dashed ${editorStore.gridConfig.paddingLineColor}`,
    pointerEvents: 'none' as const,
  }
})

// 根据容器尺寸和图片宽高比计算最大画布尺寸
function computeMaxCanvasSize(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { width: 800, height: 600 }
  }

  // 留出边距，避免贴边
  const margin = 32
  const maxWidth = containerWidth - margin
  const maxHeight = containerHeight - margin

  // 计算适配比例
  const widthRatio = maxWidth / imageWidth
  const heightRatio = maxHeight / imageHeight
  const scale = Math.min(widthRatio, heightRatio, 1)

  return {
    width: Math.floor(imageWidth * scale),
    height: Math.floor(imageHeight * scale),
  }
}

// 处理窗口大小变化
function handleResize() {
  if (!canvasArea.value || !editorStore.baseImage) return

  const rect = canvasArea.value.getBoundingClientRect()

  containerMaxSize.value = {
    width: Math.floor(rect.width),
    height: Math.floor(rect.height),
  }

  const maxSize = computeMaxCanvasSize(
    containerMaxSize.value.width,
    containerMaxSize.value.height,
    editorStore.originalImageWidth,
    editorStore.originalImageHeight
  )

  editorStore.maxCanvasWidth = maxSize.width
  editorStore.maxCanvasHeight = maxSize.height

  if (editorStore.baseImage) {
    editorStore.setBaseImage(editorStore.baseImage)
  }
}

// 监听底图变化
watch(() => editorStore.baseImage, async (newImage) => {
  await nextTick()

  if (newImage && canvasLayer.value) {
    if (canvasArea.value && editorStore.originalImageWidth && editorStore.originalImageHeight) {
      const maxSize = computeMaxCanvasSize(
        canvasArea.value.clientWidth,
        canvasArea.value.clientHeight,
        editorStore.originalImageWidth,
        editorStore.originalImageHeight
      )

      editorStore.maxCanvasWidth = maxSize.width
      editorStore.maxCanvasHeight = maxSize.height

      editorStore.setBaseImage(newImage)
    }

    await nextTick()
    drawBaseImage()

    if (editorStore.insertPointConfig.mode === 'auto') {
      setTimeout(() => {
        nextTick(() => {
          if (canvasLayer.value && gridCells.value.length > 0) {
            const cells = gridCells.value.map(cell => ({
              index: cell.index,
              x: parseInt(cell.style.left),
              y: parseInt(cell.style.top),
              width: parseInt(cell.style.width),
              height: parseInt(cell.style.height),
            }));
            editorStore.detectInsertPoints(canvasLayer.value, cells);
          }
        })
      }, 100)
    }
  }
})

// 监听配置变化
watch(() => [editorStore.characterStyle, editorStore.cellAlignment, editorStore.baseCellConfig, editorStore.baseImageConfig],
  () => {
    nextTick(() => {
      if (canvasLayer.value && editorStore.baseImage && editorStore.characterEntries.length > 0) {
        drawBaseImage()
      }
    })
  },
  { deep: true }
)

// 监听会影响插入点检测的配置变化，自动重新检测
watch(
  () => [
    editorStore.baseImageConfig.fontSpriteWidth,
    editorStore.baseImageConfig.fontSpriteHeight,
    editorStore.baseImageConfig.margin,
    editorStore.baseImageConfig.padding,
    editorStore.baseCellConfig.width,
    editorStore.baseCellConfig.height,
    editorStore.baseCellConfig.margin,
  ],
  () => {
    if (editorStore.insertPointConfig.mode === 'auto' && canvasLayer.value && gridCells.value.length > 0) {
      nextTick(() => {
        if (canvasLayer.value) {
          const cells = gridCells.value.map(cell => ({
            index: cell.index,
            x: parseInt(cell.style.left),
            y: parseInt(cell.style.top),
            width: parseInt(cell.style.width),
            height: parseInt(cell.style.height),
          }));
          editorStore.detectInsertPoints(canvasLayer.value, cells);
        }
      })
    }
  },
  { deep: true }
)

// 监听渲染触发器
watch(() => editorStore.renderTrigger,
  () => {
    nextTick(() => {
      if (canvasLayer.value && editorStore.baseImage && editorStore.characterEntries.length > 0) {
        drawBaseImage()
      }
    })
  }
)

// 监听插入点变化
watch(() => editorStore.insertPointConfig,
  () => {
    nextTick(() => {
      if (canvasLayer.value && editorStore.baseImage && editorStore.characterEntries.length > 0) {
        drawBaseImage()
      }
    })
  },
  { deep: true }
)

function drawBaseImage() {
  try {
    if (!canvasLayer.value || !editorStore.baseImage) return

    const canvas = canvasLayer.value
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      notify.error('无法获取 Canvas 上下文')
      return
    }

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制底图
    ctx.drawImage(editorStore.baseImage, 0, 0, canvas.width, canvas.height)

    // 渲染字符
    renderCharacters()
  } catch (error) {
    console.error('Failed to draw base image:', error)
    notify.error('绘制图片失败')
  }
}

function handleCellClick(event: MouseEvent) {
  const rect = uiLayer.value?.getBoundingClientRect()
  if (!rect || !canvasSpace.value) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const cellPos = canvasSpace.value.positionToCell(x, y)

  if (cellPos) {
    const clickedIndex = canvasSpace.value.rowColToIndex(cellPos.row, cellPos.col)

    if (editorStore.insertPointConfig.mode === 'manual') {
      highlightedCellIndex.value = clickedIndex
      editorStore.insertPointConfig.startCellIndex = highlightedCellIndex.value
      editorStore.saveToLocalStorage()
    }

    if (editorStore.characterEntries.length > 0) {
      const startIndex = editorStore.insertPointConfig.startCellIndex || 0

      for (let i = 0; i < editorStore.characterEntries.length; i++) {
        const charCellIndex = startIndex + i

        if (charCellIndex === clickedIndex) {
          editorStore.selectedCharIndex = i

          const charRowCol = canvasSpace.value.indexToRowCol(charCellIndex)
          const cellPosition = canvasSpace.value.getCellPosition(charRowCol.row, charRowCol.col)

          const popupLeft = rect.left + cellPosition.x + cellConfig.value.width - 50
          const popupTop = rect.top + cellPosition.y - 50

          emit('showMarginPopup', {
            index: i,
            left: popupLeft,
            top: popupTop
          })

          return
        }
      }
    }
  }
}

const emit = defineEmits(['showMarginPopup'])

// 高亮行和列（用于标尺）
const highlightedRow = computed(() => {
  if (editorStore.selectedCharIndex === null || !canvasSpace.value) return null

  const startIndex = editorStore.insertPointConfig.startCellIndex || 0
  const charCellIndex = startIndex + editorStore.selectedCharIndex

  if (charCellIndex >= canvasSpace.value.rows * canvasSpace.value.columns) return null

  const rowCol = canvasSpace.value.indexToRowCol(charCellIndex)
  return rowCol.row
})

const highlightedCol = computed(() => {
  if (editorStore.selectedCharIndex === null || !canvasSpace.value) return null

  const startIndex = editorStore.insertPointConfig.startCellIndex || 0
  const charCellIndex = startIndex + editorStore.selectedCharIndex

  if (charCellIndex >= canvasSpace.value.rows * canvasSpace.value.columns) return null

  const rowCol = canvasSpace.value.indexToRowCol(charCellIndex)
  return rowCol.col
})

// 插入点高亮（用于标尺）
const insertPointRow = computed(() => {
  if (!canvasSpace.value) return null

  const activeIndex = editorStore.insertPointConfig.mode === 'manual'
    ? highlightedCellIndex.value
    : editorStore.insertPointConfig.startCellIndex || 0

  if (activeIndex === undefined || activeIndex === null) return null

  const rowCol = canvasSpace.value.indexToRowCol(activeIndex)
  return rowCol.row
})

const insertPointCol = computed(() => {
  if (!canvasSpace.value) return null

  const activeIndex = editorStore.insertPointConfig.mode === 'manual'
    ? highlightedCellIndex.value
    : editorStore.insertPointConfig.startCellIndex || 0

  if (activeIndex === undefined || activeIndex === null) return null

  const rowCol = canvasSpace.value.indexToRowCol(activeIndex)
  return rowCol.col
})

// 渲染所有字符（使用原始 fontSize 渲染，然后缩放绘制）
function renderCharacters() {
  try {
    if (!canvasLayer.value || !editorStore.baseImage) return

    const canvas = canvasLayer.value
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      notify.error('无法获取 Canvas 上下文')
      return
    }

    if (editorStore.characterEntries.length === 0) return

    const scale = editorStore.canvasScale
    const baseCell = editorStore.baseCellConfig

    const startIndex = editorStore.insertPointConfig.startCellIndex || 0
    if (startIndex === undefined) return

    for (let i = 0; i < editorStore.characterEntries.length; i++) {
      const cell = gridCells.value[startIndex + i]
      if (!cell) break

      const charEntry = editorStore.characterEntries[i]

      // gridCells 是显示尺寸，需要转换为原始尺寸
      const baseX = cell.x / scale
      const baseY = cell.y / scale
      const baseWidth = cell.width / scale
      const baseHeight = cell.height / scale

      renderCharacterToCellScaled(
        charEntry.char,
        ctx,
        baseX,
        baseY,
        baseWidth,
        baseHeight,
        scale,
        charEntry.margin || { top: 0, right: 0, bottom: 0, left: 0 },
        baseCell.padding,
        {
          fontFamily: editorStore.characterStyle.fontFamily,
          fontSize: editorStore.characterStyle.fontSize,
          color: editorStore.characterStyle.color,
          outline: editorStore.characterStyle.outline,
          alignment: editorStore.cellAlignment,
        },
        editorStore.characterStyle.pixelStyle,
      )
    }
  } catch (error) {
    console.error('Failed to render characters:', error)
    notify.error('字符渲染失败')
  }
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

function setSelectedCharIndex(index: number | null) {
  editorStore.selectedCharIndex = index
}

defineExpose({
  setSelectedCharIndex
})
</script>

<style scoped>
.canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  overflow: auto;
  padding: 1rem;
}

.upload-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: 2px dashed #dee2e6;
  border-radius: 8px;
}

.placeholder-content {
  text-align: center;
  color: #6c757d;
}

.placeholder-content h3 {
  margin-bottom: 0.5rem;
  font-weight: normal;
}

.canvas-container {
  position: relative;
  display: inline-block;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: white;
}

.canvas-layer {
  position: absolute;
  top: 20px;
  left: 20px;
}

.ui-layer {
  position: absolute;
  top: 20px;
  left: 20px;
  width: calc(100% - 40px);
  height: calc(100% - 40px);
  pointer-events: auto;
  cursor: crosshair;
}

.ruler-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 45;
}

.grid-cell {
  border: 1px solid rgba(0, 255, 0, 0.5);
  position: absolute;
  pointer-events: none;
}

.cell-highlight {
  position: absolute;
  border: 2px solid #ff0000;
  pointer-events: none;
  z-index: 10;
}
</style>
