<template>
  <div
    class="c3-preview-floating-panel"
    :style="panelStyle"
    :class="{ 'is-collapsed': isCollapsed }"
  >
    <!-- 标题栏：可拖拽移动 -->
    <div
      class="c3-preview-header"
      @mousedown="startDrag"
    >
      <div class="c3-preview-drag-handle">
        <span class="drag-icon" />
        <span class="c3-preview-title">{{ t('c3Preview') }}</span>
      </div>
      <button
        class="c3-preview-toggle-btn"
        :title="isCollapsed ? t('c3ExpandPreview') : t('c3CollapsePreview')"
        @click.stop="toggleCollapse"
      >
        {{ isCollapsed ? '▲' : '▼' }}
      </button>
    </div>

    <!-- 内容区 -->
    <div
      v-show="!isCollapsed"
      class="c3-preview-body"
    >
      <div class="form-group">
        <label>{{ t('c3SampleText') }}</label>
        <div class="sample-input-row">
          <input
            v-model="sampleText"
            type="text"
            class="form-control sample-input"
            @input="renderPreview"
          >
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="resetSampleText"
          >
            {{ t('c3ResetSampleText') }}
          </button>
        </div>
      </div>

      <div
        class="preview-canvas-wrapper"
        :style="{ background: previewBackground }"
      >
        <canvas
          ref="previewCanvas"
          class="preview-canvas"
          :width="canvasWidth"
          :height="canvasHeight"
        />
      </div>
    </div>

    <!-- 缩放手柄 -->
    <div
      v-show="!isCollapsed"
      class="c3-preview-resizer"
      @mousedown="startResize"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { renderC3AppendedCharacter } from '@/utils/c3-char-renderer'
import { splitGraphemes } from '@/utils/grapheme'
import { CanvasSpace } from '@/utils/canvas'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

const previewCanvas = ref<HTMLCanvasElement>()
const sampleText = ref('')
const previousEffectiveCharacterSet = ref('')

// 面板状态
const isCollapsed = ref(false)
const panelX = ref(0)
const panelY = ref(0)
const panelWidth = ref(320)
const panelHeight = ref(240)

const MIN_WIDTH = 240
const MIN_HEIGHT = 120
const HEADER_HEIGHT = 36
const BODY_PADDING = 16

// 拖拽状态
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartPanelX = ref(0)
const dragStartPanelY = ref(0)

// 缩放状态
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)

const characterWidth = computed(() => editorStore.baseCellConfig.width)
const characterHeight = computed(() => editorStore.baseCellConfig.height)
const characterSpacing = computed(() => editorStore.importedCharacterSpacing)
const lineHeight = computed(() => editorStore.importedLineHeight)

const effectiveChars = computed(() => splitGraphemes(editorStore.c3EffectiveCharacterSet))
const importedCount = computed(() => splitGraphemes(editorStore.importedCharacterSet).length)

const panelStyle = computed(() => ({
  left: `${panelX.value}px`,
  top: `${panelY.value}px`,
  width: `${panelWidth.value}px`,
  height: isCollapsed.value ? `${HEADER_HEIGHT}px` : `${panelHeight.value}px`,
}))

const canvasWidth = computed(() => {
  return Math.max(200, panelWidth.value - BODY_PADDING * 2)
})

const canvasHeight = ref(64)

const previewBackground = computed(() => {
  const bg = editorStore.canvasBg
  switch (bg) {
    case 'black':
      return '#000000'
    case 'checkerboard':
      return 'repeating-conic-gradient(#d2d2d2 0% 25%, #ffffff 0% 50%) 50% / 40px 40px'
    case 'white':
    default:
      return 'white'
  }
})

const importedSpacingMap = computed(() => {
  const map = new Map<string, number>()
  if (!editorStore.importedSpacingData) return map

  try {
    const tuples = JSON.parse(editorStore.importedSpacingData) as Array<[number, string]>
    for (const [width, chars] of tuples) {
      for (const char of splitGraphemes(chars)) {
        map.set(char, width)
      }
    }
  } catch (error) {
    console.error('Failed to parse imported spacing data for preview:', error)
  }

  return map
})

const appendedWidthMap = computed(() => {
  const map = new Map<string, number>()
  for (const entry of editorStore.c3AppendedEntries) {
    const displayWidth =
      entry.autoDisplayWidth +
      editorStore.c3GlobalExtraSpacing +
      entry.extraSpacing
    map.set(entry.char, displayWidth)
  }
  return map
})

const spaceWidth = computed(() => {
  if (importedSpacingMap.value.has(' ')) {
    return importedSpacingMap.value.get(' ')!
  }
  return characterWidth.value
})

function resetSampleText() {
  sampleText.value = editorStore.c3EffectiveCharacterSet
  renderPreview()
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function startDrag(event: MouseEvent) {
  if (isCollapsed.value) return
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  dragStartPanelX.value = panelX.value
  dragStartPanelY.value = panelY.value
  event.preventDefault()
}

function startResize(event: MouseEvent) {
  isResizing.value = true
  resizeStartX.value = event.clientX
  resizeStartY.value = event.clientY
  resizeStartWidth.value = panelWidth.value
  resizeStartHeight.value = panelHeight.value
  event.preventDefault()
  event.stopPropagation()
}

function onMouseMove(event: MouseEvent) {
  if (isDragging.value) {
    panelX.value = dragStartPanelX.value + event.clientX - dragStartX.value
    panelY.value = dragStartPanelY.value + event.clientY - dragStartY.value
  }

  if (isResizing.value) {
    panelWidth.value = Math.max(MIN_WIDTH, resizeStartWidth.value + event.clientX - resizeStartX.value)
    panelHeight.value = Math.max(MIN_HEIGHT, resizeStartHeight.value + event.clientY - resizeStartY.value)
  }
}

function onMouseUp() {
  isDragging.value = false
  isResizing.value = false
}

function getDisplayWidth(char: string): number {
  if (char === ' ') return spaceWidth.value
  if (appendedWidthMap.value.has(char)) return appendedWidthMap.value.get(char)!
  if (importedSpacingMap.value.has(char)) return importedSpacingMap.value.get(char)!
  return characterWidth.value
}

function getCharSourceIndex(char: string): number {
  return effectiveChars.value.indexOf(char)
}

function renderPreview() {
  nextTick(() => {
    const canvas = previewCanvas.value
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false

    const sourceCanvas = buildSourceCanvas()
    if (!sourceCanvas) return

    const wrapWidth = canvasWidth.value
    const chars = splitGraphemes(sampleText.value)
    const cols = Math.max(1, Math.floor(sourceCanvas.width / characterWidth.value))
    const lineAdvance = characterHeight.value + lineHeight.value

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    let x = 0
    let y = 0

    for (const char of chars) {
      const width = getDisplayWidth(char)

      // 换行：避免在 x 为 0 时因为单个字符过宽而无限换行
      if (char !== ' ' && x + width > wrapWidth && x > 0) {
        x = 0
        y += lineAdvance
      }

      const sourceIndex = getCharSourceIndex(char)
      if (sourceIndex >= 0) {
        const row = Math.floor(sourceIndex / cols)
        const col = sourceIndex % cols
        const sx = col * characterWidth.value
        const sy = row * characterHeight.value

        ctx.drawImage(
          sourceCanvas,
          sx,
          sy,
          characterWidth.value,
          characterHeight.value,
          x,
          y,
          characterWidth.value,
          characterHeight.value,
        )
      }

      x += width + characterSpacing.value
    }

    const newHeight = y + characterHeight.value
    if (canvasHeight.value !== newHeight) {
      canvasHeight.value = newHeight
      nextTick(renderPreview)
    }
  })
}

function buildSourceCanvas(): HTMLCanvasElement | null {
  const image = editorStore.c3ImportedImage || editorStore.baseImage
  if (!image) return null

  const baseCell = editorStore.baseCellConfig
  const baseImageCfg = editorStore.baseImageConfig

  const canvasSpace = new CanvasSpace(
    image.width,
    image.height,
    baseCell.width,
    baseCell.height,
    baseCell.margin,
    baseImageCfg.margin,
    baseImageCfg.padding,
    baseImageCfg.fontSpriteWidth,
    baseImageCfg.fontSpriteHeight,
  )

  const cols = Math.max(1, canvasSpace.columns)
  const rows = Math.max(1, Math.ceil(effectiveChars.value.length / cols))
  const canvas = document.createElement('canvas')

  canvas.width = cols * baseCell.width
  canvas.height = rows * baseCell.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // 从原图按网格单元复制导入的字符
  for (let i = 0; i < importedCount.value; i++) {
    const { row, col } = canvasSpace.indexToRowCol(i)
    const position = canvasSpace.getCellPosition(row, col)
    const dx = col * baseCell.width
    const dy = row * baseCell.height

    ctx.drawImage(
      image,
      position.x,
      position.y,
      baseCell.width,
      baseCell.height,
      dx,
      dy,
      baseCell.width,
      baseCell.height,
    )
  }

  renderAppendedToSource(ctx, cols)

  return canvas
}

function renderAppendedToSource(
  ctx: CanvasRenderingContext2D,
  cols: number,
) {
  const fontFamily = editorStore.currentFont?.family || editorStore.characterStyle.fontFamily
  const baseCell = editorStore.baseCellConfig

  for (let i = 0; i < editorStore.c3AppendedEntries.length; i++) {
    const entry = editorStore.c3AppendedEntries[i]
    const cellIndex = importedCount.value + i
    const row = Math.floor(cellIndex / cols)
    const col = cellIndex % cols

    renderC3AppendedCharacter({
      char: entry.char,
      targetCtx: ctx,
      baseCellX: col * baseCell.width,
      baseCellY: row * baseCell.height,
      baseCellWidth: baseCell.width,
      baseCellHeight: baseCell.height,
      renderScale: 1,
      charMargin: entry.margin,
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

onMounted(() => {
  // 默认定位在右下角
  panelX.value = window.innerWidth - panelWidth.value - 20
  panelY.value = window.innerHeight - panelHeight.value - 20

  sampleText.value = editorStore.c3EffectiveCharacterSet
  previousEffectiveCharacterSet.value = editorStore.c3EffectiveCharacterSet
  renderPreview()

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

watch(() => editorStore.c3EffectiveCharacterSet, (newSet) => {
  if (
    sampleText.value === '' ||
    sampleText.value === previousEffectiveCharacterSet.value
  ) {
    sampleText.value = newSet
  }
  previousEffectiveCharacterSet.value = newSet
  renderPreview()
})

watch(() => editorStore.c3EffectiveSpacingData, renderPreview)
watch(() => editorStore.baseImage, renderPreview)
watch(() => editorStore.c3ImportedImage, renderPreview)
watch(() => editorStore.baseCellConfig, renderPreview, { deep: true })
watch(() => editorStore.baseImageConfig, renderPreview, { deep: true })
watch(() => editorStore.c3AppendedEntries, renderPreview, { deep: true })
watch(() => editorStore.c3GlobalExtraSpacing, renderPreview)
watch(() => editorStore.importedCharacterSpacing, renderPreview)
watch(() => editorStore.importedLineHeight, renderPreview)
watch(canvasWidth, renderPreview)
</script>

<style scoped>
.c3-preview-floating-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 100;
  user-select: none;
}

.c3-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 0.5rem 0 0.75rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  cursor: grab;
}

.c3-preview-header:active {
  cursor: grabbing;
}

.c3-preview-drag-handle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.drag-icon {
  display: inline-block;
  width: 12px;
  height: 12px;
  background-image: radial-gradient(circle, #adb5bd 1.5px, transparent 1.5px);
  background-size: 4px 4px;
  background-position: center;
  opacity: 0.6;
}

.c3-preview-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.c3-preview-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #6c757d;
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: 4px;
}

.c3-preview-toggle-btn:hover {
  background-color: #e9ecef;
  color: #495057;
}

.c3-preview-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}

.form-group label {
  font-weight: 500;
  font-size: 0.75rem;
  color: #495057;
}

.sample-input-row {
  display: flex;
  gap: 0.5rem;
}

.sample-input {
  flex: 1;
  padding: 0.25rem 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.75rem;
}

.sample-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.preview-canvas-wrapper {
  flex: 1;
  min-height: 0;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: auto;
}

.preview-canvas {
  display: block;
  background-color: transparent;
}

.c3-preview-resizer {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 50%, #adb5bd 50%);
  border-top-left-radius: 8px;
}

.c3-preview-resizer:hover {
  background: linear-gradient(135deg, transparent 50%, #007bff 50%);
}

.btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
}

.btn-outline-secondary {
  background-color: transparent;
  color: #6c757d;
  border-color: #6c757d;
}

.btn-outline-secondary:hover:not(:disabled) {
  background-color: #6c757d;
  color: white;
}
</style>
