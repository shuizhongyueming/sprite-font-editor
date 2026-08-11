<template>
  <div
    ref="canvasArea"
    class="canvas-area"
    :class="{
      'space-pressed': isSpacePressed,
      'panning': isPanning,
    }"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseUp"
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
      <!-- 视图模式工具栏 -->
      <div class="canvas-view-toolbar">
        <button
          :class="{ active: editorStore.canvasViewMode === 'fit' }"
          @click="editorStore.setCanvasViewMode('fit')"
        >
          {{ t('viewFitToView') }}
        </button>
        <button
          :class="{ active: editorStore.canvasViewMode === 'actual' }"
          @click="editorStore.setCanvasViewMode('actual')"
        >
          {{ t('viewActualSize') }}
        </button>
        <span class="zoom-percentage">{{ t('viewZoom', { percent: editorStore.zoomPercentage }) }}</span>
      </div>

      <!-- 标尺容器 -->
      <div class="ruler-container">
        <!-- 标尺角落 -->
        <Ruler
          position="corner"
          :width="0"
          :height="0"
          :cell-width="effectiveCellConfig.width"
          :cell-height="effectiveCellConfig.height"
          :cell-margin="effectiveCellConfig.margin"
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
          :cell-width="effectiveCellConfig.width"
          :cell-height="effectiveCellConfig.height"
          :cell-margin="effectiveCellConfig.margin"
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
          :cell-width="effectiveCellConfig.width"
          :cell-height="effectiveCellConfig.height"
          :cell-margin="effectiveCellConfig.margin"
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
        :style="canvasLayerStyle"
      />

      <!-- UI 层（上层）-->
      <div
        ref="uiLayer"
        class="ui-layer"
        :style="uiLayerStyle"
        @click="handleCellClick"
      >
        <!-- 网格参考线 -->
        <div
          v-if="editorStore.gridConfig.enabled"
          class="grid-lines"
        >
          <div
            v-for="line in verticalLines"
            :key="`v-${line.index}`"
            class="grid-reference-line grid-reference-line--vertical"
            :style="line.style"
          />
          <div
            v-for="line in horizontalLines"
            :key="`h-${line.index}`"
            class="grid-reference-line grid-reference-line--horizontal"
            :style="line.style"
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
        </div>

        <!-- 选中的插入点高亮 -->
        <div
          v-if="selectedInsertPointHighlight"
          class="cell-highlight cell-highlight--insert"
          :style="selectedInsertPointHighlight.style"
        />

        <!-- 选中的字符高亮 -->
        <div
          v-if="selectedCharHighlight"
          class="cell-highlight cell-highlight--char"
          :style="selectedCharHighlight.style"
        />
      </div>
    </div>

    <!-- C3 预览悬浮面板 -->
    <C3Preview
      v-if="editorStore.isC3Mode"
      class="c3-preview-floating"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, watchEffect } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'
import { renderCharacterToCellScaled } from '@/utils/char-renderer'
import { renderC3AppendedCharacter } from '@/utils/c3-char-renderer'
import { splitGraphemes } from '@/utils/grapheme'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'
import Ruler from './Ruler.vue'
import C3Preview from './C3Preview.vue'

const editorStore = useEditorStore()

const canvasArea = ref<HTMLDivElement>()
const canvasContainer = ref<HTMLDivElement>()
const canvasLayer = ref<HTMLCanvasElement>()
const uiLayer = ref<HTMLDivElement>()

const highlightedCellIndex = ref<number>(0)

// Space 拖拽平移状态
const isSpacePressed = ref(false)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

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

// C3 模式下强制单元格边距为 0
const effectiveCellConfig = computed(() => {
  if (editorStore.isC3Mode) {
    return {
      ...cellConfig.value,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    }
  }
  return cellConfig.value
})

const importedGraphemeCount = computed(() => {
  return splitGraphemes(editorStore.importedCharacterSet).length
})

const RULER_SIZE = 20

const containerStyle = computed(() => ({
  width: `${canvasWidth.value + RULER_SIZE}px`,
  height: `${canvasHeight.value + RULER_SIZE}px`,
}))

const canvasLayerStyle = computed(() => ({
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

  // C3 模式下 fontSprite 以 base 单位存储，需转换为显示单位，
  // 避免与显示单位的 canvasWidth/margin/padding 混用
  const scale = editorStore.canvasScale
  const fontSpriteWidth = editorStore.isC3Mode && editorStore.baseImageConfig.fontSpriteWidth
    ? Math.round(editorStore.baseImageConfig.fontSpriteWidth * scale)
    : editorStore.baseImageConfig.fontSpriteWidth || undefined
  const fontSpriteHeight = editorStore.isC3Mode && editorStore.baseImageConfig.fontSpriteHeight
    ? Math.round(editorStore.baseImageConfig.fontSpriteHeight * scale)
    : editorStore.baseImageConfig.fontSpriteHeight || undefined

  return new CanvasSpace(
    canvasWidth.value,
    canvasHeight.value,
    effectiveCellConfig.value.width,
    effectiveCellConfig.value.height,
    effectiveCellConfig.value.margin,
    imageConfig.value.margin,
    imageConfig.value.padding,
    fontSpriteWidth,
    fontSpriteHeight
  )
})

// 单元格坐标数据（用于渲染和检测）
const cellPositions = computed(() => {
  if (!canvasSpace.value) return []

  const positions = []
  const rows = canvasSpace.value.rows
  const cols = canvasSpace.value.columns

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = canvasSpace.value.rowColToIndex(row, col)
      const position = canvasSpace.value.getCellPosition(row, col)

      positions.push({
        index,
        row,
        col,
        x: position.x,
        y: position.y,
        width: effectiveCellConfig.value.width,
        height: effectiveCellConfig.value.height,
      })
    }
  }

  return positions
})

// 垂直参考线
const verticalLines = computed(() => {
  if (!canvasSpace.value) return []
  const lines = []
  const rows = canvasSpace.value.rows
  const cols = canvasSpace.value.columns
  if (rows === 0 || cols === 0) return []

  const topLeft = canvasSpace.value.getCellBounds(0, 0)
  const bottomRight = canvasSpace.value.getCellBounds(rows - 1, cols - 1)

  for (let col = 0; col <= cols; col++) {
    const bounds = canvasSpace.value.getCellBounds(0, col)
    lines.push({
      index: col,
      style: {
        left: `${bounds.x}px`,
        top: `${topLeft.y}px`,
        height: `${bottomRight.y + bottomRight.height - topLeft.y}px`,
        width: `${editorStore.gridConfig.cellBorderWidth}px`,
        backgroundColor: editorStore.gridConfig.cellBorderColor,
      },
    })
  }
  return lines
})

// 水平参考线
const horizontalLines = computed(() => {
  if (!canvasSpace.value) return []
  const lines = []
  const rows = canvasSpace.value.rows
  const cols = canvasSpace.value.columns
  if (rows === 0 || cols === 0) return []

  const topLeft = canvasSpace.value.getCellBounds(0, 0)
  const bottomRight = canvasSpace.value.getCellBounds(rows - 1, cols - 1)

  for (let row = 0; row <= rows; row++) {
    const bounds = canvasSpace.value.getCellBounds(row, 0)
    lines.push({
      index: row,
      style: {
        left: `${topLeft.x}px`,
        top: `${bounds.y}px`,
        width: `${bottomRight.x + bottomRight.width - topLeft.x}px`,
        height: `${editorStore.gridConfig.cellBorderWidth}px`,
        backgroundColor: editorStore.gridConfig.cellBorderColor,
      },
    })
  }
  return lines
})

// 选中的插入点高亮
const selectedInsertPointHighlight = computed(() => {
  if (!canvasSpace.value) return null

  const activeIndex = editorStore.insertPointConfig.mode === 'manual'
    ? highlightedCellIndex.value
    : editorStore.insertPointConfig.startCellIndex ?? 0

  if (activeIndex === undefined || activeIndex === null) return null
  if (activeIndex >= canvasSpace.value.rows * canvasSpace.value.columns) return null

  const { row, col } = canvasSpace.value.indexToRowCol(activeIndex)
  const position = canvasSpace.value.getCellPosition(row, col)

  return {
    style: {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${effectiveCellConfig.value.width}px`,
      height: `${effectiveCellConfig.value.height}px`,
      border: '1px solid #ff0000',
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
      boxSizing: 'border-box' as const,
    },
  }
})

// 选中的字符高亮
const selectedCharHighlight = computed(() => {
  if (!canvasSpace.value || editorStore.selectedCharIndex === null) return null

  const entries = editorStore.isC3Mode
    ? editorStore.c3AppendedEntries
    : editorStore.characterEntries
  if (entries.length === 0) return null

  const startIndex = editorStore.isC3Mode
    ? importedGraphemeCount.value
    : (editorStore.insertPointConfig.startCellIndex ?? 0)
  const charCellIndex = startIndex + editorStore.selectedCharIndex

  if (charCellIndex >= canvasSpace.value.rows * canvasSpace.value.columns) return null

  const { row, col } = canvasSpace.value.indexToRowCol(charCellIndex)
  const position = canvasSpace.value.getCellPosition(row, col)

  return {
    style: {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${effectiveCellConfig.value.width}px`,
      height: `${effectiveCellConfig.value.height}px`,
      border: '2px solid #28a745',
      backgroundColor: 'rgba(40, 167, 69, 0.2)',
      boxShadow: '0 0 12px rgba(40, 167, 69, 0.4)',
      boxSizing: 'border-box' as const,
      zIndex: 20,
    },
  }
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
    editorStore.canvasBaseWidth,
    editorStore.canvasBaseHeight
  )

  editorStore.maxCanvasWidth = maxSize.width
  editorStore.maxCanvasHeight = maxSize.height

  if (editorStore.baseImage) {
    editorStore.setBaseImage(editorStore.baseImage)
  }
}

// 监听视图模式变化，重绘底图
watch(() => editorStore.canvasViewMode, async () => {
  await nextTick()
  if (canvasLayer.value && editorStore.baseImage) {
    drawBaseImage()
  }
})

// 监听底图变化
watch(() => editorStore.baseImage, async (newImage) => {
  await nextTick()

  if (newImage && canvasLayer.value) {
    if (canvasArea.value && editorStore.canvasBaseWidth && editorStore.canvasBaseHeight) {
      const maxSize = computeMaxCanvasSize(
        canvasArea.value.clientWidth,
        canvasArea.value.clientHeight,
        editorStore.canvasBaseWidth,
        editorStore.canvasBaseHeight
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
          if (canvasLayer.value && cellPositions.value.length > 0) {
            const cells = cellPositions.value.map(cell => ({
              index: cell.index,
              x: cell.x,
              y: cell.y,
              width: cell.width,
              height: cell.height,
            }));
            editorStore.detectInsertPoints(canvasLayer.value, cells);
          }
        })
      }, 100)
    }
  }
})

// 监听配置变化
watch(() => [editorStore.characterStyle, editorStore.cellAlignment, editorStore.baseCellConfig, editorStore.baseImageConfig, editorStore.characterEntries, editorStore.c3AppendedEntries],
  () => {
    nextTick(() => {
      const hasGenericChars = editorStore.characterEntries.length > 0
      const hasC3Chars = editorStore.isC3Mode && editorStore.c3AppendedEntries.length > 0
      if (canvasLayer.value && editorStore.baseImage && (hasGenericChars || hasC3Chars)) {
        drawBaseImage()
      }
    })
  },
  { deep: true }
)

// C3 模式下 fontSprite 尺寸变化时，重算画布显示尺寸并重绘
watch(
  () => [
    editorStore.baseImageConfig.fontSpriteWidth,
    editorStore.baseImageConfig.fontSpriteHeight,
  ],
  async () => {
    if (!editorStore.isC3Mode || !editorStore.baseImage) return
    editorStore.refreshCanvasSize()
    await nextTick()
    if (canvasLayer.value) {
      drawBaseImage()
    }
  }
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
    if (editorStore.insertPointConfig.mode === 'auto' && canvasLayer.value && cellPositions.value.length > 0) {
      nextTick(() => {
        if (canvasLayer.value) {
          const cells = cellPositions.value.map(cell => ({
            index: cell.index,
            x: cell.x,
            y: cell.y,
            width: cell.width,
            height: cell.height,
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
      const hasGenericChars = editorStore.characterEntries.length > 0
      const hasC3Chars = editorStore.isC3Mode && editorStore.c3AppendedEntries.length > 0
      if (canvasLayer.value && editorStore.baseImage && (hasGenericChars || hasC3Chars)) {
        drawBaseImage()
      }
    })
  }
)

// 监听画布背景变化
watch(() => editorStore.canvasBg, () => {
  nextTick(() => {
    if (canvasLayer.value && editorStore.baseImage) {
      drawBaseImage()
    }
  })
})

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

    // 绘制画布背景
    drawCanvasBackground(ctx, canvas)

    // 绘制底图（按原始宽高比绘制，画布大于图片时扩展区域保持背景）
    const scale = editorStore.canvasScale
    ctx.drawImage(
      editorStore.baseImage,
      0,
      0,
      editorStore.baseImage.width * scale,
      editorStore.baseImage.height * scale,
    )

    // 渲染字符
    renderCharacters()
  } catch (error) {
    console.error('Failed to draw base image:', error)
    notify.error('绘制图片失败')
  }
}

function drawCanvasBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
) {
  const bg = editorStore.canvasBg

  if (bg === 'white') {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return
  }

  if (bg === 'black') {
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    return
  }

  // checkerboard
  const size = 40
  const patternCanvas = document.createElement('canvas')
  patternCanvas.width = size
  patternCanvas.height = size
  const patternCtx = patternCanvas.getContext('2d')
  if (!patternCtx) return

  patternCtx.fillStyle = '#ffffff'
  patternCtx.fillRect(0, 0, size, size)
  patternCtx.fillStyle = '#d2d2d2'
  patternCtx.fillRect(0, 0, size / 2, size / 2)
  patternCtx.fillRect(size / 2, size / 2, size / 2, size / 2)

  const pattern = ctx.createPattern(patternCanvas, 'repeat')
  if (!pattern) return

  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function handleCellClick(event: MouseEvent) {
  if (isSpacePressed.value || isPanning.value) return

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

    const entries = editorStore.isC3Mode
      ? editorStore.c3AppendedEntries
      : editorStore.characterEntries

    if (entries.length > 0) {
      const startIndex = editorStore.isC3Mode
        ? importedGraphemeCount.value
        : (editorStore.insertPointConfig.startCellIndex || 0)

      for (let i = 0; i < entries.length; i++) {
        const charCellIndex = startIndex + i

        if (charCellIndex === clickedIndex) {
          editorStore.selectedCharIndex = i

          const charRowCol = canvasSpace.value.indexToRowCol(charCellIndex)
          const cellPosition = canvasSpace.value.getCellPosition(charRowCol.row, charRowCol.col)

          const popupLeft = rect.left + cellPosition.x + effectiveCellConfig.value.width - 50
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

  const startIndex = editorStore.isC3Mode
    ? importedGraphemeCount.value
    : (editorStore.insertPointConfig.startCellIndex || 0)
  const charCellIndex = startIndex + editorStore.selectedCharIndex

  if (charCellIndex >= canvasSpace.value.rows * canvasSpace.value.columns) return null

  const rowCol = canvasSpace.value.indexToRowCol(charCellIndex)
  return rowCol.row
})

const highlightedCol = computed(() => {
  if (editorStore.selectedCharIndex === null || !canvasSpace.value) return null

  const startIndex = editorStore.isC3Mode
    ? importedGraphemeCount.value
    : (editorStore.insertPointConfig.startCellIndex || 0)
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
  if (editorStore.isC3Mode) {
    renderC3AppendedCharacters()
    return
  }

  renderGenericCharacters()
}

// 普通模式字符渲染
function renderGenericCharacters() {
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
      const cell = cellPositions.value[startIndex + i]
      if (!cell) break

      const charEntry = editorStore.characterEntries[i]

      // cellPositions 是显示尺寸，需要转换为原始尺寸
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

// C3 模式追加字符渲染（Phase B 实现）
function renderC3AppendedCharacters() {
  if (!canvasLayer.value || !editorStore.baseImage || !editorStore.isC3Mode) return

  const canvas = canvasLayer.value
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    notify.error(t('canvasNotReady'))
    return
  }

  // 重置画布为导入的底图（按原始宽高比绘制，扩展区域保持透明）
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const sourceImage = editorStore.c3ImportedImage || editorStore.baseImage
  const sourceScale = editorStore.canvasScale
  ctx.drawImage(
    sourceImage,
    0,
    0,
    sourceImage.width * sourceScale,
    sourceImage.height * sourceScale,
  )

  if (editorStore.c3AppendedEntries.length === 0 || !canvasSpace.value) return

  const importedCount = importedGraphemeCount.value
  const scale = editorStore.canvasScale
  const baseCell = editorStore.baseCellConfig
  const fontFamily = editorStore.currentFont?.family || editorStore.characterStyle.fontFamily

  for (let i = 0; i < editorStore.c3AppendedEntries.length; i++) {
    const entry = editorStore.c3AppendedEntries[i]
    const cellIndex = importedCount + i
    const { row, col } = canvasSpace.value.indexToRowCol(cellIndex)
    const position = canvasSpace.value.getCellPosition(row, col)

    renderC3AppendedCharacter({
      char: entry.char,
      targetCtx: ctx,
      baseCellX: position.x / scale,
      baseCellY: position.y / scale,
      baseCellWidth: effectiveCellConfig.value.width / scale,
      baseCellHeight: effectiveCellConfig.value.height / scale,
      renderScale: scale,
      charMargin: editorStore.getEffectiveCharMargin(i),
      cellPadding: baseCell.padding,
      fontFamily,
      fontSize: editorStore.characterStyle.fontSize,
      color: editorStore.characterStyle.color,
      outline: editorStore.characterStyle.outline,
      pixelStyle: editorStore.characterStyle.pixelStyle,
      alignment: { horizontal: 'left', vertical: 'top' },
    })
  }
}

function setSelectedCharIndex(index: number | null) {
  editorStore.selectedCharIndex = index
}

// Space 拖拽平移事件处理
function isInputFocused(): boolean {
  const active = document.activeElement as HTMLElement | null
  if (!active) return false
  return active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable
}

function onKeyDown(event: KeyboardEvent) {
  if (event.code === 'Space' && !isInputFocused()) {
    event.preventDefault()
    isSpacePressed.value = true
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    isSpacePressed.value = false
    isPanning.value = false
  }
}

function onMouseDown(event: MouseEvent) {
  if (!isSpacePressed.value || !canvasArea.value) return
  event.preventDefault()
  isPanning.value = true
  panStart.value = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: canvasArea.value.scrollLeft,
    scrollTop: canvasArea.value.scrollTop,
  }
}

function onMouseMove(event: MouseEvent) {
  if (!isPanning.value || !canvasArea.value) return
  const dx = event.clientX - panStart.value.x
  const dy = event.clientY - panStart.value.y
  canvasArea.value.scrollLeft = panStart.value.scrollLeft - dx
  canvasArea.value.scrollTop = panStart.value.scrollTop - dy
}

function onMouseUp() {
  isPanning.value = false
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

defineExpose({
  setSelectedCharIndex
})
</script>

<style scoped>
.canvas-area {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background-color: #f8f9fa;
  overflow: auto;
  padding: 1rem;
  cursor: crosshair;
}

.canvas-area.space-pressed {
  cursor: grab;
}

.canvas-area.space-pressed.panning {
  cursor: grabbing;
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
  flex-shrink: 0;
  margin: auto;
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

.canvas-view-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.canvas-view-toolbar button {
  border: 1px solid #dee2e6;
  background: white;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
}

.canvas-view-toolbar button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.zoom-percentage {
  font-size: 12px;
  color: #6c757d;
  margin-left: 4px;
  min-width: 40px;
  text-align: right;
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.grid-reference-line {
  position: absolute;
  pointer-events: none;
}

.grid-reference-line--vertical {
  width: 1px;
  height: 100%;
}

.grid-reference-line--horizontal {
  height: 1px;
  width: 100%;
}

.cell-highlight {
  position: absolute;
  border: 2px solid #ff0000;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 10;
}

.cell-highlight--char {
  z-index: 20;
}

.c3-preview-floating {
  /* C3Preview 组件内部控制自己的定位、尺寸和样式 */
}
</style>
