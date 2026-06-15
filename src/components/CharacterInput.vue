<template>
  <div class="character-input">
    <!-- C3 追加模式 -->
    <template v-if="editorStore.isC3Mode">
      <div class="form-group">
        <label>{{ t('c3AppendPlaceholder') }}</label>
        <textarea
          v-model="appendInput"
          class="form-control text-input"
          :class="{ 'is-invalid': hasValidationError }"
          :placeholder="t('c3AppendPlaceholder')"
          rows="2"
          @input="handleAppendInput"
        />
        <div
          v-if="validationMessage"
          class="invalid-feedback"
        >
          {{ validationMessage }}
        </div>
      </div>

      <!-- 已导入字符 -->
      <div
        v-if="importedCharacters.length > 0"
        class="character-section"
      >
        <div class="section-title">
          {{ t('c3ImportedCount', { count: importedCharacters.length }) }}
        </div>
        <div class="character-items character-items--readonly">
          <div
            v-for="(char, index) in visibleImportedCharacters"
            :key="`imported-${index}`"
            class="character-item character-item--readonly"
          >
            <span class="character-char">{{ char }}</span>
          </div>
        </div>

        <div
          v-if="hasMoreImported"
          class="button-group button-group--toggle-only"
        >
          <span class="character-count">
            {{ t('c3ImportedCount', { count: importedCharacters.length }) }}
          </span>
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="toggleImportedExpanded"
          >
            {{ isImportedExpanded ? t('c3ShowLess') : t('c3ShowMore') }}
          </button>
        </div>
      </div>

      <!-- 已追加字符 -->
      <div
        v-if="appendedEntries.length > 0"
        class="character-section"
      >
        <div class="section-title">
          {{ t('c3AppendedCount', { count: appendedEntries.length }) }}
        </div>
        <div class="character-items">
          <div
            v-for="{ entry, index } in visibleAppendedEntries"
            :key="`appended-${index}`"
            class="character-item"
            :class="{ active: editorStore.selectedCharIndex === index }"
            :title="`${t('clickToHighlight')}: ${entry.char}`"
            @click="selectAppendedCharacter(index)"
          >
            <span class="character-char">{{ entry.char }}</span>
            <span class="character-index">{{ index + 1 }}</span>
            <span class="display-width-badge">
              {{ entry.autoDisplayWidth + editorStore.c3GlobalExtraSpacing + entry.extraSpacing }}
            </span>
            <button
              class="delete-char-btn"
              @click.stop="deleteAppendedCharacter(index)"
            >
              ×
            </button>
          </div>
        </div>

        <div class="button-group">
          <span class="character-count">
            {{ t('c3AppendedCount', { count: appendedEntries.length }) }}
          </span>
          <div class="button-group__actions">
            <button
              v-if="hasMoreAppended"
              class="btn btn-sm btn-outline-secondary"
              @click="toggleAppendedExpanded"
            >
              {{ isAppendedExpanded ? t('c3ShowLess') : t('c3ShowMore') }}
            </button>
            <button
              class="btn btn-sm btn-outline-danger"
              @click="clearAppendedCharacters"
            >
              {{ t('clear') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 普通模式 -->
    <template v-else>
      <div class="form-group">
        <label>{{ t('inputText') }}</label>
        <textarea
          v-model="textInput"
          class="form-control text-input"
          :placeholder="t('inputTextPlaceholder')"
          rows="3"
          @input="handleTextInput"
        />
      </div>

      <!-- 字符列表和按钮 -->
      <div
        v-if="characterEntries.length > 0"
        class="character-controls"
      >
        <!-- 紧凑的字符列表（单行） -->
        <div class="character-scroll-container">
          <div class="character-items">
            <div
              v-for="(entry, index) in characterEntries"
              :key="index"
              class="character-item"
              :class="{ active: editorStore.selectedCharIndex === index }"
              :title="`${t('clickToHighlight')}: ${entry.char}`"
              @click="selectCharacter(index)"
            >
              <span class="character-char">{{ entry.char }}</span>
              <span class="character-index">{{ index + 1 }}</span>

              <!-- 边距显示（只读） -->
              <div class="margin-preview">
                <div class="margin-icon">
                  <span
                    class="margin-value"
                    :style="{ top: 0 }"
                  >{{ entry.margin.top }}</span>
                  <span
                    class="margin-value"
                    :style="{ right: 0 }"
                  >{{ entry.margin.right }}</span>
                  <span
                    class="margin-value"
                    :style="{ bottom: 0 }"
                  >{{ entry.margin.bottom }}</span>
                  <span
                    class="margin-value"
                    :style="{ left: 0 }"
                  >{{ entry.margin.left }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="button-group">
          <span class="character-count">{{ t('charCount', { count: characterEntries.length }) }}</span>
          <button
            class="btn btn-sm btn-outline-danger"
            @click="clearCharacters"
          >
            {{ t('clear') }}
          </button>
          <button
            class="btn btn-sm btn-success"
            :disabled="!canRender"
            @click="renderCharacters"
          >
            {{ t('renderText') }}
          </button>
        </div>
      </div>
    </template>

    <!-- 边距/显示宽度编辑弹窗 -->
    <div
      v-if="editorStore.selectedCharIndex !== null"
      ref="marginPopup"
      class="margin-popup"
      :style="popupPosition"
    >
      <div class="popup-header">
        <span>{{ t('editMargin') }} "{{ selectedChar }}"</span>
        <button
          class="close-btn"
          @click="editorStore.selectedCharIndex = null"
        >
          ×
        </button>
      </div>
      <SpacingInput
        v-model="selectedCharMargin"
        :label="t('marginLabel')"
        :readonly-top="editorStore.isC3Mode && editorStore.cellAlignment.vertical !== 'top'"
        @change="saveMargin"
      />
      <div
        v-if="editorStore.isC3Mode && editorStore.cellAlignment.vertical !== 'top'"
        class="auto-margin-hint"
      >
        {{ t('topAlign') }}: {{ selectedCharMargin.top }}
      </div>
      <div
        v-if="editorStore.isC3Mode && selectedAppendedEntry"
        class="display-width-section"
      >
        <label>{{ t('c3AutoDisplayWidth') }}</label>
        <div class="display-width-row">
          <input
            :value="selectedAppendedEntry.autoDisplayWidth"
            type="number"
            class="form-control display-width-input"
            readonly
          >
        </div>

        <label>{{ t('c3ExtraSpacing') }}</label>
        <div class="display-width-row">
          <input
            :value="selectedAppendedEntry.extraSpacing"
            type="number"
            class="form-control display-width-input"
            @change="saveExtraSpacing"
          >
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="resetExtraSpacing"
          >
            {{ t('c3ResetExtraSpacing') }}
          </button>
        </div>

        <label>{{ t('c3FinalDisplayWidth') }}</label>
        <div class="display-width-row">
          <input
            :value="finalDisplayWidth"
            type="number"
            class="form-control display-width-input"
            readonly
          >
        </div>
      </div>
      <div class="popup-actions">
        <button
          class="btn btn-sm btn-primary"
          @click="editorStore.selectedCharIndex = null"
        >
          {{ t('confirm') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { splitGraphemes } from '@/utils/grapheme'
import SpacingInput from './SpacingInput.vue'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'

const editorStore = useEditorStore()

const textInput = ref('')
const appendInput = ref('')
const marginPopup = ref<HTMLElement>()
const duplicateChars = ref<string[]>([])
const hasSpaceError = ref(false)
const isImportedExpanded = ref(false)
const isAppendedExpanded = ref(false)
const COLLAPSED_CHARACTER_COUNT = 12

const characterEntries = computed(() => editorStore.characterEntries)
const appendedEntries = computed(() => editorStore.c3AppendedEntries)
const importedCharacters = computed(() => splitGraphemes(editorStore.importedCharacterSet))

const visibleImportedCharacters = computed(() => {
  if (isImportedExpanded.value || importedCharacters.value.length <= COLLAPSED_CHARACTER_COUNT) {
    return importedCharacters.value
  }
  return importedCharacters.value.slice(0, COLLAPSED_CHARACTER_COUNT)
})

const hasMoreImported = computed(() => importedCharacters.value.length > COLLAPSED_CHARACTER_COUNT)

const visibleAppendedEntries = computed(() => {
  if (isAppendedExpanded.value || appendedEntries.value.length <= COLLAPSED_CHARACTER_COUNT) {
    return appendedEntries.value.map((entry, index) => ({ entry, index }))
  }
  return appendedEntries.value
    .slice(0, COLLAPSED_CHARACTER_COUNT)
    .map((entry, index) => ({ entry, index }))
})

const hasMoreAppended = computed(() => appendedEntries.value.length > COLLAPSED_CHARACTER_COUNT)

const hasValidationError = computed(() => duplicateChars.value.length > 0 || hasSpaceError.value)
const validationMessage = computed(() => {
  if (hasSpaceError.value) {
    return t('c3SpaceNotAllowed')
  }
  if (duplicateChars.value.length > 0) {
    return t('c3DuplicateChars', { chars: duplicateChars.value.join(', ') })
  }
  return ''
})

const selectedChar = computed(() => {
  if (editorStore.selectedCharIndex === null) return ''

  if (editorStore.isC3Mode) {
    return appendedEntries.value[editorStore.selectedCharIndex]?.char || ''
  }

  return characterEntries.value[editorStore.selectedCharIndex]?.char || ''
})

const selectedAppendedEntry = computed(() => {
  if (!editorStore.isC3Mode || editorStore.selectedCharIndex === null) return null
  return appendedEntries.value[editorStore.selectedCharIndex] || null
})

const finalDisplayWidth = computed(() => {
  const entry = selectedAppendedEntry.value
  if (!entry) return 0
  return entry.autoDisplayWidth + editorStore.c3GlobalExtraSpacing + entry.extraSpacing
})

const selectedCharMargin = computed({
  get: () => {
    if (editorStore.selectedCharIndex === null) {
      return { top: 0, right: 0, bottom: 0, left: 0 }
    }

    if (editorStore.isC3Mode) {
      return appendedEntries.value[editorStore.selectedCharIndex]?.margin || { top: 0, right: 0, bottom: 0, left: 0 }
    }

    return characterEntries.value[editorStore.selectedCharIndex]?.margin || { top: 0, right: 0, bottom: 0, left: 0 }
  },
  set: (value) => {
    if (editorStore.selectedCharIndex === null) return

    if (editorStore.isC3Mode) {
      const entry = appendedEntries.value[editorStore.selectedCharIndex]
      if (entry) entry.margin = value
    } else {
      const entry = characterEntries.value[editorStore.selectedCharIndex]
      if (entry) entry.margin = value
    }
  }
})

const canRender = computed(() => {
  return editorStore.baseImage &&
         editorStore.currentFont &&
         editorStore.characterEntries.length > 0
})

const popupPosition = computed(() => {
  return {
    left: '0',
    bottom: '0',
    top: 'auto',
    right: 'auto',
  }
})

function handleTextInput() {
  editorStore.updateCharacters(textInput.value)
  editorStore.saveToLocalStorage()
  editorStore.selectedCharIndex = null
}

function handleAppendInput() {
  duplicateChars.value = []
  hasSpaceError.value = false

  const graphemes = splitGraphemes(appendInput.value)

  if (graphemes.length === 0) return

  if (graphemes.some((g) => g === ' ')) {
    hasSpaceError.value = true
    return
  }

  const existing = new Set([
    ...splitGraphemes(editorStore.importedCharacterSet),
    ...appendedEntries.value.map((entry) => entry.char),
  ])
  const duplicates = graphemes.filter((g) => existing.has(g))

  if (duplicates.length > 0) {
    duplicateChars.value = [...new Set(duplicates)]
    return
  }

  editorStore.appendC3Characters(graphemes)
  appendInput.value = ''
}

function clearCharacters() {
  textInput.value = ''
  editorStore.updateCharacters('')
  editorStore.saveToLocalStorage()
  editorStore.selectedCharIndex = null
}

function selectCharacter(index: number) {
  if (editorStore.selectedCharIndex === index) {
    editorStore.selectedCharIndex = null
  } else {
    editorStore.selectedCharIndex = index
  }
}

function selectAppendedCharacter(index: number) {
  if (editorStore.selectedCharIndex === index) {
    editorStore.selectedCharIndex = null
  } else {
    editorStore.selectedCharIndex = index
  }
}

function deleteAppendedCharacter(index: number) {
  editorStore.removeC3AppendedCharacter(index)
}

function clearAppendedCharacters() {
  editorStore.clearC3AppendedCharacters()
  isAppendedExpanded.value = false
}

function toggleAppendedExpanded() {
  isAppendedExpanded.value = !isAppendedExpanded.value
}

function toggleImportedExpanded() {
  isImportedExpanded.value = !isImportedExpanded.value
}

function saveMargin() {
  editorStore.saveToLocalStorage()

  if (editorStore.baseImage) {
    editorStore.renderTrigger++
  }
}

function saveExtraSpacing(event: Event) {
  const target = event.target as HTMLInputElement
  const value = parseInt(target.value) || 0

  if (editorStore.selectedCharIndex !== null) {
    editorStore.updateC3AppendedExtraSpacing(editorStore.selectedCharIndex, value)
  }
}

function resetExtraSpacing() {
  if (editorStore.selectedCharIndex !== null) {
    editorStore.updateC3AppendedExtraSpacing(editorStore.selectedCharIndex, 0)
  }
}

function renderCharacters() {
  console.log('Rendering characters from insert point:', editorStore.insertPointConfig.startCellIndex)

  editorStore.renderTrigger++
  editorStore.saveToLocalStorage()

  notify.success(t('renderComplete'))
}

// 点击外部关闭弹窗
function handleClickOutside(event: MouseEvent) {
  if (editorStore.selectedCharIndex !== null && marginPopup.value) {
    const target = event.target as Node
    if (!marginPopup.value.contains(target)) {
      const charElements = document.querySelectorAll('.character-item')
      let clickedOnChar = false

      charElements.forEach(el => {
        if (el.contains(target)) {
          clickedOnChar = true
        }
      })

      if (!clickedOnChar) {
        editorStore.selectedCharIndex = null
      }
    }
  }
}

// Esc键关闭弹窗
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && editorStore.selectedCharIndex !== null) {
    editorStore.selectedCharIndex = null
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)

  if (!editorStore.isC3Mode && editorStore.characterEntries.length > 0) {
    textInput.value = editorStore.characterEntries.map(e => e.char).join('')
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// 监听字符变化，更新data-*属性
watch(characterEntries, () => {
  nextTick(() => {
    const charElements = document.querySelectorAll('.character-item')
    charElements.forEach((el, index) => {
      el.setAttribute('data-char-index', index.toString())
    })
  })
}, { deep: true })
</script>

<style scoped>
.character-input {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.text-input {
  resize: vertical;
  min-height: 80px;
}

.text-input.is-invalid {
  border-color: #dc3545;
}

.text-input.is-invalid:focus {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25);
}

.invalid-feedback {
  color: #dc3545;
  font-size: 0.875rem;
}

.character-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.character-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.character-scroll-container {
  overflow: auto;
  padding-top: 2px;
  padding-bottom: 4px;
}

.character-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.character-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 0.5rem 0.5rem;
  border: 2px solid #dee2e6;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  min-width: 60px;
  transition: all 0.2s;
}

.character-item:hover {
  border-color: #007bff;
  transform: translateY(-2px);
}

.character-item.active {
  border-color: #28a745;
  background-color: #d4edda;
  box-shadow: 0 0 8px rgba(40, 167, 69, 0.3);
}

.character-item--readonly {
  cursor: default;
  background-color: #e9ecef;
}

.character-item--readonly:hover {
  border-color: #dee2e6;
  transform: none;
}

.character-char {
  font-size: 1.25rem;
  font-weight: 500;
  color: #495057;
  line-height: 1;
}

.character-index {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 0.625rem;
  color: #6c757d;
}

.display-width-badge {
  margin-top: 0.25rem;
  font-size: 0.625rem;
  color: #007bff;
  background-color: #e7f3ff;
  padding: 0.125rem 0.375rem;
  border-radius: 2px;
}

.delete-char-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background-color: #dc3545;
  color: white;
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.character-item:hover .delete-char-btn {
  opacity: 1;
}

.margin-preview {
  margin-top: 0.25rem;
}

.margin-icon {
  position: relative;
  width: 24px;
  height: 24px;
  border: 1px solid #dee2e6;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.margin-value {
  position: absolute;
  font-size: 0.5rem;
  color: #6c757d;
  background: white;
  padding: 0 2px;
  border-radius: 2px;
}

.margin-value:nth-child(1) { top: -6px; left: 50%; transform: translateX(-50%); }
.margin-value:nth-child(2) { right: -8px; top: 50%; transform: translateY(-50%); }
.margin-value:nth-child(3) { bottom: -6px; left: 50%; transform: translateX(-50%); }
.margin-value:nth-child(4) { left: -8px; top: 50%; transform: translateY(-50%); }

.char-box {
  font-size: 0.5rem;
  color: #495057;
  font-weight: bold;
}

.button-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.button-group__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.button-group--toggle-only {
  margin-top: 0.5rem;
}

.character-count {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.margin-popup {
  position: fixed;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 1rem;
  z-index: 1500;
  width: 360px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #495057;
}

.display-width-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #dee2e6;
}

.display-width-section label {
  font-weight: 500;
  font-size: 0.875rem;
  color: #495057;
}

.display-width-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.display-width-input {
  width: 80px;
  text-align: center;
}

.auto-width-hint {
  font-size: 0.75rem;
  color: #6c757d;
  white-space: nowrap;
}

.popup-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
}

:deep(.spacing-input) {
  font-size: 0.75rem;
}

:deep(.spacing-input input) {
  padding: 0.25rem;
  font-size: 0.75rem;
}

.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
}

.btn-outline-danger {
  background-color: transparent;
  color: #dc3545;
  border-color: #dc3545;
}

.btn-outline-danger:hover:not(:disabled) {
  background-color: #dc3545;
  color: white;
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

.btn-success {
  background-color: #28a745;
  color: white;
  border-color: #28a745;
}

.btn-success:hover:not(:disabled) {
  background-color: #1e7e34;
  border-color: #1e7e34;
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

.auto-margin-hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #6c757d;
}
</style>
