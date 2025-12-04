# defineModel vs defineProps/defineEmits 对比

## 代码复杂度对比

### 版本 1：传统方式（defineProps + defineEmits）

**代码行数**：67 行

```vue
<template>
  <div class="dimensions-inputs">
    <input
      :value="widthValue"
      @input="updateWidth(...)"
    >
    <span>×</span>
    <input
      :value="heightValue"
      @input="updateHeight(...)"
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  width?: number
  height?: number
  min?: number
  // ...其他 props
}

interface Emits {
  'update:width': [value?: number]
  'update:height': [value?: number]
  'change': []
}

const props = withDefaults(defineProps<Props>(), {
  min: 1,
  // ...其他默认值
})

const emit = defineEmits<Emits>()

// 需要手动创建 computed 代理
const widthValue = computed(() => props.width ?? '')
const heightValue = computed(() => props.height ?? '')

// 需要手动 emit 事件
function updateWidth(rawValue: string) {
  const numValue = rawValue ? parseInt(rawValue, 10) : undefined
  emit('update:width', numValue)
  emit('change')
}

function updateHeight(rawValue: string) {
  const numValue = rawValue ? parseInt(rawValue, 10) : undefined
  emit('update:height', numValue)
  emit('change')
}
</script>
```

**复杂度分析**：
- ✅ 需要 import computed
- ✅ 需要定义 Props 接口
- ✅ 需要定义 Emits 接口
- ✅ 需要手动创建 computed 代理
- ✅ 需要手动调用 emit
- ✅ 需要处理空值转换
- ✅ 需要记住事件名称（'update:width'）

**优点**：
- 兼容 Vue 3.3 以下版本
- 显式控制数据流
- 可以在 emit 前添加额外逻辑

---

### 版本 2：现代方式（defineModel）

**代码行数**：45 行（减少 33%）

```vue
<template>
  <div class="dimensions-inputs">
    <input
      :value="width ?? ''"
      @input="handleWidthInput"
    >
    <span>×</span>
    <input
      :value="height ?? ''"
      @input="handleHeightInput"
    >
  </div>
</template>

<script setup lang="ts">
interface Props {
  min?: number
  step?: number
  widthPlaceholder?: string
  heightPlaceholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 1,
  step: 1,
  widthPlaceholder: '宽度',
  heightPlaceholder: '高度',
})

// 一行代码定义双向绑定！
const width = defineModel<number | undefined>('width')
const height = defineModel<number | undefined>('height')

// 简单的输入处理
function handleWidthInput(event: Event) {
  const rawValue = (event.target as HTMLInputElement).value
  width.value = rawValue ? parseInt(rawValue, 10) : undefined
}

function handleHeightInput(event: Event) {
  const rawValue = (event.target as HTMLInputElement).value
  height.value = rawValue ? parseInt(rawValue, 10) : undefined
}
</script>
```

**复杂度分析**：
- ✅ 无需 import computed
- ✅ 无需定义 Emits 接口
- ✅ 无需手动创建代理
- ✅ 无需手动 emit 事件
- ✅ 直接操作 .value 即可触发更新
- ✅ 自动的类型推导

**优点**：
- 代码量减少 33%
- API 更简洁直观
- 编译器自动处理类型
- 自动支持 v-model 修饰符
- 更好的 TypeScript 支持

**缺点**：
- 需要 Vue 3.4+
- 相对较新，文档可能不够完善

---

## 父组件使用对比

### 传统方式

```vue
<template>
  <DimensionsInput
    v-model:width="editorStore.cellConfig.width"
    v-model:height="editorStore.cellConfig.height"
    :min="8"
    width-placeholder="宽度"
    height-placeholder="高度"
    @change="saveConfig"
  />
</template>

<script setup lang="ts">
function saveConfig() {
  editorStore.saveToLocalStorage()
}
</script>
```

**工作原理**：
1. `:width` 将 store 的值传递给子组件
2. 子组件通过 `computed` 代理读取值
3. 用户输入时，子组件 `emit('update:width', newValue)`
4. 父组件接收到事件，更新 store
5. store 更新触发 `:width` 重新传递新值
6. 子组件的 `computed` 重新计算
7. 输入框显示更新

**数据流**：父组件 → 子组件（prop）→ 父组件（emit）→ 子组件（prop）

---

### defineModel 方式

```vue
<template>
  <DimensionsInputDefineModel
    v-model:width="editorStore.cellConfig.width"
    v-model:height="editorStore.cellConfig.height"
    :min="8"
    width-placeholder="宽度"
    height-placeholder="高度"
  />
</template>

<script setup lang="ts">
// defineModel 不需要 @change 事件
// 如果需要监听变化，可以使用 watch
import { watch } from 'vue'

watch(() => editorStore.cellConfig.width, () => {
  editorStore.saveToLocalStorage()
})

watch(() => editorStore.cellConfig.height, () => {
  editorStore.saveToLocalStorage()
})
</script>
```

**工作原理**：
1. `defineModel` 创建响应式的 ref
2. 父组件的 v-model 绑定建立连接
3. 用户输入时，直接设置 `width.value = newValue`
4. defineModel 自动 emit update 事件
5. 父组件的绑定自动更新 store
6. store 更新通过响应式系统自动同步回子组件的模板

**数据流**：父组件 → 子组件（双向 ref）→ 父组件（响应式）

---

## 性能对比

| 指标 | 传统方式 | defineModel | 差异 |
|------|----------|-------------|------|
| 代码行数 | 67 行 | 45 行 | -33% |
| 接口定义 | Props + Emits | 仅 Props | 更简单 |
| computed | 2 个 | 0 个 | 无代理层 |
| emit 调用 | 2 处 | 0 处 | 自动生成 |
| 运行时开销 | 中等（computed） | 低（直接访问） | 更快 |
| 类型推导 | 手动 | 自动 | 更好 |
| 学习曲线 | 平缓 | 稍陡 | 新语法 |

---

## 迁移指南

### 检查 Vue 版本

```bash
npm list vue
# 确保是 3.4.0+
```

如果版本过低，先升级：
```bash
npm install vue@^3.4.0
```

### 替换组件

1. 备份原文件
2. 重命名使用 defineModel 的版本
3. 更新所有引用

```bash
# 备份
mv src/components/DimensionsInput.vue src/components/DimensionsInput.backup.vue

# 使用 defineModel 版本
mv src/components/DimensionsInput-defineModel.vue src/components/DimensionsInput.vue
```

### 更新组件名（如果使用 defineModel）

在文件中搜索 `DimensionsInputDefineModel` 并替换为 `DimensionsInput`。

### 处理 @change 事件（可选）

如果你原来依赖 `@change` 事件来触发保存：

**方案 A（推荐）**：
在父组件中使用 watch

```typescript
watch(() => editorStore.cellConfig.width, saveConfig)
watch(() => editorStore.cellConfig.height, saveConfig)
```

**方案 B**：
在子组件中自定义 emit

```typescript
const width = defineModel<number | undefined>('width')
const height = defineModel<number | undefined>('height')

// 监听变化并 emit
watch(width, (newValue) => {
  emit('change')
})
watch(height, (newValue) => {
  emit('change')
})
```

---

## SpacingInput 的 defineModel 改造

同样的原理可以应用到 SpacingInput：

```typescript
// 修改前
const props = defineProps<{
  modelValue: SpacingValue
}>()
const emit = defineEmits<{
  'update:modelValue': [value: SpacingValue]
}>()

function updateValue(key: keyof SpacingValue, rawValue: string) {
  emit('update:modelValue', { ...props.modelValue, [key]: parseInt(rawValue, 10) })
}

// 修改后
const modelValue = defineModel<SpacingValue>({ required: true })

function updateValue(key: keyof SpacingValue, rawValue: string) {
  modelValue.value = { ...modelValue.value, [key]: parseInt(rawValue, 10) }
}
```

---

## 总结

### defineModel 适合你吗？

✅ **适合使用 defineModel 如果**：
- 项目使用 Vue 3.4+
- 追求代码简洁
- 需要更好的 TypeScript 支持
- 团队愿意学习新语法

❌ **不适合使用 defineModel 如果**：
- 需要支持 Vue 3.3 或更低版本
- 需要在 emit 前执行复杂逻辑
- 团队对响应式系统理解不深
- 项目有特殊的事件处理需求

### 建议

**对于新项目**：
- ✅ 强烈推荐使用 defineModel
- ✅ 代码更简洁、可维护性更好
- ✅ 学习成本不高，收益明显

**对于现有项目**：
- 如果已经在 Vue 3.4+，可以逐步迁移
- 保留传统方式作为 fallback
- 新组件使用 defineModel

---

**对比日期**: 2025-12-04  
**Vue 版本**: 3.4.21  
**defineModel 可用**: ✅ 是  
**推荐**: ✅ defineModel 方式更简洁