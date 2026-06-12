<template>
  <div
    v-if="modelValue"
    class="c3-export-modal"
    @click="close"
  >
    <div
      class="c3-export-modal__content"
      @click.stop
    >
      <div class="c3-export-modal__header">
        <h3>{{ t('c3ExportTitle') }}</h3>
        <button
          class="c3-export-modal__close"
          @click="close"
        >
          ×
        </button>
      </div>

      <div class="c3-export-modal__body">
        <textarea
          ref="jsonTextarea"
          v-model="formattedJson"
          class="c3-export-modal__textarea"
          readonly
          rows="14"
        />
      </div>

      <div class="c3-export-modal__footer">
        <button
          class="btn btn-secondary"
          @click="close"
        >
          {{ t('cancel') }}
        </button>
        <button
          class="btn btn-primary"
          @click="copyToClipboard"
        >
          {{ copyButtonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { C3InstanceArray } from '@/utils/c3-parser'
import { notify } from '@/utils/notification'
import { t } from '@/utils/i18n'

interface Props {
  modelValue: boolean
  instanceArray: C3InstanceArray | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const jsonTextarea = ref<HTMLTextAreaElement>()
const copied = ref(false)
const copyResetTimer = ref<number | null>(null)

const formattedJson = computed(() => {
  if (!props.instanceArray) {
    return ''
  }
  return JSON.stringify(props.instanceArray, null, 2)
})

const copyButtonText = computed(() => {
  return copied.value ? t('c3ExportCopied') : t('c3ExportCopy')
})

watch(() => props.modelValue, (visible) => {
  if (visible) {
    copied.value = false
  }
})

function close() {
  emit('update:modelValue', false)
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(formattedJson.value)
    copied.value = true
    notify.success(t('c3ExportCopied'))

    if (copyResetTimer.value !== null) {
      window.clearTimeout(copyResetTimer.value)
    }
    copyResetTimer.value = window.setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    notify.error(t('exportFailed'))

    // Fallback: select the text so the user can copy manually
    jsonTextarea.value?.select()
  }
}
</script>

<style scoped>
.c3-export-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}

.c3-export-modal__content {
  width: 600px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.c3-export-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.c3-export-modal__header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #495057;
}

.c3-export-modal__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6c757d;
  cursor: pointer;
  line-height: 1;
}

.c3-export-modal__close:hover {
  color: #495057;
}

.c3-export-modal__body {
  padding: 1rem;
}

.c3-export-modal__textarea {
  width: 100%;
  min-height: 260px;
  padding: 0.75rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8125rem;
  resize: vertical;
  box-sizing: border-box;
}

.c3-export-modal__textarea:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.c3-export-modal__footer {
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
</style>
