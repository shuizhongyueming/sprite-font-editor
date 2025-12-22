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
import { renderCharacterToCell } from '@/utils/char-renderer'
import { notify } from '@/utils/notification'

const editorStore = useEditorStore()

const canvasArea = ref<HTMLDivElement>()  // .canvas-area 容器
const canvasContainer = ref<HTMLDivElement>()  // .canvas-container
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

const containerStyle = computed(() => ({
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
}))

const uiLayerStyle = computed(() => ({
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
}))

const canvasSpace = computed(() => {
  if (!hasImage.value) return null

  return new CanvasSpace(
    canvasWidth.value,
    canvasHeight.value,
    editorStore.cellConfig.width,
    editorStore.cellConfig.height,
    editorStore.cellConfig.margin,
    editorStore.imageConfig.margin,
    editorStore.imageConfig.padding
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
        style: {
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${editorStore.cellConfig.width}px`,
          height: `${editorStore.cellConfig.height}px`,
          border: editorStore.gridConfig.cellBorder
            ? `${editorStore.gridConfig.cellBorderWidth}px solid ${editorStore.gridConfig.cellBorderColor}`
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
          left: `${position.x - 1}px`,
          top: `${position.y - 1}px`,
          width: `${editorStore.cellConfig.width + 2}px`,
          height: `${editorStore.cellConfig.height + 2}px`,
          border: '2px dashed rgba(0, 255, 255, 0.6)',
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
        left: `${position.x - 2}px`,
        top: `${position.y - 2}px`,
        width: `${editorStore.cellConfig.width + 4}px`,
        height: `${editorStore.cellConfig.height + 4}px`,
        border: '3px solid #ff0000',
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
      },
    })
  }

  return cells
})

const marginLinesStyle = computed(() => {
  const margin = editorStore.imageConfig.margin
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
  const margin = editorStore.imageConfig.margin
  const padding = editorStore.imageConfig.padding
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
  console.log('computeMaxCanvasSize', { containerWidth, containerHeight, imageWidth, imageHeight });
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { width: 800, height: 600 }
  }

  // 留出边距，避免贴边
  const margin = 32 // 16px * 2
  const maxWidth = containerWidth - margin
  const maxHeight = containerHeight - margin

  // 计算适配比例
  const widthRatio = maxWidth / imageWidth
  const heightRatio = maxHeight / imageHeight
  const scale = Math.min(widthRatio, heightRatio, 1) // 最大不超过原始尺寸

  const res = {
    width: Math.floor(imageWidth * scale),
    height: Math.floor(imageHeight * scale),
  };
  console.log('computeMaxCanvasSize: result: ', res);

  return res;
}

// 处理窗口大小变化
function handleResize() {
  if (!canvasArea.value || !editorStore.baseImage) return

  // 获取容器实际尺寸
  const rect = canvasArea.value.getBoundingClientRect()

  // 存储容器最大尺寸
  containerMaxSize.value = {
    width: Math.floor(rect.width),
    height: Math.floor(rect.height),
  }

  // 重新计算图片缩放
  const maxSize = computeMaxCanvasSize(
    containerMaxSize.value.width,
    containerMaxSize.value.height,
    editorStore.originalImageWidth,
    editorStore.originalImageHeight
  )

  // 更新 store 中的最大尺寸限制（用于后续图片上传）
  editorStore.maxCanvasWidth = maxSize.width
  editorStore.maxCanvasHeight = maxSize.height

  // 如果已有图片，重新调整
  if (editorStore.baseImage) {
    editorStore.setBaseImage(editorStore.baseImage)
  }
}

// 监听底图变化
watch(() => editorStore.baseImage, async (newImage) => {
  await nextTick()
  console.log('Base image changed:', newImage, canvasLayer.value);

  if (newImage && canvasLayer.value) {
    // 当有新图片加载时，重新计算最大画布尺寸
    if (canvasArea.value && editorStore.originalImageWidth && editorStore.originalImageHeight) {
      const maxSize = computeMaxCanvasSize(
        canvasArea.value.clientWidth,
        canvasArea.value.clientHeight,
        editorStore.originalImageWidth,
        editorStore.originalImageHeight
      )

      // 更新 store 中的最大尺寸，触发重新缩放
      editorStore.maxCanvasWidth = maxSize.width
      editorStore.maxCanvasHeight = maxSize.height

      // 重新应用图片（使用新的最大尺寸进行缩放）
      editorStore.setBaseImage(newImage)
    }

    await nextTick()
    drawBaseImage()

    // 如果是自动模式，检测插入点
    if (editorStore.insertPointConfig.mode === 'auto') {
      setTimeout(() => {
        if (canvasLayer.value) {
          editorStore.detectInsertPoints(canvasLayer.value)
        }
      }, 100) // 延迟确保画布渲染完成
    }
  }
})

// 监听字符变化，自动重新渲染
watch(() => [editorStore.characterEntries, editorStore.characterStyle, editorStore.cellAlignment, editorStore.cellConfig],
  () => {
    // 延迟执行，等待状态更新完成
    nextTick(() => {
      if (canvasLayer.value && editorStore.baseImage) {
        drawBaseImage()
      }
    })
  },
  { deep: true }
)

function drawBaseImage() {
  try {
    console.log('drawBaseImage', canvasLayer.value, editorStore.baseImage);
    if (!canvasLayer.value || !editorStore.baseImage) return

    const canvas = canvasLayer.value
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      notify.error('无法获取 Canvas 上下文')
      return
    }

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制底图，保持缩放比例
    // 注意：canvas.width/height 已经是缩放后的尺寸
    ctx.drawImage(editorStore.baseImage, 0, 0, canvas.width, canvas.height)

    // 渲染字符（如果有的话）
    renderCharacters()
  } catch (error) {
    console.error('Failed to draw base image:', error)
    notify.error('绘制图片失败')
  }
}

function handleCellClick(event: MouseEvent) {
  if (editorStore.insertPointConfig.mode !== 'manual') return

  const rect = uiLayer.value?.getBoundingClientRect()
  if (!rect || !canvasSpace.value) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 使用 CanvasSpace 的坐标转换功能
  const cellPos = canvasSpace.value.positionToCell(x, y)

  if (cellPos) {
    highlightedCellIndex.value = canvasSpace.value.rowColToIndex(cellPos.row, cellPos.col)
    editorStore.insertPointConfig.startCellIndex = highlightedCellIndex.value
    editorStore.saveToLocalStorage()
  }
}

/**
 * 渲染所有字符到画布
 */
function renderCharacters() {
  try {
    if (!canvasLayer.value || !editorStore.baseImage || !canvasSpace.value) return

    const canvas = canvasLayer.value
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      notify.error('无法获取 Canvas 上下文')
      return
    }

    // 如果有字符需要渲染
    if (editorStore.characterEntries.length === 0) return

    // 确定起始单元格
    const startIndex = editorStore.insertPointConfig.startCellIndex || 0
    if (startIndex === undefined) return

    let currentIndex = startIndex

    // 遍历所有字符
    for (const charEntry of editorStore.characterEntries) {
      if (currentIndex >= canvasSpace.value.rows * canvasSpace.value.columns) break

      // 获取单元格位置
      const rowCol = canvasSpace.value.indexToRowCol(currentIndex)
      const cellPosition = canvasSpace.value.getCellPosition(rowCol.row, rowCol.col)

      // 渲染字符到单元格（传入 cellPadding）
      renderCharacterToCell(
        charEntry.char,
        ctx,
        cellPosition.x,
        cellPosition.y,
        editorStore.cellConfig.width,
        editorStore.cellConfig.height,
        charEntry.margin || { top: 0, right: 0, bottom: 0, left: 0 },
        editorStore.cellConfig.padding,  // ✅ 添加 cellPadding 参数
        {
          fontFamily: editorStore.characterStyle.fontFamily,
          fontSize: editorStore.characterStyle.fontSize,
          color: editorStore.characterStyle.color,
          outline: editorStore.characterStyle.outline,
          alignment: editorStore.cellAlignment,
        }
      )

      currentIndex++
    }
  } catch (error) {
    console.error('Failed to render characters:', error)
    notify.error('字符渲染失败')
  }
}

// 生命周期
onMounted(() => {
  // 初始计算容器尺寸
  handleResize()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 清理事件监听
  window.removeEventListener('resize', handleResize)
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
  top: 0;
  left: 0;
}

.ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.ui-layer > * {
  pointer-events: auto;
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
