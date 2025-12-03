<template>
  <div class="canvas-area">
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
        <!-- 网格单元格 -->
        <div
          v-for="cell in gridCells"
          :key="cell.index"
          class="grid-cell"
          :style="cell.style"
        />
        
        <!-- 高亮单元格 -->
        <div
          v-if="highlightedCell"
          class="cell-highlight"
          :style="highlightedCell.style"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'

const editorStore = useEditorStore()

const canvasLayer = ref<HTMLCanvasElement>()
const uiLayer = ref<HTMLDivElement>()

const highlightedCellIndex = ref<number>(0)

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
        },
      })
    }
  }
  
  return cells
})

const highlightedCell = computed(() => {
  if (!canvasSpace.value) return null
  
  const rowCol = canvasSpace.value.indexToRowCol(highlightedCellIndex.value)
  const position = canvasSpace.value.getCellPosition(rowCol.row, rowCol.col)
  
  return {
    style: {
      left: `${position.x - 2}px`,
      top: `${position.y - 2}px`,
      width: `${editorStore.cellConfig.width + 4}px`,
      height: `${editorStore.cellConfig.height + 4}px`,
    },
  }
})

// 监听底图变化
watch(() => editorStore.baseImage, async (newImage) => {
  if (newImage && canvasLayer.value) {
    await nextTick()
    drawBaseImage()
  }
})

function drawBaseImage() {
  if (!canvasLayer.value || !editorStore.baseImage) return
  
  const canvas = canvasLayer.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 绘制底图
  ctx.drawImage(editorStore.baseImage, 0, 0, canvas.width, canvas.height)
}

function handleCellClick(event: MouseEvent) {
  if (editorStore.insertPointConfig.mode !== 'manual') return
  
  const rect = uiLayer.value?.getBoundingClientRect()
  if (!rect || !canvasSpace.value) return
  
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // 找到点击的单元格
  const cellWidth = editorStore.cellConfig.width + editorStore.cellConfig.margin.left + editorStore.cellConfig.margin.right
  const cellHeight = editorStore.cellConfig.height + editorStore.cellConfig.margin.top + editorStore.cellConfig.margin.bottom
  
  const offsetX = x - editorStore.imageConfig.margin.left - editorStore.imageConfig.padding.left
  const offsetY = y - editorStore.imageConfig.margin.top - editorStore.imageConfig.padding.top
  
  const col = Math.floor(offsetX / cellWidth)
  const row = Math.floor(offsetY / cellHeight)
  
  if (col >= 0 && row >= 0 && col < canvasSpace.value.columns && row < canvasSpace.value.rows) {
    highlightedCellIndex.value = canvasSpace.value.rowColToIndex(row, col)
    editorStore.insertPointConfig.startCellIndex = highlightedCellIndex.value
    editorStore.saveToLocalStorage()
  }
}
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