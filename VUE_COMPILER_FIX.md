# Vue 编译器警告修复

## 问题描述

在构建过程中，Vue 编译器发出以下警告：

```
[@vue/compiler-sfc] `defineProps` is a compiler macro and no longer needs to be imported.

[@vue/compiler-sfc] `defineEmits` is a compiler macro and no longer needs to be imported.
```

## 问题原因

在 Vue 3.3+ 版本中，`defineProps` 和 `defineEmits` 是编译器宏（compiler macros），在 `<script setup>` 中会自动可用，无需从 'vue' 显式导入。

## 修复方法

在 `src/components/SpacingInput.vue` 中移除不必要的导入：

```typescript
// 修复前
<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

interface SpacingValue {
  // ...
}
</script>

// 修复后
<script setup lang="ts">
interface SpacingValue {
  // ...
}
</script>
```

## 技术细节

### Vue 3 编译器宏

在 Vue 3 中，以下函数在 `<script setup>` 上下文中是全局可用的编译器宏，不需要导入：

- `defineProps()` - 定义组件 props
- `defineEmits()` - 定义组件 emits
- `defineExpose()` - 暴露组件实例的属性和方法
- `withDefaults()` - 为 props 提供默认值
- `defineSlots()` - 定义插槽类型（Vue 3.3+）
- `defineModel()` - 定义 v-model（Vue 3.4+）

### 为什么不需要导入

这些函数是编译时宏（compile-time macros），在 Vue SFC 编译器处理 `.vue` 文件时会被特殊处理：

1. **类型推断**：TypeScript 能够正确推断这些宏的类型
2. **自动注入**：编译器会自动在编译后的代码中正确处理它们
3. **避免运行时依赖**：这些宏在运行时并不存在，只在编译阶段起作用

### 最佳实践

✅ **正确用法**：
```vue
<script setup lang="ts">
// 无需导入
defineProps<{
  modelValue: SpacingValue
  label?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: SpacingValue): void
  (e: 'change'): void
}>()
</script>
```

❌ **错误用法**：
```vue
<script setup lang="ts">
// Vue 3.3+ 不需要导入
import { defineProps, defineEmits } from 'vue'  // ❌ 多余

defineProps<{
  // ...
}>()
</script>
```

## 验证

修复后重新构建：

```bash
npm run build

# 输出：
# > sprite-font-editor@0.0.0 build
# > vue-tsc && vite build
#
# vite v5.4.21 building for production...
# transforming...
# ✓ 63 modules transformed.
# rendering chunks...
# computing gzip size...
# dist/index.html                   0.46 kB │ gzip:  0.30 kB
# dist/assets/index-BlenU2RT.css   12.71 kB │ gzip:  2.54 kB
# dist/assets/index-DV_3nLlp.js   124.14 kB │ gzip: 45.50 kB
# ✓ built in 504ms
```

✅ 构建成功，无警告

## 相关文件

- `src/components/SpacingInput.vue` - 修复文件

## 版本要求

- Vue: 3.3.0+
- @vue/compiler-sfc: 3.3.0+

## 参考文档

- [Vue 3 文档 - 使用 Props](https://cn.vuejs.org/guide/components/props.html)
- [Vue 3 文档 - 触发与监听事件](https://cn.vuejs.org/guide/components/events.html)
- [Vue 3 博客 - Vue 3.3 发布](https://blog.vuejs.org/posts/vue-3-3)

---

**修复日期**: 2025-12-04  
**修复版本**: Vue 3.4.x  
**影响文件**: 1 个  
**构建状态**: ✅ 成功