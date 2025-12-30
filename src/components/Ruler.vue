<template>
  <!-- 标尺组件 - 使用绝对定位，不依赖容器尺寸 -->
  <div class="ruler-wrapper">
    <!-- 顶部横向标尺 -->
    <div
      v-if="position === 'top'"
      class="ruler ruler-top"
      :style="{ width: `${width}px`, height: `${rulerSize}px` }"
    >
      <div class="ruler-scale">
        <div
          v-for="tick in horizontalTicks"
          :key="`h-${tick.position}`"
          class="ruler-tick"
          :class="{
            major: tick.isMajor,
            'char-highlight': tick.isCharHighlight,
            'insert-point-highlight': tick.isInsertPointHighlight
          }"
          :style="{ left: `${tick.position}px` }"
        >
          <span
            v-if="tick.isMajor"
            class="ruler-label"
            :class="{
              'char-highlight-label': tick.isCharHighlight,
              'insert-point-highlight-label': tick.isInsertPointHighlight
            }"
          >{{ tick.label }}</span>
        </div>
      </div>
    </div>
    
    <!-- 左侧纵向标尺 -->
    <div
      v-if="position === 'left'"
      class="ruler ruler-left"
      :style="{ width: `${rulerSize}px`, height: `${height}px` }"
    >
      <div class="ruler-scale">
        <div
          v-for="tick in verticalTicks"
          :key="`v-${tick.position}`"
          class="ruler-tick"
          :class="{
            major: tick.isMajor,
            'char-highlight': tick.isCharHighlight,
            'insert-point-highlight': tick.isInsertPointHighlight
          }"
          :style="{ top: `${tick.position}px` }"
        >
          <span
            v-if="tick.isMajor"
            class="ruler-label"
            :class="{
              'char-highlight-label': tick.isCharHighlight,
              'insert-point-highlight-label': tick.isInsertPointHighlight
            }"
          >{{ tick.label }}</span>
        </div>
      </div>
    </div>
    
    <!-- 左上角角落 -->
    <div
      v-if="position === 'corner'"
      class="ruler-corner"
      :style="{ width: `${rulerSize}px`, height: `${rulerSize}px` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface RulerTick {
  position: number
  isMajor: boolean
  label?: string
  isCharHighlight: boolean
  isInsertPointHighlight: boolean
}

interface Props {
  position: 'top' | 'left' | 'corner'
  width: number
  height: number
  cellWidth: number
  cellHeight: number
  cellMargin: { top: number; right: number; bottom: number; left: number }
  highlightRow: number | null
  highlightCol: number | null
  insertPointRow: number | null
  insertPointCol: number | null
  rulerSize?: number
  imageMargin?: { top: number; right: number; bottom: number; left: number }
  imagePadding?: { top: number; right: number; bottom: number; left: number }
  fontSpriteWidth?: number
  fontSpriteHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  rulerSize: 20,
  imageMargin: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  imagePadding: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
})

const horizontalTicks = computed<RulerTick[]>(() => {
  const ticks: RulerTick[] = []
  const step = props.cellWidth + props.cellMargin.left + props.cellMargin.right

  const startOffset = props.imageMargin.left + props.imagePadding.left

  for (let i = startOffset; i <= props.width; i += step) {
    const colIndex = Math.floor((i - startOffset) / step)
    const isCharHighlight = props.highlightCol !== null && colIndex === props.highlightCol
    const isInsertPointHighlight = props.insertPointCol !== null && colIndex === props.insertPointCol

    ticks.push({
      position: i,
      isMajor: true,
      label: colIndex.toString(),
      isCharHighlight,
      isInsertPointHighlight
    })
  }

  return ticks
})

const verticalTicks = computed<RulerTick[]>(() => {
  const ticks: RulerTick[] = []
  const step = props.cellHeight + props.cellMargin.top + props.cellMargin.bottom

  const startOffset = props.imageMargin.top + props.imagePadding.top

  for (let i = startOffset; i <= props.height; i += step) {
    const rowIndex = Math.floor((i - startOffset) / step)
    const isCharHighlight = props.highlightRow !== null && rowIndex === props.highlightRow
    const isInsertPointHighlight = props.insertPointRow !== null && rowIndex === props.insertPointRow

    ticks.push({
      position: i,
      isMajor: true,
      label: rowIndex.toString(),
      isCharHighlight,
      isInsertPointHighlight
    })
  }

  return ticks
})
</script>

<style scoped>
.ruler-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ruler {
  position: absolute;
  background: #f0f0f0;
  border-color: #999;
  border-style: solid;
  border-width: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

.ruler-top {
  top: 0;
  left: 20px;
  border-bottom-width: 1px;
}

.ruler-left {
  top: 20px;
  left: 0;
  border-right-width: 1px;
}

.ruler-corner {
  position: absolute;
  top: 0;
  left: 0;
  background: #e0e0e0;
  border-right: 1px solid #999;
  border-bottom: 1px solid #999;
  z-index: 51;
}

.ruler-scale {
  position: relative;
  width: 100%;
  height: 100%;
}

.ruler-tick {
  position: absolute;
  background: #666;
  transition: all 0.2s;
}

.ruler-top .ruler-tick {
  width: 1px;
  height: 6px;
  bottom: 0;
}

.ruler-top .ruler-tick.major {
  height: 10px;
}

.ruler-top .ruler-tick.char-highlight {
  background: #28a745;
  height: 14px;
  box-shadow: 0 0 4px rgba(40, 167, 69, 0.5);
}

.ruler-top .ruler-tick.insert-point-highlight {
  background: #ff0000;
  height: 14px;
  box-shadow: 0 0 6px rgba(255, 0, 0, 0.6);
}

.ruler-left .ruler-tick {
  height: 1px;
  width: 6px;
  right: 0;
}

.ruler-left .ruler-tick.major {
  width: 10px;
}

.ruler-left .ruler-tick.char-highlight {
  background: #28a745;
  width: 14px;
  box-shadow: 0 0 4px rgba(40, 167, 69, 0.5);
}

.ruler-left .ruler-tick.insert-point-highlight {
  background: #ff0000;
  width: 14px;
  box-shadow: 0 0 6px rgba(255, 0, 0, 0.6);
}

.ruler-label {
  position: absolute;
  font-size: 9px;
  color: #666;
  font-weight: 500;
  user-select: none;
  pointer-events: none;
}

.ruler-top .ruler-label {
  bottom: 2px;
  left: 4px;
  transform: translateY(0);
}

.ruler-left .ruler-label {
  right: 2px;
  top: 4px;
  transform: translateX(0);
}

.ruler-tick.char-highlight .ruler-label {
  color: #28a745;
  font-weight: bold;
}

.ruler-tick.insert-point-highlight .ruler-label {
  color: #ff0000;
  font-weight: bold;
}
</style>