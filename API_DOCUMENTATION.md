# API 文档

## 核心工具函数

### Canvas 工具 (canvas.ts)

#### `CanvasSpace`

Canvas 坐标转换工具类，提供单元格和像素坐标的互相转换。

**构造函数**:
```typescript
new CanvasSpace(
  canvasWidth: number,      // Canvas 宽度
  canvasHeight: number,     // Canvas 高度
  cellWidth: number,        // 单元格宽度
  cellHeight: number,       // 单元格高度
  cellMargin: Padding,      // 单元格边距
  imageMargin: Padding,     // 图片外边距
  imagePadding: Padding     // 图片内边距
)
```

**属性**:
- `columns: number` - 列数
- `rows: number` - 行数
- `usableWidth: number` - 可用宽度
- `usableHeight: number` - 可用高度

**方法**:

```typescript
// 单元格索引转行列
indexToRowCol(index: number): { row: number; col: number }

// 行列转单元格索引
rowColToIndex(row: number, col: number): number

// 获取单元格位置
getCellPosition(row: number, col: number): { x: number; y: number }

// 坐标转单元格
positionToCell(x: number, y: number): { row: number; col: number } | null

// 获取单元格边界
getCellBounds(row: number, col: number): { x: number; y: number; width: number; height: number }

// 获取所有单元格中心
getAllCellCenters(): Array<{ row: number; col: number; x: number; y: number }>
```

**示例**:
```typescript
const space = new CanvasSpace(
  800, 600, 32, 32,
  { top: 0, right: 0, bottom: 0, left: 0 },
  { top: 10, right: 10, bottom: 10, left: 10 },
  { top: 5, right: 5, bottom: 5, left: 5 }
)

const pos = space.getCellPosition(2, 3)  // { x: 71, y: 71 }
const index = space.rowColToIndex(2, 3)  // 23
```

---

#### `setupHiDPI`

设置 Canvas 的高 DPI 支持。

```typescript
setupHiDPI(canvas: HTMLCanvasElement, width: number, height: number): void
```

**示例**:
```typescript
const canvas = document.createElement('canvas')
setupHiDPI(canvas, 800, 600)
```

---

### 字符渲染 (char-renderer.ts)

#### `calculateCharRenderSize`

计算字符的渲染尺寸（object-fit 算法）。

```typescript
calculateCharRenderSize(
  textWidth: number,       // 文本原始宽度
  textHeight: number,      // 文本原始高度
  availableWidth: number,  // 可用宽度
  availableHeight: number  // 可用高度
): { width: number; height: number; scale: number }
```

**返回值**:
- `width`: 渲染宽度
- `height`: 渲染高度
- `scale`: 缩放比例

**示例**:
```typescript
const result = calculateCharRenderSize(
  100,  // 文本宽度 (100px)
  80,   // 文本高度 (80px)
  32,   // 可用宽度
  32    // 可用高度
)
// { width: 32, height: 25.6, scale: 0.32 }
```

---

#### `calculateAlignment`

计算对齐位置。

```typescript
calculateAlignment(
  renderWidth: number,                                    // 渲染宽度
  renderHeight: number,                                   // 渲染高度
  availableWidth: number,                                 // 可用宽度
  availableHeight: number,                                // 可用高度
  horizontalAlign: 'left' | 'center' | 'right',          // 水平对齐
  verticalAlign: 'top' | 'middle' | 'bottom'            // 垂直对齐
): { x: number; y: number }
```

**示例**:
```typescript
const pos = calculateAlignment(
  20,      // 渲染宽度
  16,      // 渲染高度
  32,      // 可用宽度
  32,      // 可用高度
  'center', // 水平居中
  'middle' // 垂直居中
)
// { x: 6, y: 8 }
```

---

#### `renderCharacterOnCanvas`

在 Canvas 上渲染字符（带有各种效果）。

```typescript
renderCharacterOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    fontFamily: string;
    fontSize: number;
    color: string;
    outline?: {
      enabled: boolean;
      color: string;
      width: number;
    };
  }
): void
```

**示例**:
```typescript
const ctx = canvas.getContext('2d')
renderCharacterOnCanvas(
  ctx,
  'A',
  10,
  10,
  {
    fontFamily: 'Arial',
    fontSize: 16,
    color: '#000000',
    outline: {
      enabled: true,
      color: '#ffffff',
      width: 1
    }
  }
)
```

---

### 文件处理 (file.ts)

#### `isValidImageFile`

验证图片文件。

```typescript
isValidImageFile(file: File): boolean
```

**支持的格式**: PNG, JPG, JPEG, GIF, WebP

---

#### `isValidFontFile`

验证字体文件。

```typescript
isValidFontFile(file: File): boolean
```

**支持的格式**: TTF, OTF, WOFF, WOFF2

---

### 下载工具 (download.ts)

#### `exportCanvasToPNG`

导出 Canvas 为 PNG。

```typescript
exportCanvasToPNG(canvas: HTMLCanvasElement, filename?: string): void
```

**示例**:
```typescript
exportCanvasToPNG(canvas, 'sprite-font.png')
```

---

#### `triggerDownload`

触发文件下载。

```typescript
triggerDownload(dataURL: string, filename: string): void
```

---

## Store API

### Editor Store

#### State

```typescript
// 图片配置
imageConfig: {
  padding: { top, right, bottom, left },
  margin: { top, right, bottom, left }
}

// 单元格配置
cellConfig: {
  width: number,
  height: number,
  margin: { top, right, bottom, left },
  padding: { top, right, bottom, left }
}

// 字符样式
characterStyle: {
  fontFamily: string,
  fontSize: number,
  color: string,
  outline: { enabled, color, width }
}

// 插入点配置
insertPointConfig: {
  mode: 'auto' | 'manual',
  startCellIndex?: number
}

// 字符列表
characterEntries: Array<{ char: string, margin: Padding }>

// 底图
baseImage: HTMLImageElement | null
```

#### Actions

```typescript
// 设置底图
setBaseImage(image: HTMLImageElement): void

// 设置字体
setFont(font: FontFace): void

// 更新字符
updateCharacters(input: string): void

// 检测插入点（基于透明度）
detectInsertPoints(canvas: HTMLCanvasElement): void

// 保存到 localStorage
saveToLocalStorage(): void

// 从 localStorage 恢复
loadFromLocalStorage(): void

// 清空状态
clearState(): void
```

---

## 组件 API

### CanvasArea.vue

**Props**: 无

**Emits**: 无

**Slots**: 无

**依赖**:
- editorStore

**功能**:
- 显示底图
- 渲染字符
- 显示网格
- 处理点击事件

---

### Toolbar.vue

**Props**: 无

**Emits**: 无

**功能**:
- 文件上传
- 导出功能
- 清空操作
- 模式切换

---

### ControlPanel.vue

**Props**: 无

**包含子组件**:
- ImageConfig.vue
- CellConfig.vue
- CharStyle.vue
- CharacterInput.vue
- InsertPointInfo.vue

---

## 类型定义

### Padding

```typescript
interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}
```

### CharacterEntry

```typescript
interface CharacterEntry {
  char: string
  margin: Padding
}
```

### InsertPointConfig

```typescript
interface InsertPointConfig {
  mode: 'auto' | 'manual'
  startCellIndex?: number
}
```

---

## 使用示例

### 完整工作流程

```typescript
import { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'

const store = useEditorStore()

// 1. 上传并设置图片
const image = new Image()
image.onload = () => {
  store.setBaseImage(image)
}
image.src = imageUrl

// 2. 上传并设置字体
const fontBuffer = await file.arrayBuffer()
const fontFace = new FontFace(file.name, fontBuffer)
await fontFace.load()
document.fonts.add(fontFace)
store.setFont(fontFace)

// 3. 输入字符
store.updateCharacters('Hello')

// 4. 创建 CanvasSpace
const canvasSpace = new CanvasSpace(
  canvas.width,
  canvas.height,
  store.cellConfig.width,
  store.cellConfig.height,
  store.cellConfig.margin,
  store.imageConfig.margin,
  store.imageConfig.padding
)

// 5. 渲染到 Canvas
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0)
  
  // 渲染每个字符
  store.characterEntries.forEach((entry, index) => {
    const rowCol = canvasSpace.indexToRowCol(index)
    const pos = canvasSpace.getCellPosition(rowCol.row, rowCol.col)
    
    renderCharacterOnCanvas(ctx, entry.char, pos.x, pos.y, {
      fontFamily: store.characterStyle.fontFamily,
      fontSize: store.characterStyle.fontSize,
      color: store.characterStyle.color
    })
  })
}

// 6. 导出
exportCanvasToPNG(canvas, 'output.png')
```

---

## 最佳实践

### 1. 错误处理

```typescript
try {
  const fontFace = new FontFace(name, buffer)
  await fontFace.load()
  document.fonts.add(fontFace)
} catch (error) {
  notify.error('字体加载失败')
  console.error(error)
}
```

### 2. 性能优化

```typescript
// 只渲染一次，而不是在每次状态变化时
let isRendering = false

function debounceRender() {
  if (isRendering) return
  isRendering = true
  
  requestAnimationFrame(() => {
    render()
    isRendering = false
  })
}
```

### 3. 状态管理

```typescript
// 重要变化后立即保存
store.saveToLocalStorage()

// 恢复状态
store.loadFromLocalStorage()
```

---

## 扩展建议

### 1. 添加新功能

如果要添加新的渲染效果：

```typescript
// 1. 扩展 RenderCharacterOptions
interface ExtendedOptions extends RenderCharacterOptions {
  shadow?: {
    enabled: boolean
    color: string
    offsetX: number
    offsetY: number
    blur: number
  }
}

// 2. 在 renderCharacterOnCanvas 中添加渲染逻辑
if (options.shadow?.enabled) {
  ctx.shadowColor = options.shadow.color
  ctx.shadowOffsetX = options.shadow.offsetX
  ctx.shadowOffsetY = options.shadow.offsetY
  ctx.shadowBlur = options.shadow.blur
}
```

### 2. 自定义导出格式

```typescript
// 添加新格式
export function exportCanvasToWebP(canvas: HTMLCanvasElement, quality: number = 0.9) {
  const dataURL = canvas.toDataURL('image/webp', quality)
  triggerDownload(dataURL, 'sprite-font.webp')
}
```

---

**文档版本**: 1.0  
**最后更新**: 2025-12-05
