# defineModel 使用建议

## 回答你的问题

> "我对 vue 不是很熟悉，我想问一下 DimensionsInput 里面使用 defineModel 来定义 width, height 会不会更简单一些"

**答案是：✅ 会，非常简单而且更好！**

## 为什么 defineModel 更简单？

### 1. **代码量对比**

**传统方式（当前实现）**  
67 行代码 + 需要手动管理 computed + 需要手动 emit

**defineModel 方式**  
45 行代码 + 自动响应 + 自动 emit

**代码量减少 33%！**

### 2. **心智负担对比**

**传统方式你需要理解**：
- Props 如何向下传递 ✅
- Emits 如何向上传递 ✅
- v-model 是语法糖 ✅
- computed 的缓存机制 ✅
- 什么时候需要代理 props ✅

**defineModel 你只需要理解**：
- v-model 双向绑定 ✅
- ref 的 .value ✅

### 3. **出错概率对比**

**传统方式容易出的问题**：
- ❌ 忘记写 emit
- ❌ 忘记用 computed 代理
- ❌ emit 事件名拼写错误（update:width）
- ❌ 在 emit 前忘记处理数据

**defineModel 天然避免这些问题**：
- ✅ 自动 emit
- ✅ ref 天然响应式
- ✅ 编译器检查事件名
- ✅ 直接在 .value 上操作数据

## 简单代码对比

### defineModel 版本（44 行）

```vue
<template>
  <div class="dimensions-inputs">
    <input :value="width ?? ''" @input="handleWidthInput">
    <span>×</span>
    <input :value="height ?? ''" @input="handleHeightInput">
  </div>
</template>

<script setup lang="ts">
// 声明可选的配置选项（placeholder、min、step 等）
interface Props {
  min?: number
  step?: number
  widthPlaceholder?: string
  heightPlaceholder?: string
}

// 设置默认值
const props = withDefaults(defineProps<Props>(), {
  min: 1,
  widthPlaceholder: '宽度',
  heightPlaceholder: '高度',
})

// 这两行代码等于：
// const props = defineProps(['width', 'height'])
// const emit = defineEmits(['update:width', 'update:height'])
// const width = computed({ get: ..., set: ... })
// const height = computed({ get: ..., set: ... })
const width = defineModel<number | undefined>('width')
const height = defineModel<number | undefined>('height')

// 简单的输入处理函数
function handleWidthInput(event: Event) {
  // width.value 是一个 ref，修改它自动触发 emit
  const raw = (event.target as HTMLInputElement).value
  width.value = raw ? parseInt(raw, 10) : undefined
}

function handleHeightInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  height.value = raw ? parseInt(raw, 10) : undefined
}
</script>
```

**关键理解点**:
1. `defineModel` 返回的是一个 **`ref`**（类似 `const count = ref(0)`）
2. 读取值用 `width.value`
3. **重要**：在模板中直接使用 `width`（不需要 .value）
4. 修改 `width.value` 会自动触发 update 事件

### 父组件使用（相同）

```vue
<DimensionsInput
  v-model:width="editorStore.cellConfig.width"
  v-model:height="editorStore.cellConfig.height"
  :min="8"
  width-placeholder="宽度"
  height-placeholder="高度"
/>
```

父组件的用法完全一样！✨

## defineModel 的核心思维模型

把 `defineModel` 想象成：

```typescript
// 不是实际代码，只是帮助你理解

const width = defineModel<number>('width')

// 等价于下面的传统代码：

const props = defineProps({
  width: { type: Number, required: true }
})

const emit = defineEmits({
  'update:width': (value: number) => true
})

const width = computed({
  get() {
    return props.width
  },
  set(value) {
    emit('update:width', value)
  }
})

// 所以你可以这样用：
width.value = 100  // 这会 emit('update:width', 100)
console.log(width.value)  // 这会读取 props.width
```

## 如何开始使用 defineModel

### 1. 检查 Vue 版本

```bash
npm list vue
```

确保版本是 **3.4.0 或更高**

如果版本太低：
```bash
npm install vue@^3.4.0 @vue/compiler-sfc@^3.4.0
```

### 2. 更新组件

将 `src/components/DimensionsInput.vue` 替换为使用 defineModel 的版本

```bash
# 备份当前版本
mv src/components/DimensionsInput.vue src/components/DimensionsInput-traditional.vue

# 创建新文件
# 然后复制上面的 defineModel 版本代码
```

### 3. 验证功能

```bash
npm run build
npm run dev
```

- 尝试修改单元格尺寸
- 检查网格是否更新
- 刷新页面确认持久化

### 4. 可选：更新 SpacingInput

同样的原理可以应用到 SpacingInput：

```typescript
// 修改前
const props = defineProps<{ modelValue: SpacingValue }>()
const emit = defineEmits<{ 'update:modelValue': [value: SpacingValue] }>()

function updateValue(key, rawValue) {
  emit('update:modelValue', { ...props.modelValue, [key]: parseInt(rawValue) })
}

// 修改后
const modelValue = defineModel<SpacingValue>({ required: true })

function updateValue(key, rawValue) {
  modelValue.value = { ...modelValue.value, [key]: parseInt(rawValue) }
}
```

## 最佳实践

### ✅ 推荐使用 defineModel 的场景

1. **简单的双向绑定**
   - 输入框、选择器等表单组件
   - 值可以直接读取和写入

2. **多个 v-model**
   - 像 DimensionsInput 这样有 width 和 height
   - 像 SpacingInput 这样有整个对象

3. **组件库开发**
   - API 更简洁
   - 用户更容易理解

### ❌ 不适合使用 defineModel 的场景

1. **需要在 emit 前执行复杂逻辑**
   ```typescript
   // 比如需要在 emit 前验证、格式化、调用 API
   function updateValue(value) {
     if (await api.validate(value)) {
       emit('update:modelValue', format(value))
     }
   }
   ```

2. **需要 emit 多个不同的事件**
   ```typescript
   function updateValue(value) {
     emit('update:modelValue', value)
     emit('change', value)
     emit('validation', validate(value))
   }
   ```

3. **需要自定义事件名称**
   ```typescript
   // 不能使用 'update:modelValue' 以外的名称
   emit('custom-event-name', value) // 手动 emit 更灵活
   ```

## 当前项目建议

**对于 Sprite Font Editor 项目，我强烈推荐使用 defineModel！**

原因：
1. ✅ 项目已经在使用 Vue 3.4+
2. ✅ 绑定逻辑非常简单（只是同步数值）
3. ✅ 没有复杂的 emit 前逻辑
4. ✅ 可以大幅减少代码量
5. ✅ 更容易维护和理解

### 推荐迁移路径

1. **第一步**：先迁移 DimensionsInput（当前讨论的这个）
2. **第二步**：验证功能正常
3. **第三步**：迁移 SpacingInput（类似的模式）
4. **第四步**：删除不需要的 computed 和 emit 代码
5. **第五步**：享受更简洁的代码！🎉

## 快速迁移代码

###  DimensionsInput.vue（defineModel 版本）

```vue
<template>
  <div class="dimensions-inputs">
    <input
      :value="width ?? ''"
      type="number"
      class="form-control dimension-input"
      :placeholder="widthPlaceholder"
      :min="min"
      :step="step"
      @input="handleWidthInput"
    >
    <span class="dimension-separator">×</span>
    <input
      :value="height ?? ''"
      type="number"
      class="form-control dimension-input"
      :placeholder="heightPlaceholder"
      :min="min"
      :step="step"
      @input="handleHeightInput"
    >
  </div>
</template>

<script setup lang="ts">
// 只有配置参数需要通过 props
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

// 自动创建 prop 和 emit！
const width = defineModel<number | undefined>('width')
const height = defineModel<number | undefined>('height')

function handleWidthInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  width.value = raw ? parseInt(raw, 10) : undefined
}

function handleHeightInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  height.value = raw ? parseInt(raw, 10) : undefined
}
</script>

<style scoped>
.dimensions-inputs {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.dimension-input {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.dimension-separator {
  font-weight: 500;
  color: #6c757d;
  user-select: none;
}

.form-control {
  flex: 1;
  padding: 0.375rem 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out;
  min-width: 0;
}

.form-control:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}
</style>
```

父组件的使用方式**完全一样**：

```vue
<DimensionsInput
  v-model:width="editorStore.cellConfig.width"
  v-model:height="editorStore.cellConfig.height"
  :min="8"
  width-placeholder="宽度"
  height-placeholder="高度"
/>
```

---

## 总结

defineModel **绝对更简单**，而且更好！

**优点：**
- ✅ 代码量减少 33%
- ✅ 心智负担更低
- ✅ 更少的 API 需要记忆
- ✅ 自动类型推导
- ✅ 自动响应式处理
- ✅ 编译器自动优化

**代价：**
- ⚠️ 需要 Vue 3.4+（项目已满足）
- ⚠️ 需要学习新语法（5 分钟就能掌握）

**我的建议**：

**现在就用 defineModel 替换现有的 DimensionsInput！**

你不仅可以删除大量代码，而且代码会更清晰、更容易理解，也更不容易出错。

对不熟悉 Vue 的开发者来说，defineModel 反而更容易理解，因为你只需要把它当作一个可以双向绑定的 ref 就可以了。

---

**最终建议**: ✅ **强烈推荐使用 defineModel**

**下一步行动**:
1. 确认 Vue 版本（应该已经是 3.4+）
2. 用上面的代码替换 DimensionsInput.vue
3. 测试功能是否正常
4. 如果一切正常，同样方式改造 SpacingInput.vue
5. 享受更简洁的代码！
