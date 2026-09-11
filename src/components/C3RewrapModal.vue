<!--
  C3 重排（Re-wrap）模态（issue #19）。
  顶部宽度选择器（512/1024/2048/4096 快选 chips + 自定义宽/高输入）+
  关键指标行 + Sprite / C3 文本双预览（旧/新并排），随宽度选择实时更新。
  打开即同步完成纯几何 prepare（无像素分析等待）；overlay 阻断底层编辑；
  「应用重排」只调用 editorStore.applyC3SpriteRewrap(plan, repacked)；
  取消/失败不改变 store 与持久化。
-->
<template>
  <div
    v-if="visible"
    class="c3-rewrap-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="c3-rewrap-modal-title"
  >
    <div
      ref="modalPanel"
      class="c3-rewrap-modal__panel"
      @keydown.stop="onPanelKeydown"
    >
      <header class="c3-rewrap-modal__header">
        <div>
          <h3
            id="c3-rewrap-modal-title"
            class="c3-rewrap-modal__title"
          >
            {{ t('c3RewrapModalTitle') }}
          </h3>
          <p class="c3-rewrap-modal__subtitle">
            {{ t('c3RewrapModalSubtitle', { imported: String(importedCount), appended: String(appendedCount), width: String(characterWidth), height: String(characterHeight) }) }}
          </p>
        </div>
      </header>

      <!-- 宽度选择器：快选 chips + 自定义宽/高 -->
      <section class="width-selector">
        <span class="width-selector__label">{{ t('c3RewrapWidthLabel') }}</span>
        <div class="width-selector__chips">
          <button
            v-for="chip in chips"
            :key="chip.targetWidth"
            type="button"
            class="width-chip"
            :class="{
              'width-chip--active': isChipActive(chip),
              'width-chip--most-square': chip.isMostSquare,
            }"
            :disabled="chip.disabledReason !== null"
            :title="chip.disabledReason ?? chipTitle(chip)"
            :aria-label="chip.disabledReason ?? chipTitle(chip)"
            @click="selectChip(chip)"
          >
            <span class="width-chip__width">{{ chip.targetWidth }}</span>
            <span
              v-if="chip.candidate"
              class="width-chip__annotation"
            >{{ chip.candidate.columns }} × {{ chip.candidate.rows }} → {{ chip.candidate.imageHeight }}</span>
            <span
              v-if="chip.isMostSquare"
              class="width-chip__badge"
            >{{ t('c3RewrapChipMostSquare') }}</span>
          </button>
        </div>
        <div class="width-selector__custom">
          <label class="width-selector__field">
            <span class="width-selector__field-label">{{ t('width') }}</span>
            <input
              v-model="widthDraft"
              type="number"
              min="1"
              class="width-selector__input"
              data-testid="rewrap-custom-width"
              @input="onDraftInput"
            >
          </label>
          <label class="width-selector__field">
            <span class="width-selector__field-label">{{ t('height') }}</span>
            <input
              v-model="heightDraft"
              type="number"
              min="1"
              class="width-selector__input"
              data-testid="rewrap-custom-height"
              @input="onDraftInput"
            >
          </label>
        </div>
        <p
          v-if="widthError"
          class="width-selector__error"
          role="alert"
        >
          {{ widthError }}
        </p>
        <p
          v-else-if="heightError"
          class="width-selector__error"
          role="alert"
        >
          {{ heightError }}
        </p>
      </section>

      <!-- 关键指标 -->
      <div class="metrics">
        <div class="metrics__item">
          <span class="metrics__value">{{ plan ? plan.targetWidth : t('N_A') }}</span>
          <span class="metrics__label">{{ t('c3RewrapMetricWidth') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ plan ? `${plan.oldColumns} → ${plan.newColumns}` : t('N_A') }}</span>
          <span class="metrics__label">{{ t('c3RewrapMetricColumns') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ finalTextureLabel }}</span>
          <span class="metrics__label">{{ t('c3RewrapMetricFinal') }}</span>
        </div>
        <div class="metrics__item">
          <span class="metrics__value">{{ rgbaLabel }}</span>
          <span class="metrics__label">{{ t('c3RewrapMetricRgba') }}</span>
        </div>
      </div>

      <!-- prepare 阻断 / no-layout-change 提示 -->
      <p
        v-if="issueBanner"
        class="issue-banner"
        :class="issueBanner.error ? 'issue-banner--error' : 'issue-banner--info'"
        role="alert"
      >
        {{ issueBanner.text }}
      </p>

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
          {{ t('c3RewrapTabSprite') }}
        </button>
        <button
          type="button"
          class="view-tabs__tab"
          :class="{ 'view-tabs__tab--active': activeTab === 'text' }"
          @click="activeTab = 'text'"
        >
          {{ t('c3RewrapTabText') }}
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
            {{ t('c3RewrapZoomFit') }}
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-outline-active': spriteMode === 'actual' }"
            @click="spriteMode = 'actual'"
          >
            {{ t('c3RewrapZoomActual') }}
          </button>
          <span class="sprite-view__zoom">{{ t('c3RewrapZoom') }}</span>
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
              {{ t('c3RewrapOldBaseline') }}
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
              {{ t('c3RewrapNewBaseline') }}
            </h4>
            <div class="preview-canvas-wrap">
              <canvas
                ref="newSpriteCanvas"
                :style="spriteStyle(plan ? plan.targetWidth : 1, repacked ? repacked.height : 1)"
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
            for="c3-rewrap-sample"
          >{{ t('c3RewrapSampleText') }}</label>
          <input
            id="c3-rewrap-sample"
            v-model="sampleText"
            type="text"
            class="text-view__input"
          >
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="resetSampleText"
          >
            {{ t('c3RewrapResetSample') }}
          </button>
        </div>
        <div class="text-view__panes">
          <section class="text-view__pane">
            <h4 class="text-view__title">
              {{ t('c3RewrapOldBaseline') }}
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
              {{ t('c3RewrapNewBaseline') }}
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

      <!-- 配置变化 -->
      <details
        v-if="plan && repacked"
        class="config-diff"
      >
        <summary>{{ t('c3RewrapConfigDetails') }}</summary>
        <pre class="config-diff__code">{{ configDiffText }}</pre>
      </details>

      <ul class="caveats">
        <li>{{ t('c3RewrapCaveatCell') }}</li>
        <li>{{ t('c3RewrapCaveatNoScale') }}</li>
        <li>{{ t('c3RewrapCaveatMargin') }}</li>
        <li>{{ t('c3RewrapCaveatNoUndo') }}</li>
      </ul>

      <footer class="c3-rewrap-modal__footer">
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
          :disabled="applyDisabled"
          @click="apply"
        >
          {{ applying ? t('c3RewrapApplying') : t('c3RewrapApply') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/stores/editor'
import type {
  C3RewrapPreparationErrorCode,
  C3RewrapPreparationPlan,
} from '@/stores/editor'
import { computeOldGrid } from '@/utils/c3-compaction'
import {
  C3_MAX_TEXTURE_SIZE,
  computeC3RewrapCandidates,
  findMostSquareC3RewrapCandidate,
  type C3RewrapCandidate,
} from '@/utils/c3-rewrap'
import {
  imageToCanvas,
  imageDataToCanvas,
  renderC3TextPreview,
  buildC3TextDisplayWidthMaps,
  type C3TextPreviewOptions,
} from '@/utils/c3-preview-renderer'
import { rewrapErrorMessage } from '@/utils/c3-rewrap-errors'
import { splitGraphemes } from '@/utils/grapheme'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const editorStore = useEditorStore()

/** 快选预设宽度（规格锁定：512/1024/2048/4096，大于当前宽度的项保留可用） */
const PRESET_WIDTHS: readonly number[] = [512, 1024, 2048, 4096]

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

// ---------- 几何输入（chips 数据源，纯几何无像素分析） ----------
const characterWidth = computed(() => editorStore.baseCellConfig.width)
const characterHeight = computed(() => editorStore.baseCellConfig.height)
const importedCount = computed(() =>
  splitGraphemes(editorStore.importedCharacterSet).length,
)
const appendedCount = computed(() => editorStore.c3AppendedEntries.length)
const totalCharacterCount = computed(
  () => importedCount.value + appendedCount.value,
)

const candidates = computed(() =>
  computeC3RewrapCandidates(PRESET_WIDTHS, {
    characterWidth: characterWidth.value,
    characterHeight: characterHeight.value,
    totalCharacterCount: totalCharacterCount.value,
  }),
)
const mostSquareCandidate = computed(() =>
  findMostSquareC3RewrapCandidate(candidates.value),
)

// 当前（旧）列数：computeOldGrid 同一映射，仅由 store 尺寸推导（不读像素）
const currentColumns = computed<number | null>(() => {
  if (!editorStore.isC3Mode) return null
  const config = editorStore.baseImageConfig
  const dims = {
    width: editorStore.originalImageWidth,
    height: editorStore.originalImageHeight,
  } as ImageData
  const grid = computeOldGrid(dims, {
    fontSpriteWidth: config.fontSpriteWidth ?? editorStore.originalImageWidth,
    fontSpriteHeight: config.fontSpriteHeight ?? editorStore.originalImageHeight,
    characterWidth: characterWidth.value,
    characterHeight: characterHeight.value,
    imageMargin: config.margin,
    imagePadding: config.padding,
    importedCharacterSet: [],
    appendedCharacterCount: 0,
  })
  return grid ? grid.columns : null
})

// ---------- 宽度选择（chips + 自定义输入） ----------
interface WidthChip {
  targetWidth: number
  candidate: C3RewrapCandidate | null
  disabledReason: string | null
  isMostSquare: boolean
}

const chips = computed<WidthChip[]>(() => {
  const byWidth = new Map(
    candidates.value.map((candidate) => [candidate.targetWidth, candidate]),
  )
  const mostSquare = mostSquareCandidate.value
  return PRESET_WIDTHS.map((targetWidth) => {
    const candidate = byWidth.get(targetWidth) ?? null
    let disabledReason: string | null = null
    if (!candidate) {
      if (totalCharacterCount.value === 0) {
        disabledReason = t('c3RewrapErrorNoImportedContent')
      } else if (targetWidth < characterWidth.value) {
        disabledReason = t('c3RewrapChipTooNarrow', {
          width: characterWidth.value,
        })
      } else {
        disabledReason = t('c3RewrapChipTooTall', { max: C3_MAX_TEXTURE_SIZE })
      }
    }
    return {
      targetWidth,
      candidate,
      disabledReason,
      isMostSquare: candidate !== null && candidate === mostSquare,
    }
  })
})

function chipTitle(chip: WidthChip): string {
  if (!chip.candidate) return String(chip.targetWidth)
  return `${chip.targetWidth}: ${chip.candidate.columns} × ${chip.candidate.rows} → ${chip.candidate.imageHeight}`
}

/** 初始选择：最接近正方形的「会改变布局」候选；无则退到最方候选 */
function pickInitialWidth(): number | null {
  if (candidates.value.length === 0) return null
  const pool = candidates.value.filter(
    (candidate) =>
      currentColumns.value === null ||
      candidate.columns !== currentColumns.value,
  )
  const best = findMostSquareC3RewrapCandidate(
    pool.length > 0 ? pool : candidates.value,
  )
  return best ? best.targetWidth : null
}

const selectedChipWidth = ref<number | null>(pickInitialWidth())
// number 输入的 v-model 会被 Vue 自动转成 number，统一按文本归一化再解析
const widthDraft = ref<string | number>('')
const heightDraft = ref<string | number>('')

const widthDraftText = computed(() => String(widthDraft.value))
const heightDraftText = computed(() => String(heightDraft.value))

function isChipActive(chip: WidthChip): boolean {
  return (
    widthDraftText.value.trim() === '' &&
    selectedChipWidth.value === chip.targetWidth
  )
}

function selectChip(chip: WidthChip) {
  if (chip.disabledReason) return
  // chip 选择保持即时响应：取消输入路径的 pending debounce 后立即 prepare
  cancelPendingPrepare()
  selectedChipWidth.value = chip.targetWidth
  widthDraft.value = ''
  runPrepare()
}

/** 生效宽度：自定义输入非空时以输入为准，否则为所选 chip */
const effectiveWidth = computed<number | null>(() => {
  if (widthDraftText.value.trim() !== '') {
    return Number(widthDraftText.value)
  }
  return selectedChipWidth.value
})

const widthError = computed<string | null>(() => {
  const width = effectiveWidth.value
  if (width === null) return null
  if (!Number.isInteger(width)) return t('c3RewrapWidthErrorInteger')
  if (width < characterWidth.value) {
    return t('c3RewrapWidthErrorMin', { width: characterWidth.value })
  }
  if (width > C3_MAX_TEXTURE_SIZE) {
    return t('c3RewrapWidthErrorMax', { max: C3_MAX_TEXTURE_SIZE })
  }
  const columns = Math.floor(width / characterWidth.value)
  const rows = Math.ceil(totalCharacterCount.value / columns)
  if (rows * characterHeight.value > C3_MAX_TEXTURE_SIZE) {
    return t('c3RewrapWidthErrorTall', { max: C3_MAX_TEXTURE_SIZE })
  }
  return null
})

/** 当前生效宽度的精确密铺高度（自定义高度校验的输入层基准） */
const tilingHeight = computed<number | null>(() => {
  const width = effectiveWidth.value
  if (width === null || widthError.value) return null
  const columns = Math.floor(width / characterWidth.value)
  const rows = Math.ceil(totalCharacterCount.value / columns)
  return rows * characterHeight.value
})

const heightError = computed<string | null>(() => {
  if (heightDraftText.value.trim() === '') return null
  const height = Number(heightDraftText.value)
  if (!Number.isInteger(height)) return t('c3RewrapHeightErrorInteger')
  const tiling = tilingHeight.value
  if (tiling !== null && height < tiling) {
    return t('c3RewrapHeightErrorMin', { height: tiling })
  }
  if (height > C3_MAX_TEXTURE_SIZE) {
    return t('c3RewrapHeightErrorMax', { max: C3_MAX_TEXTURE_SIZE })
  }
  return null
})

const customOutputHeight = computed<number | null>(() => {
  if (heightDraftText.value.trim() === '' || heightError.value) return null
  return Number(heightDraftText.value)
})

// ---------- prepare（纯几何 + 像素重排，同步完成） ----------
type PrepareIssue =
  | { kind: 'no-layout-change' }
  | { kind: 'error'; code: C3RewrapPreparationErrorCode }

const preparation = ref<C3RewrapPreparationPlan | null>(null)
const prepareIssue = ref<PrepareIssue | null>(null)

function runPrepare() {
  const width = effectiveWidth.value
  if (width === null || widthError.value || heightError.value) {
    preparation.value = null
    prepareIssue.value = null
    return
  }
  const result = editorStore.prepareC3Rewrap(
    width,
    customOutputHeight.value !== null
      ? { outputHeight: customOutputHeight.value }
      : undefined,
  )
  if (result.kind === 'plan') {
    preparation.value = result
    prepareIssue.value = null
  } else {
    preparation.value = null
    prepareIssue.value =
      result.kind === 'no-layout-change'
        ? { kind: 'no-layout-change' }
        : { kind: 'error', code: result.code }
  }
}

const PREPARE_DEBOUNCE_MS = 150
let prepareTimer: ReturnType<typeof setTimeout> | null = null

function cancelPendingPrepare() {
  if (prepareTimer !== null) {
    clearTimeout(prepareTimer)
    prepareTimer = null
  }
}

/**
 * 自定义宽/高文本输入驱动的 prepare：trailing debounce。
 * 逐键全量 prepare（imageToImageData + 像素重排）在大图下可感，
 * 新输入取消旧的 pending 调用，只执行最新值。
 */
function schedulePrepare() {
  cancelPendingPrepare()
  prepareTimer = setTimeout(() => {
    prepareTimer = null
    runPrepare()
  }, PREPARE_DEBOUNCE_MS)
}

function onDraftInput() {
  schedulePrepare()
}

// 初始 prepare：与打开弹窗同步完成（纯几何，无分析等待）
runPrepare()

const issueBanner = computed<{ text: string; error: boolean } | null>(() => {
  const issue = prepareIssue.value
  if (!issue) return null
  if (issue.kind === 'no-layout-change') {
    return { text: t('c3RewrapNoLayoutChange'), error: false }
  }
  return { text: rewrapErrorMessage(issue.code), error: true }
})

const applyDisabled = computed(
  () =>
    !preparation.value ||
    applying.value ||
    widthError.value !== null ||
    heightError.value !== null,
)

// ---------- 关键指标 ----------
const plan = computed(() => preparation.value?.plan ?? null)
const repacked = computed(() => preparation.value?.repacked ?? null)
const oldImageWidth = computed(() => editorStore.c3ImportedImage?.width ?? 0)
const oldImageHeight = computed(() => editorStore.c3ImportedImage?.height ?? 0)
const oldFinalTextureWidth = computed(
  () =>
    plan.value?.oldFontSpriteWidth ??
    editorStore.baseImageConfig.fontSpriteWidth ??
    editorStore.originalImageWidth,
)
const oldFinalTextureHeight = computed(
  () =>
    plan.value?.oldFinalTextureHeight ??
    editorStore.baseImageConfig.fontSpriteHeight ??
    editorStore.originalImageHeight,
)

const oldRgbaMiB = computed(
  () =>
    (oldFinalTextureWidth.value * oldFinalTextureHeight.value * 4) / 1048576,
)
const newRgbaMiB = computed(() => {
  if (!plan.value || !repacked.value) return 0
  return (plan.value.targetWidth * repacked.value.height * 4) / 1048576
})

const finalTextureLabel = computed(() => {
  if (!plan.value || !repacked.value) return t('N_A')
  return `${oldFinalTextureWidth.value}×${oldFinalTextureHeight.value} → ${plan.value.targetWidth}×${repacked.value.height}`
})
const rgbaLabel = computed(() => {
  if (!plan.value || !repacked.value) return t('N_A')
  return `${oldRgbaMiB.value.toFixed(2)} → ${newRgbaMiB.value.toFixed(2)} MiB`
})

const configDiffText = computed(() => {
  if (!plan.value || !repacked.value) return ''
  return [
    `Font Sprite: ${oldFinalTextureWidth.value}×${oldFinalTextureHeight.value} → ${plan.value.targetWidth}×${repacked.value.height}`,
    t('c3RewrapConfigSpriteSize'),
    t('c3RewrapConfigCharSet'),
  ].join('\n')
})

// ---------- C3 文本预览的旧网格（computeOldGrid 同一映射） ----------
function currentOldGrid(): {
  originX: number
  originY: number
  columns: number
} | null {
  const prep = preparation.value
  if (!prep) return null
  const dims = {
    width: editorStore.originalImageWidth,
    height: editorStore.originalImageHeight,
  } as ImageData
  const grid = computeOldGrid(dims, prep.source)
  if (!grid) return null
  return {
    originX: prep.source.imageMargin.left + prep.source.imagePadding.left,
    originY: prep.source.imageMargin.top + prep.source.imagePadding.top,
    columns: grid.columns,
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
    if (newSpriteCanvas.value && repacked.value) {
      const data = repacked.value
      newSpriteCanvas.value.width = data.width
      newSpriteCanvas.value.height = data.height
      const newCtx = newSpriteCanvas.value.getContext('2d')
      if (!newCtx) {
        throw new Error('Canvas 2D context not available')
      }
      newCtx.imageSmoothingEnabled = false
      newCtx.clearRect(0, 0, data.width, data.height)
      newCtx.putImageData(data, 0, 0)
    }
  } catch (error) {
    console.error('[C3Rewrap] Failed to draw sprite preview:', error)
    notify.error(t('c3RewrapErrorUnreliableCanvas'))
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
    const prep = preparation.value
    if (!oldTextCanvas.value || !newTextCanvas.value || !prep) return
    const oldSource = editorStore.c3ImportedImage
      ? imageToCanvas(editorStore.c3ImportedImage)
      : document.createElement('canvas')
    const newSource = imageDataToCanvas(prep.repacked)

    // 重排不改 characterWidth：old/new 显示宽 map 同值（fail closed，spacing 非法时提示并停止）
    const widthMaps = buildC3TextDisplayWidthMaps({
      importedSpacingData: editorStore.importedSpacingData,
      oldCharacterWidth: prep.source.characterWidth,
      appendedEntries: editorStore.c3AppendedEntries,
      globalExtraSpacing: editorStore.c3GlobalExtraSpacing,
    })
    if (widthMaps.kind === 'error') {
      notify.error(rewrapErrorMessage(widthMaps.code))
      return
    }
    const displayWidthMap = widthMaps.old

    const oldGrid = currentOldGrid()
    if (!oldGrid) {
      notify.error(t('c3RewrapErrorInvalidGrid'))
      return
    }

    const oldOptions = {
      ...baseTextOptions(oldSource, prep.source.characterWidth, displayWidthMap),
      characterWidth: prep.source.characterWidth,
      characterHeight: prep.source.characterHeight,
      sourceGrid: oldGrid,
    }
    const newOptions = {
      ...baseTextOptions(newSource, prep.source.characterWidth, displayWidthMap),
      characterWidth: prep.source.characterWidth,
      characterHeight: prep.source.characterHeight,
      sourceGrid: {
        originX: 0,
        originY: 0,
        columns: prep.plan.newColumns,
      },
    }

    drawTextCanvas(oldTextCanvas.value, oldOptions)
    drawTextCanvas(newTextCanvas.value, newOptions)
  } catch (error) {
    console.error('[C3Rewrap] Failed to render text preview:', error)
    notify.error(t('c3RewrapErrorUnreliableCanvas'))
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

const sampleText = ref('')

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
  if (applying.value || !preparation.value) return
  applying.value = true
  try {
    // 先绘制 busy 态（按钮禁用 + 文案）再执行原子应用
    await nextTick()
    const prep = preparation.value
    const result = await editorStore.applyC3SpriteRewrap(prep.plan, prep.repacked)
    if (result.ok) {
      notify.success(t('c3RewrapApplySuccess'))
      emit('close')
    } else {
      notify.error(rewrapErrorMessage(result.code))
    }
  } catch (error) {
    console.error('[C3Rewrap] Apply failed:', error)
    notify.error(t('c3RewrapApplyFailed'))
  } finally {
    applying.value = false
  }
}

watch(sampleText, () => renderTextPreviews())
watch(
  [() => props.visible, activeTab, preparation],
  () => {
    if (!props.visible) return
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
  // 初始 prepare 在 watch 注册前完成（setup 同步 runPrepare），
  // 需主动绘制首帧 sprite 预览（镜像精简弹窗）
  drawSpritePreview()
})

onBeforeUnmount(() => {
  cancelPendingPrepare()
  document.removeEventListener('focusin', onDocumentFocusIn)
  restoreFocus()
})
</script>

<style scoped>
.c3-rewrap-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}

.c3-rewrap-modal__panel {
  width: 900px;
  max-width: 94vw;
  max-height: 92vh;
  overflow-y: auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 1.25rem;
}

.c3-rewrap-modal__header {
  margin-bottom: 0.75rem;
}

.c3-rewrap-modal__title {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 600;
  color: #495057;
}

.c3-rewrap-modal__subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: #8a93a3;
}

.width-selector {
  margin-bottom: 0.75rem;
  padding: 8px 10px;
  border: 1px solid #e3e8ee;
  border-radius: 6px;
  background-color: #f8fafc;
}

.width-selector__label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b6472;
}

.width-selector__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.width-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 88px;
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.width-chip:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background-color: #f1f3f5;
}

.width-chip--active {
  border-color: #007bff;
  background-color: #eaf3ff;
}

.width-chip__width {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.width-chip--active .width-chip__width {
  color: #0056b3;
}

.width-chip__annotation {
  font-size: 0.6875rem;
  color: #8a93a3;
}

.width-chip--active .width-chip__annotation {
  color: #0056b3;
}

.width-chip__badge {
  font-size: 0.625rem;
  font-weight: 600;
  color: #d9a53a;
}

.width-selector__custom {
  display: flex;
  gap: 12px;
}

.width-selector__field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.width-selector__field-label {
  font-size: 0.75rem;
  color: #5b6472;
}

.width-selector__input {
  width: 96px;
  padding: 5px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.8125rem;
  color: #1f2937;
}

.width-selector__input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.width-selector__error {
  margin: 6px 0 0;
  font-size: 0.75rem;
  color: #bd2130;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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

.issue-banner {
  margin: 0 0 0.75rem;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.issue-banner--error {
  border: 1px solid #f5c2c7;
  background-color: #f8d7da;
  color: #842029;
}

.issue-banner--info {
  border: 1px solid #ffecb5;
  background-color: #fff3cd;
  color: #664d03;
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

.c3-rewrap-modal__footer {
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
