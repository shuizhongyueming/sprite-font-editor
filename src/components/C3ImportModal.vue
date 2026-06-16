<template>
  <div
    v-if="visible"
    class="c3-import-modal"
    @click="close"
  >
    <div
      class="c3-import-modal__content"
      @click.stop
    >
      <div class="c3-import-modal__header">
        <h3>{{ t('c3ImportTitle') }}</h3>
        <button
          class="c3-import-modal__close"
          @click="close"
        >
          ×
        </button>
      </div>

      <div class="c3-import-modal__body">
        <div class="c3-import-modal__form-group">
          <label>{{ t('c3ImportImage') }}</label>
          <input
            ref="imageInput"
            type="file"
            accept="image/*"
            @change="handleImageChange"
          >
        </div>

        <div class="c3-import-modal__form-group">
          <label>{{ t('c3ImportArray') }}</label>
          <textarea
            v-model="arrayJson"
            class="c3-import-modal__textarea"
            rows="10"
            :placeholder="arrayPlaceholder"
          />
        </div>

        <div class="c3-import-modal__form-group">
          <label>{{ t('c3FontSpriteSize') }}</label>
          <div class="c3-import-modal__dimensions">
            <input
              v-model.number="fontSpriteWidth"
              type="number"
              class="c3-import-modal__dimension-input"
              :placeholder="t('c3FontSpriteWidth')"
              min="1"
            >
            <span class="c3-import-modal__dimension-separator">×</span>
            <input
              v-model.number="fontSpriteHeight"
              type="number"
              class="c3-import-modal__dimension-input"
              :placeholder="t('c3FontSpriteHeight')"
              min="1"
            >
          </div>
        </div>

        <div
          v-if="error"
          class="c3-import-modal__message c3-import-modal__message--error"
        >
          {{ error }}
        </div>

        <div
          v-if="summary"
          class="c3-import-modal__message c3-import-modal__message--summary"
        >
          {{ summary }}
        </div>
      </div>

      <div class="c3-import-modal__footer">
        <button
          class="btn btn-secondary"
          @click="close"
        >
          {{ t('cancel') }}
        </button>
        <button
          class="btn btn-info"
          :disabled="!canValidate"
          @click="validate"
        >
          {{ t('c3Validate') }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="!canImport"
          @click="importFont"
        >
          {{ t('c3Import') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { parseC3InstanceArray, type C3ParsedData } from '@/utils/c3-parser'
import { C3ImageStorage } from '@/utils/storage'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const editorStore = useEditorStore()

const imageInput = ref<HTMLInputElement>()
const arrayJson = ref('')
const selectedFile = ref<File | null>(null)
const selectedImage = ref<HTMLImageElement | null>(null)
const imageDimensions = ref<{ width: number; height: number } | null>(null)
const fontSpriteWidth = ref<number | undefined>(undefined)
const fontSpriteHeight = ref<number | undefined>(undefined)
const parsedData = ref<C3ParsedData | null>(null)
const error = ref('')
const summary = ref('')

watch(() => props.visible, (visible) => {
  if (visible) {
    resetForm()
  }
})

function resetForm() {
  arrayJson.value = ''
  selectedFile.value = null
  selectedImage.value = null
  imageDimensions.value = null
  fontSpriteWidth.value = undefined
  fontSpriteHeight.value = undefined
  parsedData.value = null
  error.value = ''
  summary.value = ''
  if (imageInput.value) {
    imageInput.value.value = ''
  }
}

const arrayPlaceholder = '["", true, 16, 16, "ABCDEF", "[]", 1, 0, 0, 0, 0, 0, true, null, false]'

const canValidate = computed(() => arrayJson.value.trim().length > 0)

const canImport = computed(() => {
  return parsedData.value !== null && selectedImage.value !== null && error.value === ''
})

function close() {
  emit('update:visible', false)
}

function resetValidation() {
  parsedData.value = null
  error.value = ''
  summary.value = ''
}

function handleImageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    selectedFile.value = null
    selectedImage.value = null
    imageDimensions.value = null
    return
  }

  selectedFile.value = file
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    selectedImage.value = img
    imageDimensions.value = { width: img.width, height: img.height }
    fontSpriteWidth.value = img.width
    fontSpriteHeight.value = img.height
    URL.revokeObjectURL(url)
  }
  img.onerror = () => {
    selectedImage.value = null
    imageDimensions.value = null
    fontSpriteWidth.value = undefined
    fontSpriteHeight.value = undefined
    URL.revokeObjectURL(url)
    notify.error(t('imageLoadFailed'))
  }
  img.src = url
}

function validate() {
  resetValidation()

  try {
    parsedData.value = parseC3InstanceArray(arrayJson.value.trim())
  } catch (err) {
    error.value = t('c3ImportError', {
      message: err instanceof Error ? err.message : String(err),
    })
    return
  }

  const spriteSize = getFontSpriteSize()
  if (spriteSize) {
    const dimensionError = validateImageDimensions(spriteSize, parsedData.value)
    if (dimensionError) {
      error.value = dimensionError
      return
    }
  }

  summary.value = buildSummary(parsedData.value, getFontSpriteSize())
}

function getFontSpriteSize(): { width: number; height: number } | null {
  if (
    typeof fontSpriteWidth.value === 'number' &&
    typeof fontSpriteHeight.value === 'number'
  ) {
    return {
      width: fontSpriteWidth.value,
      height: fontSpriteHeight.value,
    }
  }
  return imageDimensions.value
}

function validateImageDimensions(
  dimensions: { width: number; height: number },
  parsed: C3ParsedData,
): string {
  const { width, height } = dimensions
  const { characterWidth, characterHeight, characterSet } = parsed

  if (width <= 0 || height <= 0) {
    return ''
  }

  const cols = Math.floor(width / characterWidth)
  const rows = Math.floor(height / characterHeight)
  const capacity = cols * rows

  if (characterSet.length > capacity) {
    return t('c3ImageTooSmallError', {
      capacity: String(capacity),
      count: String(characterSet.length),
    })
  }

  return ''
}

function buildSummary(
  parsed: C3ParsedData,
  dimensions: { width: number; height: number } | null,
): string {
  const base = t('c3ParseSuccess', { count: parsed.characterSet.length })

  if (!dimensions) {
    return base
  }

  const cols = Math.floor(dimensions.width / parsed.characterWidth)
  const rows = Math.floor(dimensions.height / parsed.characterHeight)
  const capacity = cols * rows
  const omitted = Math.max(0, parsed.characterSet.length - capacity)

  if (omitted > 0) {
    return `${base}; ${t('c3ImageTooSmallError', {
      capacity: String(capacity),
      count: String(parsed.characterSet.length),
    })}`
  }

  return `${base}; ${cols} × ${rows} cells`
}

async function importFont() {
  if (!parsedData.value || !selectedImage.value || !selectedFile.value) {
    return
  }

  if (editorStore.isC3Mode) {
    const confirmed = confirm(t('c3ReimportConfirm'))
    if (!confirmed) {
      return
    }
  }

  try {
    const array = JSON.parse(arrayJson.value.trim()) as [
      string,
      boolean,
      number,
      number,
      string,
      string,
      number,
      number,
      number,
      number,
      number,
      number,
      boolean,
      unknown,
      boolean,
      ...unknown[]
    ]

    const spriteSize = getFontSpriteSize()

    editorStore.importC3SpriteFont(
      selectedImage.value,
      array,
      parsedData.value,
      selectedFile.value.name,
      spriteSize?.width,
      spriteSize?.height,
      selectedFile.value.type,
    )

    const blob = selectedFile.value.slice(0, selectedFile.value.size, selectedFile.value.type)
    await C3ImageStorage.save(blob, selectedImage.value.width, selectedImage.value.height)

    notify.success(t('c3ImportSuccess'))
    close()
  } catch (err) {
    console.error('C3 import failed:', err)
    error.value = t('c3ImportError', {
      message: err instanceof Error ? err.message : String(err),
    })
    notify.error(t('c3ImportError', {
      message: err instanceof Error ? err.message : String(err),
    }))
  }
}
</script>

<style scoped>
.c3-import-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}

.c3-import-modal__content {
  width: 520px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.c3-import-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.c3-import-modal__header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #495057;
}

.c3-import-modal__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6c757d;
  cursor: pointer;
  line-height: 1;
}

.c3-import-modal__close:hover {
  color: #495057;
}

.c3-import-modal__body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.c3-import-modal__form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.c3-import-modal__form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.c3-import-modal__form-group input[type="file"] {
  font-size: 0.875rem;
}

.c3-import-modal__textarea {
  width: 100%;
  min-height: 160px;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8125rem;
  resize: vertical;
  box-sizing: border-box;
}

.c3-import-modal__textarea:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.c3-import-modal__dimensions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.c3-import-modal__dimension-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  text-align: center;
}

.c3-import-modal__dimension-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.c3-import-modal__dimension-separator {
  color: #6c757d;
  font-weight: 500;
  user-select: none;
}

.c3-import-modal__message {
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.c3-import-modal__message--error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.c3-import-modal__message--summary {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.c3-import-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #dee2e6;
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

.btn-info {
  background-color: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.btn-info:hover:not(:disabled) {
  background-color: #117a8b;
  border-color: #117a8b;
}
</style>
