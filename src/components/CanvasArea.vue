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
          :cell-width="editorStore.cellConfig.width"
          :cell-height="editorStore.cellConfig.height"
          :cell-margin="editorStore.cellConfig.margin"
          :highlight-row="highlightedRow"
          :highlight-col="highlightedCol"
          :insert-point-row="insertPointRow"
          :insert-point-col="insertPointCol"
        />
        
        <!-- 顶部横向标尺 -->
        <Ruler
          position="top"
          :width="canvasWidth"
          :height="0"
          :cell-width="editorStore.cellConfig.width"
          :cell-height="editorStore.cellConfig.height"
          :cell-margin="editorStore.cellConfig.margin"
          :highlight-row="highlightedRow"
          :highlight-col="highlightedCol"
          :insert-point-row="insertPointRow"
          :insert-point-col="insertPointCol"
        />
        
        <!-- 左侧纵向标尺 -->
        <Ruler
          position="left"
          :width="0"
          :height="canvasHeight"
          :cell-width="editorStore.cellConfig.width"
          :cell-height="editorStore.cellConfig.height"
          :cell-margin="editorStore.cellConfig.margin"
          :highlight-row="highlightedRow"
          :highlight-col="highlightedCol"
          :insert-point-row="insertPointRow"
          :insert-point-col="insertPointCol"
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
import { renderCharacterToCell } from '@/utils/char-renderer'
import { notify } from '@/utils/notification'
import Ruler from './Ruler.vue'

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
          width: `${editorStore.cellConfig.width}px`,
          height: `${editorStore.cellConfig.height}px`,
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
        width: `${editorStore.cellConfig.width}px`,
        height: `${editorStore.cellConfig.height}px`,
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
          width: `${editorStore.cellConfig.width}px`,
          height: `${editorStore.cellConfig.height}px`,
          border: '2px solid #28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.2)',
          boxShadow: '0 0 12px rgba(40, 167, 69, 0.4)',
          zIndex: 20,
        },
      })
    }
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
      console.log('[CanvasArea] 图片加载完成，将在自动模式下检测插入点')
      setTimeout(() => {
        if (canvasLayer.value) {
          console.log('[CanvasArea] 开始检测插入点...')
          editorStore.detectInsertPoints(canvasLayer.value)
        } else {
          console.log('[CanvasArea] 错误：canvasLayer为null')
        }
      }, 100) // 延迟确保画布渲染完成
    } else {
      console.log('[CanvasArea] 图片加载完成，当前为手动模式，跳过自动检测')
    }
  }
})

// 监听样式变化（不改变插入点时自动渲染）
watch(() => [editorStore.characterStyle, editorStore.cellAlignment, editorStore.cellConfig],
  () => {
    // 延迟执行，等待状态更新完成
    nextTick(() => {
      if (canvasLayer.value && editorStore.baseImage && editorStore.characterEntries.length > 0) {
        drawBaseImage()
      }
    })
  },
  { deep: true }
)

// 监听渲染触发器（从Toolbar触发）
watch(() => editorStore.renderTrigger,
  () => {
    nextTick(() => {
      if (canvasLayer.value && editorStore.baseImage && editorStore.characterEntries.length > 0) {
        drawBaseImage()
      }
    })
  }
)

// 监听插入点变化，重新渲染
watch(() => editorStore.insertPointConfig,
  () => {
    nextTick(() => {
      // 只要底图存在且字符条目已保存（即使没有渲染到画布），也重新渲染
      if (canvasLayer.value && editorStore.baseImage && editorStore.characterEntries.length > 0) {
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
  const rect = uiLayer.value?.getBoundingClientRect()
  if (!rect || !canvasSpace.value) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 使用 CanvasSpace 的坐标转换功能
  const cellPos = canvasSpace.value.positionToCell(x, y)

  if (cellPos) {
    const clickedIndex = canvasSpace.value.rowColToIndex(cellPos.row, cellPos.col)
    
    // 如果是手动模式，更新插入点
    if (editorStore.insertPointConfig.mode === 'manual') {
      highlightedCellIndex.value = clickedIndex
      editorStore.insertPointConfig.startCellIndex = highlightedCellIndex.value
      editorStore.saveToLocalStorage()
    }
    
    // 检查是否点击了已渲染的字符
    if (editorStore.characterEntries.length > 0) {
      const startIndex = editorStore.insertPointConfig.startCellIndex || 0
      
      for (let i = 0; i < editorStore.characterEntries.length; i++) {
        const charCellIndex = startIndex + i
        
        if (charCellIndex === clickedIndex) {
          // 点击了字符，触发边距编辑
          editorStore.selectedCharIndex = i
          
          // 获取该字符的单元格位置（屏幕坐标）
          const charRowCol = canvasSpace.value.indexToRowCol(charCellIndex)
          const cellPosition = canvasSpace.value.getCellPosition(charRowCol.row, charRowCol.col)
          
          // 计算弹窗位置（相对于viewport）
          const popupLeft = rect.left + cellPosition.x + editorStore.cellConfig.width - 50
          const popupTop = rect.top + cellPosition.y - 50
          
          // 发射事件给父组件
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

// 定义事件
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

// 暴露方法，让父组件可以设置选中的字符
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
