<template>
  <div class="toolbar-container">
    <div class="toolbar-left">
      <button
        class="btn btn-primary"
        @click="uploadImage"
      >
        {{ t('uploadImage') }}
      </button>
      <button
        class="btn btn-secondary"
        @click="uploadFont"
      >
        {{ t('uploadFont') }}
      </button>
      <button
        class="btn btn-success"
        :disabled="!hasBaseImage"
        @click="autoDetectGrid"
      >
        {{ t('autoDetectGrid') }}
      </button>
      <button
        class="btn btn-info"
        :disabled="!canExport"
        @click="exportImage"
      >
        {{ t('exportPNG') }}
      </button>
    </div>

    <div class="toolbar-center">
      <div class="control-item">
        <span>{{ t('insertPoint') }}</span>
        <SegmentControl
          v-model="insertPointMode"
          :options="insertPointOptions"
        />
      </div>
    </div>

    <div class="toolbar-center">
      <div class="control-item">
        <span>{{ t('canvasBackground') }}</span>
        <SegmentControl
          v-model="canvasBgValue"
          :options="canvasBgOptions"
        />
      </div>
    </div>

    <div class="toolbar-right">
      <!-- 语言切换下拉框 -->
      <div class="language-dropdown">
        <button
          class="btn btn-language"
          @click="toggleDropdown"
        >
          {{ t('switchLanguage') }}
          <span class="dropdown-arrow">▼</span>
        </button>
        <div
          v-show="showDropdown"
          class="dropdown-menu"
        >
          <div
            class="dropdown-item"
            :class="{ active: currentLocale === 'zh-CN' }"
            @click="selectLanguage('zh-CN')"
          >
            <span class="lang-name">中文</span>
            <span class="lang-check" v-if="currentLocale === 'zh-CN'">✓</span>
          </div>
          <div
            class="dropdown-item"
            :class="{ active: currentLocale === 'en-US' }"
            @click="selectLanguage('en-US')"
          >
            <span class="lang-name">English</span>
            <span class="lang-check" v-if="currentLocale === 'en-US'">✓</span>
          </div>
        </div>
      </div>

      <button
        class="btn btn-danger"
        @click="clearAll"
      >
        {{ t('clearAll') }}
      </button>

      <a
        href="https://github.com/shuizhongyueming/sprite-font-editor"
        target="_blank"
        rel="noopener noreferrer"
        class="github-link"
        title="GitHub"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="imageInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleImageUpload"
    >
    <input
      ref="fontInput"
      type="file"
      accept=".ttf,.otf,.woff,.woff2"
      style="display: none"
      @change="handleFontUpload"
    >
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { isValidImageFile, isValidFontFile } from '@/utils/file'
import { exportWithOriginalSize } from '@/utils/download'
import { notify } from '@/utils/notification'
import { t, getLocale, setLanguage } from '@/utils/i18n'
import SegmentControl from './SegmentControl.vue'

type Locale = 'zh-CN' | 'en-US'
type CanvasBgType = 'white' | 'black' | 'checkerboard'

const editorStore = useEditorStore()

const imageInput = ref<HTMLInputElement>()
const fontInput = ref<HTMLInputElement>()
const showDropdown = ref(false)
const currentLocale = computed(() => getLocale())

const insertPointMode = computed({
  get: () => editorStore.insertPointConfig.mode,
  set: (value: 'auto' | 'manual') => {
    editorStore.insertPointConfig.mode = value
    editorStore.saveToLocalStorage()

    // 如果切换到自动模式，触发插入点检测
    if (value === 'auto' && editorStore.canvasLayer) {
      console.log('[Toolbar] 切换到自动模式，开始检测插入点')
      setTimeout(() => {
        if (editorStore.canvasLayer) {
          editorStore.detectInsertPoints(editorStore.canvasLayer)
        }
      }, 50)
    }
  }
})

const canvasBgValue = computed({
  get: () => editorStore.canvasBg,
  set: (value: CanvasBgType) => {
    editorStore.canvasBg = value
    editorStore.saveToLocalStorage()
  }
})

const insertPointOptions = computed(() => [
  { value: 'auto', label: t('autoMode') },
  { value: 'manual', label: t('manualMode') },
])

const canvasBgOptions = computed(() => [
  { value: 'white', label: t('bgWhite') },
  { value: 'black', label: t('bgBlack') },
  { value: 'checkerboard', label: t('bgCheckerboard') },
])

const canRender = computed(() => {
  return editorStore.baseImage &&
         editorStore.currentFont &&
         editorStore.characterEntries.length > 0
})

const canExport = computed(() => {
  return editorStore.baseImage !== null
})

const hasBaseImage = computed(() => {
  return editorStore.baseImage !== null
})

function uploadImage() {
  imageInput.value?.click()
}

function uploadFont() {
  fontInput.value?.click()
}

function autoDetectGrid() {
  editorStore.autoDetectGrid()
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function selectLanguage(locale: Locale) {
  setLanguage(locale)
  showDropdown.value = false
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.language-dropdown')) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

async function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!isValidImageFile(file)) {
    notify.warning(t('invalidImageFile'))
    return
  }

  try {
    const blob = file.slice(0, file.size, file.type)
    const image = new Image()
    image.onload = () => {
      // 传递 blob 以便保存到 IndexedDB
      editorStore.setBaseImage(image, blob)
      editorStore.saveToLocalStorage()
    };
    image.onerror = (error) => {
      console.error('Failed to load image:', error)
    };
    image.src = URL.createObjectURL(blob)
  } catch (error) {
    console.error('Failed to load image:', error)
    notify.error(t('imageLoadFailed'))
  }
}

async function handleFontUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!isValidFontFile(file)) {
    notify.warning(t('invalidFontFile'))
    return
  }

  try {
    const data = await file.arrayBuffer()
    // 使用不带扩展名的名称作为 font family
    const fontName = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, '')
    const fontFace = new FontFace(fontName, data)
    await fontFace.load()

    // 注册字体
    document.fonts.add(fontFace)

    // 传递数据以便保存到 IndexedDB
    editorStore.setFont(fontFace, data)
    editorStore.saveToLocalStorage()

    notify.success(t('fontLoadSuccess'))
  } catch (error) {
    console.error('Failed to load font:', error)
    notify.error(t('fontLoadFailed'))
  }
}

async function exportImage() {
  try {
    if (!editorStore.baseImage) {
      notify.warning(t('pleaseUploadImage'))
      return
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `sprite-font-${timestamp}.png`

    // 使用原始尺寸导出，直接使用 base 配置
    await exportWithOriginalSize(
      editorStore.baseImage,
      editorStore.baseCellConfig,
      editorStore.baseImageConfig,
      editorStore.characterEntries,
      editorStore.characterStyle,
      editorStore.cellAlignment,
      editorStore.insertPointConfig,
      filename
    )

    notify.success(t('exportSuccess'))
    console.log('Image exported successfully', filename)
  } catch (error) {
    console.error('Export failed:', error)
    notify.error(t('exportFailed'))
  }
}

function clearAll() {
  if (confirm(t('confirmClear'))) {
    editorStore.clearAllData()
    notify.info(t('cleared'))
  }
}
</script>

<style scoped>
.toolbar-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  gap: 1rem;
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-center {
  flex: 1;
  justify-content: center;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
  border-color: #0056b3;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #545b62;
  border-color: #545b62;
}

.btn-language {
  background-color: #6c757d;
  color: white;
  border-color: #6c757d;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-language:hover {
  background-color: #545b62;
  border-color: #545b62;
}

.dropdown-arrow {
  font-size: 0.625rem;
  margin-left: 0.25rem;
}

.btn-success {
  background-color: #28a745;
  color: white;
  border-color: #28a745;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
  border-color: #1e7e34;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.btn-info:hover:not(:disabled) {
  background-color: #117a8b;
  border-color: #117a8b;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border-color: #dc3545;
}

.btn-danger:hover:not(:disabled) {
  background-color: #bd2130;
  border-color: #bd2130;
}

/* 语言下拉框样式 */
.language-dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 120px;
  z-index: 1000;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
}

.dropdown-item.active {
  background-color: #007bff;
  color: white;
}

.lang-name {
  font-size: 0.875rem;
}

.lang-check {
  font-size: 0.75rem;
}

/* Control Item */
.control-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-item > span {
  font-size: 0.875rem;
  color: #495057;
  white-space: nowrap;
}

.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  color: #495057;
  background-color: #f8f9fa;
  border: 1px solid #ced4da;
  transition: all 0.15s;
}

.github-link:hover {
  color: #333;
  background-color: #e9ecef;
  border-color: #adb5bd;
}
</style>
