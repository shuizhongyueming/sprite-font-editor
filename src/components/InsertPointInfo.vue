<template>
  <div class="insert-point-info">
    <div class="info-item">
      <span class="info-label">当前模式:</span>
      <span class="info-value">{{ modeText }}</span>
    </div>
    
    <div class="info-item">
      <span class="info-label">高亮单元格:</span>
      <span class="info-value">{{ currentCellText }}</span>
    </div>
    
    <div
      v-if="canvasSpace"
      class="info-item"
    >
      <span class="info-label">网格尺寸:</span>
      <span class="info-value">{{ gridSizeText }}</span>
    </div>
    
    <div
      v-if="nextEmptyCell !== null"
      class="info-item"
    >
      <span class="info-label">下一个空单元格:</span>
      <span class="info-value">{{ nextEmptyCellText }}</span>
    </div>
    
    <div
      v-if="mode === 'auto' && autoDetectionEnabled"
      class="auto-info"
    >
      <div class="info-item">
        <span class="info-label">检测阈值:</span>
        <input
          v-model.number="transparencyThreshold"
          type="number"
          class="form-control threshold-input"
          min="0"
          max="255"
          @change="saveConfig"
        >
      </div>
      <div class="info-item">
        <span class="info-label">检测状态:</span>
        <span
          class="info-value"
          :class="detectionStatusClass"
        >
          {{ detectionStatusText }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'


const editorStore = useEditorStore()

const transparencyThreshold = ref(10)
const autoDetectionEnabled = ref(true)

const mode = computed(() => editorStore.insertPointConfig.mode)
const currentCellIndex = computed(() => editorStore.insertPointConfig.startCellIndex || 0)
const detectedInsertPoints = computed(() => editorStore.detectedInsertPoints)

const modeText = computed(() => {
  return mode.value === 'auto' ? '自动检测' : '手动选择'
})

const currentCellText = computed(() => {
  if (!canvasSpace.value) return 'N/A'
  const rowCol = canvasSpace.value.indexToRowCol(currentCellIndex.value)
  return `第 ${rowCol.row + 1} 行, 第 ${rowCol.col + 1} 列 (索引: ${currentCellIndex.value})`
})

const canvasSpace = computed(() => {
  if (!editorStore.baseImage) return null
  
  return new CanvasSpace(
    editorStore.canvasWidth,
    editorStore.canvasHeight,
    editorStore.cellConfig.width,
    editorStore.cellConfig.height,
    editorStore.cellConfig.margin,
    editorStore.imageConfig.margin,
    editorStore.imageConfig.padding
  )
})

const gridSizeText = computed(() => {
  if (!canvasSpace.value) return 'N/A'
  return `${canvasSpace.value.rows} 行 × ${canvasSpace.value.columns} 列`
})

const nextEmptyCell = computed(() => {
  if (!canvasSpace.value || mode.value !== 'auto' || !autoDetectionEnabled.value) {
    return null
  }
  
  // 使用store中检测到的结果
  if (detectedInsertPoints.value.length > 0) {
    return detectedInsertPoints.value[0]
  }
  
  return null
})

const nextEmptyCellText = computed(() => {
  if (nextEmptyCell.value === null) {
    return detectedInsertPoints.value.length === 0 ? '未找到' : '检测中...'
  }
  const rowCol = canvasSpace.value?.indexToRowCol(nextEmptyCell.value)
  return `第 ${rowCol?.row ? rowCol.row + 1 : 0} 行, 第 ${rowCol?.col ? rowCol.col + 1 : 0} 列 (索引: ${nextEmptyCell.value})`
})

const detectionStatusText = computed(() => {
  if (!autoDetectionEnabled.value) return '已禁用'
  if (detectedInsertPoints.value.length > 0) return `已找到 ${detectedInsertPoints.value.length} 个`
  return '未找到空单元格'
})

const detectionStatusClass = computed(() => {
  if (!autoDetectionEnabled.value) return 'text-muted'
  return detectedInsertPoints.value.length > 0 ? 'text-success' : 'text-warning'
})

function saveConfig() {
  editorStore.saveToLocalStorage()
}

// 监听模式变化，更新插入点
watch(mode, (newMode) => {
  if (newMode === 'auto' && canvasSpace.value && editorStore.canvasLayer) {
    console.log('[InsertPointInfo] 切换到自动模式，触发插入点检测')
    editorStore.detectInsertPoints(editorStore.canvasLayer)
  }
})

// 监听检测结果变化，更新显示
watch(detectedInsertPoints, (newPoints) => {
  console.log(`[InsertPointInfo] 检测结果更新: 找到 ${newPoints.length} 个空单元格`)
})
</script>

<style scoped>
.insert-point-info {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.info-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.info-value {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.info-value.text-success {
  color: #28a745;
}

.info-value.text-warning {
  color: #ffc107;
}

.info-value.text-muted {
  color: #6c757d;
}

.auto-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: #e9ecef;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.threshold-input {
  width: 80px !important;
  text-align: center;
}

.form-control {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out;
}

.form-control:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>