<template>
  <div class="c3-preview">
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

    <div class="preview-canvas-wrapper">
      <canvas
        ref="previewCanvas"
        class="preview-canvas"
        :width="canvasWidth"
        :height="canvasHeight"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { renderC3AppendedCharacter } from '@/utils/c3-char-renderer'
import { splitGraphemes } from '@/utils/grapheme'
import { CanvasSpace } from '@/utils/canvas'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

const previewCanvas = ref<HTMLCanvasElement>()
const sampleText = ref('')
const previousEffectiveCharacterSet = ref('')
const canvasWidth = ref(800)
const canvasHeight = ref(64)

const characterWidth = computed(() => editorStore.baseCellConfig.width)
const characterHeight = computed(() => editorStore.baseCellConfig.height)
const characterSpacing = computed(() => editorStore.importedCharacterSpacing)
const lineHeight = computed(() => editorStore.importedLineHeight)

const effectiveChars = computed(() => splitGraphemes(editorStore.c3EffectiveCharacterSet))
const importedCount = computed(() => splitGraphemes(editorStore.importedCharacterSet).length)

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
    map.set(entry.char, entry.displayWidth)
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
    })
  }
}

onMounted(() => {
  sampleText.value = editorStore.c3EffectiveCharacterSet
  previousEffectiveCharacterSet.value = editorStore.c3EffectiveCharacterSet
  renderPreview()
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
watch(() => editorStore.importedCharacterSpacing, renderPreview)
watch(() => editorStore.importedLineHeight, renderPreview)
</script>

<style scoped>
.c3-preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
}

.sample-input-row {
  display: flex;
  gap: 0.5rem;
}

.sample-input {
  flex: 1;
  padding: 0.375rem 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
}

.sample-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.preview-canvas-wrapper {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background-color: #f8f9fa;
  background-image:
    linear-gradient(45deg, #e9ecef 25%, transparent 25%),
    linear-gradient(-45deg, #e9ecef 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e9ecef 75%),
    linear-gradient(-45deg, transparent 75%, #e9ecef 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  overflow: auto;
}

.preview-canvas {
  display: block;
  background-color: transparent;
}

.btn {
  padding: 0.375rem 0.75rem;
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
