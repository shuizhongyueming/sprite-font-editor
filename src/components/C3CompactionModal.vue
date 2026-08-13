<!--
  C3 精简结果模态（issue #10，方案 A）。
  顶部关键指标 + Sprite / C3 文本双预览（旧/新并排）+ 配置变化折叠说明 + 风险提示。
  「应用精简」只调用 editorStore.applyC3SpriteCompaction(plan, repacked)；
  取消/失败不改变 store 与持久化。overlay 阻断底层编辑。
-->
<template>
  <div
    v-if="visible"
    class="c3-compaction-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="c3-compaction-modal-title"
  >
    <div
      ref="modalPanel"
      class="c3-compaction-modal__panel"
      @keydown.stop="onPanelKeydown"
    >
      <header class="c3-compaction-modal__header">
        <div>
          <h3
            id="c3-compaction-modal-title"
            class="c3-compaction-modal__title"
          >
            {{ t('c3CompactionModalTitle') }}
          </h3>
          <p class="c3-compaction-modal__subtitle">
            {{ t('c3CompactionModalSubtitle', { imported: String(importedCount), appended: String(appendedCount) }) }}
          </p>
        </div>
      </header>

      <!-- 关键指标 -->
      <div class="metrics">
        <div class="metrics__item">
          <span class="metrics__value">{{ savingsPercent }}%</span>
          <span class="metrics__label">{{ t('c3CompactionMetricSavings') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ source.characterWidth }}×{{ source.characterHeight }} → {{ plan.newCharacterWidth }}×{{ plan.newCharacterHeight }}</span>
          <span class="metrics__label">{{ t('c3CompactionMetricCell') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ oldColumns }} → {{ plan.newColumns }}</span>
          <span class="metrics__label">{{ t('c3CompactionMetricColumns') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ oldImportedWidth }}×{{ oldImportedHeight }} → {{ plan.newImageWidth }}×{{ plan.newImageHeight }}</span>
          <span class="metrics__label">{{ t('c3CompactionMetricImported') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ fontSpriteWidth }}×{{ plan.oldFinalTextureHeight }} → {{ fontSpriteWidth }}×{{ plan.newFinalTextureHeight }}</span>
          <span class="metrics__label">{{ t('c3CompactionMetricFinal') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ oldRgbaMiB.toFixed(2) }} → {{ newRgbaMiB.toFixed(2) }} MiB</span>
          <span class="metrics__label">{{ t('c3CompactionMetricRgba') }}</span>
        </div>
      </div>

      <!-- 瓶颈字符榜单（仅导入字符，前三名次并列全带） -->
      <section
        v-if="bottleneckWidth.length || bottleneckHeight.length"
        class="bottlenecks"
      >
        <h4 class="bottlenecks__title">
          {{ t('c3CompactionBottleneckTitle') }}
        </h4>
        <div class="bottlenecks__lists">
          <div class="bottlenecks__list">
            <span class="bottlenecks__label">{{ t('c3CompactionBottleneckWidth') }}</span>
            <ul class="bottlenecks__entries">
              <li
                v-for="entry in bottleneckWidth"
                :key="`w-${entry.index}`"
                class="bottlenecks__entry"
              >
                <img
                  v-if="entry.thumbnail"
                  class="bottlenecks__thumb"
                  :src="entry.thumbnail"
                  :alt="t('c3CompactionBottleneckThumbAlt')"
                >
                <span class="bottlenecks__value">{{ entry.contentWidth }}px</span>
              </li>
            </ul>
          </div>
          <div class="bottlenecks__list">
            <span class="bottlenecks__label">{{ t('c3CompactionBottleneckHeight') }}</span>
            <ul class="bottlenecks__entries">
              <li
                v-for="entry in bottleneckHeight"
                :key="`h-${entry.index}`"
                class="bottlenecks__entry"
              >
                <img
                  v-if="entry.thumbnail"
                  class="bottlenecks__thumb"
                  :src="entry.thumbnail"
                  :alt="t('c3CompactionBottleneckThumbAlt')"
                >
                <span class="bottlenecks__value">{{ entry.contentHeight }}px</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 视图切换 -->
      <div
        class="view-tabs"
        role="tablist"
      >
        <button
          type="button"
          class="view-tabs__tab"
          :class="{ 'view-tabs__tab--active': activeTab === 'sprite' }"
          @click="activeTab = 'sprite'"
        >
          {{ t('c3CompactionTabSprite') }}
        </button>
        <button
          type="button"
          class="view-tabs__tab"
          :class="{ 'view-tabs__tab--active': activeTab === 'text' }"
          @click="activeTab = 'text'"
        >
          {{ t('c3CompactionTabText') }}
        </button>
      </div>

      <!-- Sprite 预览 -->
      <div
        v-if="activeTab === 'sprite'"
        class="sprite-view"
      >
        <div class="sprite-view__toolbar">
          <button
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-outline-active': spriteMode === 'fit' }"
            @click="spriteMode = 'fit'"
          >
            {{ t('c3CompactionZoomFit') }}
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-outline-active': spriteMode === 'actual' }"
            @click="spriteMode = 'actual'"
          >
            {{ t('c3CompactionZoomActual') }}
          </button>
          <span class="sprite-view__zoom">{{ t('c3CompactionZoom') }}</span>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="spriteZoom <= 0.5"
            @click="spriteZoom = Math.max(0.5, round(spriteZoom - 0.25))"
          >
            −
          </button>
          <span class="sprite-view__zoom-value">{{ spriteZoom.toFixed(2) }}×</span>
          <button
            type="button"
            class="btn btn-sm"
            :disabled="spriteZoom >= 3"
            @click="spriteZoom = Math.min(3, round(spriteZoom + 0.25))"
          >
            ＋
          </button>
        </div>
        <div class="sprite-view__panes">
          <section class="sprite-view__pane">
            <h4 class="sprite-view__title">
              {{ t('c3CompactionOldBaseline') }}
            </h4>
            <div class="preview-canvas-wrap">
              <canvas
                ref="oldSpriteCanvas"
                :style="spriteStyle(oldImageWidth, oldImageHeight)"
              />
            </div>
          </section>
          <section class="sprite-view__pane">
            <h4 class="sprite-view__title">
              {{ t('c3CompactionNewBaseline') }}
            </h4>
            <div class="preview-canvas-wrap">
              <canvas
                ref="newSpriteCanvas"
                :style="spriteStyle(plan.newImageWidth, plan.newImageHeight)"
              />
            </div>
          </section>
        </div>
      </div>

      <!-- C3 文本预览 -->
      <div
        v-else
        class="text-view"
      >
        <div class="text-view__toolbar">
          <label
            class="text-view__label"
            for="c3-compaction-sample"
          >{{ t('c3CompactionSampleText') }}</label>
          <input
            id="c3-compaction-sample"
            v-model="sampleText"
            type="text"
            class="text-view__input"
          >
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="resetSampleText"
          >
            {{ t('c3CompactionResetSample') }}
          </button>
        </div>
        <div class="text-view__panes">
          <section class="text-view__pane">
            <h4 class="text-view__title">
              {{ t('c3CompactionOldBaseline') }}
            </h4>
            <div class="preview-canvas-wrap">
              <canvas
                ref="oldTextCanvas"
                class="text-view__canvas"
              />
            </div>
          </section>
          <section class="text-view__pane">
            <h4 class="text-view__title">
              {{ t('c3CompactionNewBaseline') }}
            </h4>
            <div class="preview-canvas-wrap">
              <canvas
                ref="newTextCanvas"
                class="text-view__canvas"
              />
            </div>
          </section>
        </div>
      </div>

      <!-- 配置变化 + 风险提示 -->
      <details class="config-diff">
        <summary>{{ t('c3CompactionConfigDetails') }}</summary>
        <pre class="config-diff__code">[2] characterWidth: {{ source.characterWidth }} → {{ plan.newCharacterWidth }}
[3] characterHeight: {{ source.characterHeight }} → {{ plan.newCharacterHeight }}
[4] characterSet: {{ t('c3CompactionConfigCharSet', { count: String(importedCount) }) }}
[5] spacingData: {{ t('c3CompactionConfigSpacing', { width: String(source.characterWidth) }) }}
characterSpacing / lineHeight: {{ t('c3CompactionConfigKeep') }}</pre>
      </details>

      <ul class="caveats">
        <li>{{ t('c3CompactionCaveatSpacing') }}</li>
        <li>{{ t('c3CompactionCaveatNoScale') }}</li>
        <li>{{ t('c3CompactionCaveatStrictClip') }}</li>
        <li>{{ t('c3CompactionCaveatNoUndo') }}</li>
      </ul>

      <footer class="c3-compaction-modal__footer">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="applying"
          @click="cancel"
        >
          {{ t('cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="applying"
          @click="apply"
        >
          {{ t('c3CompactionApply') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type { C3CellExtent, C3CompactionPlan, C3CompactionSource } from '@/utils/c3-compaction'
import { rankC3CellExtents } from '@/utils/c3-compaction'
import {
  imageToCanvas,
  imageDataToCanvas,
  renderC3TextPreview,
  buildC3TextDisplayWidthMaps,
  type C3TextPreviewOptions,
} from '@/utils/c3-preview-renderer'
import { compactionErrorMessage } from '@/utils/c3-compaction-errors'
import { splitGraphemes } from '@/utils/grapheme'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'

interface Props {
  visible: boolean
  plan: C3CompactionPlan
  repacked: ImageData
  source: C3CompactionSource
  /** 旧网格映射元数据（来自 prepareC3Compaction 候选，与核心 analyze 一致） */
  oldGrid: {
    originX: number
    originY: number
    columns: number
  }
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const editorStore = useEditorStore()

const activeTab = ref<'sprite' | 'text'>('sprite')
const spriteMode = ref<'fit' | 'actual'>('fit')
const spriteZoom = ref(1)
const applying = ref(false)

const modalPanel = ref<HTMLElement>()
const previousFocus = ref<HTMLElement | null>(null)

const oldSpriteCanvas = ref<HTMLCanvasElement>()
const newSpriteCanvas = ref<HTMLCanvasElement>()
const oldTextCanvas = ref<HTMLCanvasElement>()
const newTextCanvas = ref<HTMLCanvasElement>()

const importedCount = computed(() =>
  splitGraphemes(editorStore.importedCharacterSet).length,
)
const appendedCount = computed(() => editorStore.c3AppendedEntries.length)

const fontSpriteWidth = computed(
  () => props.source.fontSpriteWidth,
)
const oldColumns = computed(() => props.oldGrid.columns)
const oldImportedWidth = computed(() => editorStore.originalImageWidth)
const oldImportedHeight = computed(() => editorStore.originalImageHeight)
const oldImageWidth = computed(() => editorStore.c3ImportedImage?.width ?? 0)
const oldImageHeight = computed(() => editorStore.c3ImportedImage?.height ?? 0)

const savingsPercent = computed(() => {
  const oldH = props.plan.oldFinalTextureHeight
  const newH = props.plan.newFinalTextureHeight
  if (!oldH) return 0
  return Math.round((1 - newH / oldH) * 100)
})

const oldRgbaMiB = computed(
  () => (fontSpriteWidth.value * props.plan.oldFinalTextureHeight * 4) / 1048576,
)
const newRgbaMiB = computed(
  () => (fontSpriteWidth.value * props.plan.newFinalTextureHeight * 4) / 1048576,
)

const sampleText = ref('')

// ---------- 瓶颈字符榜单 ----------
interface BottleneckEntry extends C3CellExtent {
  thumbnail: string
}

/** 缩略图统一高度（整 cell 等比缩放，保留内容与边界的相对位置） */
const THUMB_HEIGHT = 32

const bottleneckWidth = ref<BottleneckEntry[]>([])
const bottleneckHeight = ref<BottleneckEntry[]>([])

function makeCellThumbnail(index: number): string {
  const image = editorStore.c3ImportedImage
  if (!image) return ''
  const cellWidth = props.source.characterWidth
  const cellHeight = props.source.characterHeight
  const col = index % props.oldGrid.columns
  const row = Math.floor(index / props.oldGrid.columns)
  const sx = props.oldGrid.originX + col * cellWidth
  const sy = props.oldGrid.originY + row * cellHeight
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((cellWidth * THUMB_HEIGHT) / cellHeight))
  canvas.height = THUMB_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    image,
    sx,
    sy,
    cellWidth,
    cellHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas.toDataURL()
}

function buildBottlenecks() {
  try {
    const attach = (extents: C3CellExtent[]): BottleneckEntry[] =>
      extents.map((extent) => ({
        ...extent,
        thumbnail: makeCellThumbnail(extent.index),
      }))
    bottleneckWidth.value = attach(
      rankC3CellExtents(props.plan.cellExtents, 'contentWidth'),
    )
    bottleneckHeight.value = attach(
      rankC3CellExtents(props.plan.cellExtents, 'contentHeight'),
    )
  } catch (error) {
    console.error('[C3Compaction] Failed to build bottleneck list:', error)
    bottleneckWidth.value = []
    bottleneckHeight.value = []
  }
}

function round(value: number) {
  return Math.round(value * 4) / 4
}

function spriteStyle(width: number, height: number) {
  if (spriteMode.value === 'fit') {
    return { maxWidth: '100%', height: 'auto', display: 'block' }
  }
  return {
    width: `${Math.max(1, width * spriteZoom.value)}px`,
    height: `${Math.max(1, height * spriteZoom.value)}px`,
    display: 'block',
  }
}

// ---------- Sprite 预览 ----------
function drawSpritePreview() {
  try {
    if (oldSpriteCanvas.value && editorStore.c3ImportedImage) {
      const image = editorStore.c3ImportedImage
      oldSpriteCanvas.value.width = image.width
      oldSpriteCanvas.value.height = image.height
      const oldCtx = oldSpriteCanvas.value.getContext('2d')
      if (!oldCtx) {
        throw new Error('Canvas 2D context not available')
      }
      oldCtx.imageSmoothingEnabled = false
      oldCtx.clearRect(0, 0, image.width, image.height)
      oldCtx.drawImage(image, 0, 0)
    }
    if (newSpriteCanvas.value) {
      newSpriteCanvas.value.width = props.repacked.width
      newSpriteCanvas.value.height = props.repacked.height
      const newCtx = newSpriteCanvas.value.getContext('2d')
      if (!newCtx) {
        throw new Error('Canvas 2D context not available')
      }
      newCtx.imageSmoothingEnabled = false
      newCtx.clearRect(0, 0, props.repacked.width, props.repacked.height)
      newCtx.putImageData(props.repacked, 0, 0)
    }
  } catch (error) {
    console.error('[C3Compaction] Failed to draw sprite preview:', error)
    notify.error(t('c3CompactionErrorUnreliableCanvas'))
  }
}

// ---------- C3 文本预览 ----------
const TEXT_CONTAINER_WIDTH = 440

function baseTextOptions(
  sourceCanvas: HTMLCanvasElement,
  defaultStep: number,
  displayWidthMap: Map<string, number>,
): Omit<C3TextPreviewOptions, 'characterWidth' | 'characterHeight' | 'sourceGrid'> {
  const spaceWidth = displayWidthMap.has(' ')
    ? displayWidthMap.get(' ')!
    : defaultStep
  return {
    sourceCanvas,
    characterSpacing: editorStore.importedCharacterSpacing,
    lineHeight: editorStore.importedLineHeight,
    importedCharacterSet: splitGraphemes(editorStore.importedCharacterSet),
    appendedEntries: editorStore.c3AppendedEntries,
    displayWidthMap,
    spaceWidth,
    sampleText: sampleText.value,
    containerWidth: TEXT_CONTAINER_WIDTH,
    cellPadding: editorStore.baseCellConfig.padding,
    font: {
      fontFamily: editorStore.characterStyle.fontFamily,
      fontSize: editorStore.characterStyle.fontSize,
      color: editorStore.characterStyle.color,
      outline: editorStore.characterStyle.outline,
      pixelStyle: editorStore.characterStyle.pixelStyle,
    },
    currentFontFamily: editorStore.currentFont?.family,
  }
}

function renderTextPreviews() {
  try {
    if (!oldTextCanvas.value || !newTextCanvas.value) return
    const oldSource = editorStore.c3ImportedImage
      ? imageToCanvas(editorStore.c3ImportedImage)
      : document.createElement('canvas')
    const newSource = imageDataToCanvas(props.repacked)

    // 按真实迁移语义构造两侧显示宽（fail closed：spacing 非法时提示并停止预览）
    const widthMaps = buildC3TextDisplayWidthMaps({
      importedSpacingData: editorStore.importedSpacingData,
      oldCharacterWidth: props.source.characterWidth,
      appendedEntries: editorStore.c3AppendedEntries,
      globalExtraSpacing: editorStore.c3GlobalExtraSpacing,
    })
    if (widthMaps.kind === 'error') {
      notify.error(compactionErrorMessage(widthMaps.code))
      return
    }
    const { old: oldWidthMap, new: newWidthMap } = widthMaps

    const oldOptions = {
      ...baseTextOptions(oldSource, props.source.characterWidth, oldWidthMap),
      characterWidth: props.source.characterWidth,
      characterHeight: props.source.characterHeight,
      sourceGrid: props.oldGrid,
    }
    const newOptions = {
      ...baseTextOptions(newSource, props.plan.newCharacterWidth, newWidthMap),
      characterWidth: props.plan.newCharacterWidth,
      characterHeight: props.plan.newCharacterHeight,
      sourceGrid: {
        originX: 0,
        originY: 0,
        columns: props.plan.newColumns,
      },
    }

    drawTextCanvas(oldTextCanvas.value, oldOptions)
    drawTextCanvas(newTextCanvas.value, newOptions)
  } catch (error) {
    console.error('[C3Compaction] Failed to render text preview:', error)
    notify.error(t('c3CompactionErrorUnreliableCanvas'))
  }
}

function drawTextCanvas(
  canvas: HTMLCanvasElement,
  options: C3TextPreviewOptions,
) {
  canvas.width = TEXT_CONTAINER_WIDTH
  const height = renderC3TextPreview(canvas, options)
  canvas.height = height
  // 重新渲染以匹配新的 canvas 高度
  renderC3TextPreview(canvas, options)
}

function resetSampleText() {
  sampleText.value = editorStore.c3EffectiveCharacterSet
}

function cancel() {
  if (applying.value) return
  emit('close')
}

// ---------- 焦点管理（模态打开期间底层编辑器不可键盘交互） ----------
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input, [href], [tabindex]:not([tabindex="-1"])'

function focusableElements(): HTMLElement[] {
  const panel = modalPanel.value
  if (!panel) return []
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

function focusFirstControl() {
  const first = focusableElements()[0]
  first?.focus()
}

function restoreFocus() {
  previousFocus.value?.focus?.()
  previousFocus.value = null
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    // applying 中忽略 Escape，避免状态错乱
    if (!applying.value) {
      event.preventDefault()
      emit('close')
    }
    return
  }
  if (event.key !== 'Tab') return
  const focusables = focusableElements()
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey && (active === first || active === null)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/** 兜底：焦点逃逸出面板时拉回，保证底层编辑器不可键盘交互 */
function onDocumentFocusIn(event: FocusEvent) {
  if (!props.visible) return
  const panel = modalPanel.value
  if (panel && !panel.contains(event.target as Node)) {
    focusFirstControl()
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      previousFocus.value = document.activeElement as HTMLElement | null
      nextTick(() => focusFirstControl())
      document.addEventListener('focusin', onDocumentFocusIn)
    } else {
      document.removeEventListener('focusin', onDocumentFocusIn)
      restoreFocus()
    }
  },
  { immediate: true },
)

async function apply() {
  if (applying.value) return
  applying.value = true
  try {
    const result = await editorStore.applyC3SpriteCompaction(
      props.plan,
      props.repacked,
    )
    if (result.ok) {
      notify.success(t('c3CompactionApplySuccess'))
      emit('close')
    } else {
      notify.error(compactionErrorMessage(result.code))
    }
  } catch (error) {
    console.error('[C3Compaction] Apply failed:', error)
    notify.error(t('c3CompactionApplyFailed'))
  } finally {
    applying.value = false
  }
}

watch(sampleText, () => renderTextPreviews())
watch(
  () => [props.visible, activeTab.value],
  () => {
    if (!props.visible) return
    buildBottlenecks()
    if (activeTab.value === 'sprite') {
      drawSpritePreview()
    } else {
      renderTextPreviews()
    }
  },
  { flush: 'post' },
)

onMounted(() => {
  sampleText.value = editorStore.c3EffectiveCharacterSet
  buildBottlenecks()
  drawSpritePreview()
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onDocumentFocusIn)
  restoreFocus()
})
</script>

<style scoped>
.c3-compaction-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}

.c3-compaction-modal__panel {
  width: 900px;
  max-width: 94vw;
  max-height: 92vh;
  overflow-y: auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 1.25rem;
}

.c3-compaction-modal__header {
  margin-bottom: 0.75rem;
}

.c3-compaction-modal__title {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #495057;
}

.c3-compaction-modal__subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: #8a93a3;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 0.75rem;
}

.metrics__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  background-color: #f8fafc;
}

.metrics__value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.metrics__label {
  font-size: 0.6875rem;
  color: #8a93a3;
}

.bottlenecks {
  margin-bottom: 0.75rem;
  padding: 8px 10px;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  background-color: #f8fafc;
}

.bottlenecks__title {
  margin: 0 0 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b6472;
}

.bottlenecks__lists {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.bottlenecks__list {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bottlenecks__label {
  font-size: 0.6875rem;
  color: #8a93a3;
}

.bottlenecks__entries {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bottlenecks__entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.bottlenecks__thumb {
  height: 32px;
  width: auto;
  border: 1px solid #e3e8ee;
  border-radius: 4px;
  background:
    linear-gradient(45deg, #eef1f4 25%, transparent 25%, transparent 75%, #eef1f4 75%),
    linear-gradient(45deg, #eef1f4 25%, transparent 25%, transparent 75%, #eef1f4 75%);
  background-color: #fbfcfe;
  background-size: 8px 8px;
  background-position: 0 0, 4px 4px;
}

.bottlenecks__value {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #1f2937;
}

.view-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.view-tabs__tab {
  padding: 4px 14px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 0.8125rem;
  color: #5b6472;
  cursor: pointer;
}

.view-tabs__tab--active {
  background-color: #007bff;
  color: #fff;
}

.sprite-view__toolbar,
.text-view__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.sprite-view__zoom,
.text-view__label {
  font-size: 0.75rem;
  color: #8a93a3;
  margin-left: 8px;
}

.sprite-view__zoom-value {
  min-width: 44px;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 600;
}

.sprite-view__panes,
.text-view__panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.sprite-view__pane,
.text-view__pane {
  min-width: 0;
}

.sprite-view__title,
.text-view__title {
  margin: 0 0 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #495057;
}

.preview-canvas-wrap {
  max-height: 340px;
  overflow: auto;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  background:
    linear-gradient(45deg, #eef1f4 25%, transparent 25%, transparent 75%, #eef1f4 75%),
    linear-gradient(45deg, #eef1f4 25%, transparent 25%, transparent 75%, #eef1f4 75%);
  background-color: #fbfcfe;
  background-size: 12px 12px;
  background-position: 0 0, 6px 6px;
}

.text-view__input {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.8125rem;
  color: #1f2937;
}

.text-view__input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.text-view__canvas {
  display: block;
  max-width: 100%;
}

.config-diff {
  margin-top: 0.75rem;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  background-color: #f8fafc;
}

.config-diff summary {
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b6472;
}

.config-diff__code {
  margin: 0;
  padding: 0 10px 10px;
  font-size: 0.6875rem;
  line-height: 1.6;
  color: #6c757d;
  white-space: pre-wrap;
}

.caveats {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
  color: #6c5b3a;
}

.caveats li::before {
  content: '• ';
  color: #d9a53a;
}

.c3-compaction-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #eef1f4;
}

.btn {
  padding: 6px 16px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-sm {
  padding: 2px 10px;
  font-size: 0.8125rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: #fff;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.btn-secondary {
  background-color: #fff;
  color: #495057;
  border-color: #ced4da;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #f1f3f5;
}

.btn-outline-active {
  border-color: #007bff;
  color: #007bff;
  background-color: #eaf3ff;
}
</style>
