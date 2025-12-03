# Sprite Font 编辑器技术方案（最终版）

## 📋 项目概述
开发一个极简的 Web 端 Sprite Font 编辑器，核心功能就是：把用户输入的文字，用指定样式渲染出来，然后贴到用户指定的位置，最后导出一张干净的 PNG 图片。

## 🎯 核心功能需求

### 1. 图片层级设置
用于处理“字体图片与其他素材拼在同一张图”的情况。

```typescript
interface ImageConfig {
  padding: {        // 内边距：整张图内部所有 cell 的整体间距
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  margin: {         // 外边距：当整张图只是素材区的一部分时使用
    top: number;    // 默认 0
    right: number;
    bottom: number;
    left: number;
  };
  width?: number;   // 限制可操作宽度（默认原图宽度）
  height?: number;  // 限制可操作高度（默认原图高度）
}
```

### 2. Cell 网格设置
```typescript
interface CellConfig {
  width: number;   // 单元格总宽（含 padding）
  height: number;  // 单元格总高（含 padding）
  margin: {        // 单元格之间的间距
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  padding: {       // 字符与单元格边框的间距
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}
```

#### Cell 内对齐配置
```typescript
interface CellAlignmentConfig {
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'middle' | 'bottom';
}
```
`CellConfig` 与 `CellAlignmentConfig` 共同决定字符在 cell 内的定位范围；全局对齐策略会在渲染阶段与每个 `CharacterEntry` 的 margin 叠加，确保 object-fit 缩放后仍能满足 left/right/top/bottom 对齐的需求。

### 3. 全局字符样式（唯一）
所有新渲染字符共用一套样式，不提供单独字符样式设置。

```typescript
interface GlobalCharacterStyle {
  fontFamily: string;   // 字体文件（用户从系统选择）
  fontSize: number;     // 字号
  color: string;        // 文字颜色
  outline: {            // 描边（可选）
    enabled: boolean;
    color: string;
    width: number;      // 像素
  };
}
```

字体来源：前端通过 `<input type="file">` 让用户上传 TTF/OTF/WOFF，读取为 `ArrayBuffer` 后借助 `FontFace` API 注册临时字体；字体标识与 `GlobalCharacterStyle.fontFamily` 绑定，仅驻留在内存（运行期 FontFace 列表），无需服务端或本地持久化，用户刷新后重新上传即可继续渲染。

### 4. 字符输入与分割
使用 JavaScript 原生 `for…of` 即可正确分割 Unicode 字符，无需额外处理。

```typescript
function getCharactersFromInput(input: string): string[] {
  return [...input]; // 简单、够用
}
```

字符被拆分后，`CharacterInput` 面板为每个字符维护一个 `CharacterEntry`（字符值 + 可选 margin 调整），默认 margin 为 0，用户可在列表中针对个别字符微调，从而在套用全局样式的同时具备局部间距控制。

```typescript
interface CharacterEntry {
  char: string;   // 单个 Unicode 字符
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };              // 单字符 margin，默认全 0，可被用户覆写
}
```

### 5. 插入点选择

```typescript
interface InsertPointConfig {
  mode: 'auto' | 'manual';   // 自动 或 手动
  startCellIndex?: number;   // 手动模式时记录用户点击的单元格索引
}
```

**行为：**
- **自动模式**：顺序扫描所有单元格，用透明度检测（阈值可配）找到第一个"完全空"的单元格，高亮显示，并在信息栏显示坐标。
- **手动模式**：用户点击任意单元格，立即高亮该单元格，并在信息栏显示坐标；允许选择已占用单元格（即支持覆盖）。

多字符排布逻辑：
1. 计算可用宽度 `usableWidth = (ImageConfig.width ?? 原图宽度) - ImageConfig.padding.left - ImageConfig.padding.right`，再依据 `CellConfig.width` 与水平 margin 求得单行列数 `cols = floor((usableWidth + CellConfig.margin.left + CellConfig.margin.right) / (CellConfig.width + CellConfig.margin.left + CellConfig.margin.right))`，若 `cols < 1` 则阻止渲染并提示。
2. 渲染队列以 `startCellIndex` 为 offset，按列优先推进，列溢出时换行并校验 `ImageConfig.height`、垂直 padding 与 `CellConfig.height`/margin 是否仍可容纳；网格不足时截断后续字符并在信息栏提示。
3. 自动模式完成一批渲染后把 `startCellIndex` 更新为“最后一个成功写入的 cell + 1”，便于继续追加；手动模式保持用户指定的 cell，除非用户再次点击修改。

### 6. 渲染与画布更新
坐标体系：以上传底图左上角为 `(0,0)`，`canvasLayer` 保持原始像素尺寸并按 `devicePixelRatio` 放大，`uiLayer` 只做等比视觉缩放，所有 DOM 位置通过统一的 `CanvasSpace` 工具把 cell 行列转换为像素坐标，确保缩放或窗口变化后两层仍能精确对齐。

用户点击“开始渲染”后：
1. 逐字符进入离屏 canvas：根据 cell padding 推导可用绘制区域，结合 `measureText`/`actualBoundingBox` 获取真实宽高，若超出则按 object-fit: contain 等比缩放；渲染遵循横向（left/center/right）与纵向（top/middle/bottom）对齐配置，再叠加该字符自定义 margin；若描边开启先 stroke 后 fill，并在需要时扩展离屏画布以避免描边被裁。
2. 按 `startCellIndex` 推导 `(row, col)`，计算像素坐标 `targetX = ImageConfig.margin.left + ImageConfig.padding.left + col * (CellConfig.width + CellConfig.margin.left + CellConfig.margin.right)`、`targetY = ImageConfig.margin.top + ImageConfig.padding.top + row * (CellConfig.height + CellConfig.margin.top + CellConfig.margin.bottom)`，写入主画布前校正 HiDPI 缩放；同一 cell 再渲染视为覆盖，没有额外合成。
3. 渲染完成后刷新 UI 高亮与信息栏，并将最新参数、字体引用、插入点写入 `localStorage`，刷新页面可恢复状态；用户可随时修改参数重新渲染，上一轮像素会被新的贴图覆盖。

### 7. 导出
导出内容为“上传底图 + 新渲染字符”的整张合成图，不包含任何 UI 层元素，亦不做裁剪或压缩；直接 `mainCanvas.toDataURL('image/png')`，颜色空间/EXIF 等沿用浏览器默认值，由用户自行后处理。

```typescript
function exportCanvas(): void {
  const dataURL = mainCanvas.toDataURL('image/png');
  triggerDownload(dataURL, 'sprite-font.png');
}
```

## 🎨 界面布局（双层设计 + 右侧面板）

### 画布区域双层架构
- **Canvas层（底层）**：仅负责 sprite font 图片像素渲染
- **UI层（上层，DOM）**：负责所有辅助元素（网格线、单元格边框、高亮边框、插入点提示等）

### 布局结构
```
┌──────────────────────────────────────────────────────────────┐
│  工具栏（顶部）                                                │
│  [上传图片] [渲染] [下载PNG]  插入点: [自动◯] [手动◯]            │
├───────────────────────────────┬──────────────────────────────┤
│                               │  右侧面板（上下排列）          │
│                               │ ┌────────────────────────────┐ │
│        Canvas 区域             │ │  图片设置                   │ │
│   (正方形最大化空间)            │ │  • margin/width/height      │ │
│                               │ │  • padding                  │ │
│                               │ ├────────────────────────────┤ │
│                               │ │  Cell 设置                  │ │
│                               │ │  • width/height             │ │
│                               │ │  • margin/padding           │ ││
│                               │ │  • 对齐/字符 margin         │ │
│                               │ ├────────────────────────────┤ │
│                               │ │  全局字符样式               │ │
│                               │ │  • 字体/大小/颜色           │ │
│                               │ │  • 描边开关                 │ │
│                               │ ├────────────────────────────┤ │
│                               │ │  插入点信息                 │ │
│                               │ │  • 当前高亮单元格坐标       │ │
│                               │ │  • 字符输入框               │ │
│                               │ └────────────────────────────┘ │
└───────────────────────────────┴──────────────────────────────┘
```

### 布局优势
1. **Canvas区域最大化**：正方形区域，适合sprite font的常见比例
2. **双层分离**：Canvas专注像素渲染，DOM负责UI辅助，性能更好
3. **右侧面板集中**：所有配置集中在一侧，操作逻辑清晰
4. **上下排列**：避免左右分割造成的Canvas区域过小

## 🛠 核心实现代码

### 1. 双层画布初始化
```typescript
// Canvas层（底层）- 仅像素渲染
const canvasLayer = document.getElementById('canvas-layer') as HTMLCanvasElement;
const canvasCtx = canvasLayer.getContext('2d');

// UI层（上层）- DOM辅助元素
const uiLayer = document.getElementById('ui-layer');
// 使用绝对定位的DIV元素绘制网格、边框、高亮等
```

### 2. UI层网格渲染（DOM实现）
```typescript
function renderGridDOM(cellWidth: number, cellHeight: number, cols: number, rows: number): void {
  const uiLayer = document.getElementById('ui-layer');
  uiLayer.innerHTML = ''; // 清空旧网格
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'grid-cell';
      cellDiv.style.position = 'absolute';
      cellDiv.style.left = `${col * (cellWidth + cellMargin)}px`;
      cellDiv.style.top = `${row * (cellHeight + cellMargin)}px`;
      cellDiv.style.width = `${cellWidth}px`;
      cellDiv.style.height = `${cellHeight}px`;
      cellDiv.style.border = '1px solid rgba(0,255,0,0.5)'; // 绿色网格线
      uiLayer.appendChild(cellDiv);
    }
  }
}
```

### 3. 单元格高亮（DOM实现）
```typescript
function highlightCell(index: number, cellWidth: number, cellHeight: number, cols: number): void {
  // 移除旧高亮
  const oldHighlight = document.querySelector('.cell-highlight');
  if (oldHighlight) oldHighlight.remove();
  
  const row = Math.floor(index / cols);
  const col = index % cols;
  
  const highlight = document.createElement('div');
  highlight.className = 'cell-highlight';
  highlight.style.position = 'absolute';
  highlight.style.left = `${col * (cellWidth + cellMargin) - 2}px`;
  highlight.style.top = `${row * (cellHeight + cellMargin) - 2}px`;
  highlight.style.width = `${cellWidth + 4}px`;
  highlight.style.height = `${cellHeight + 4}px`;
  highlight.style.border = '2px solid #ff0000';
  highlight.style.pointerEvents = 'none'; // 不影响点击
  
  document.getElementById('ui-layer').appendChild(highlight);
}
```

### 4. 透明度检测
```typescript
function isCellEmpty(
  imageData: ImageData,
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  threshold: number = 10
): boolean {
  const { data, width } = imageData;
  for (let y = cellY; y < cellY + cellHeight; y++) {
    for (let x = cellX; x < cellX + cellWidth; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > threshold) return false;
    }
  }
  return true;
}
```

### 5. 字符渲染与贴图
```typescript
async function renderAndStamp(
  char: string,
  style: GlobalCharacterStyle,
  targetX: number,
  targetY: number,
  cellWidth: number,
  cellHeight: number
): Promise<void> {
  // 1. 离屏渲染字符
  const offscreen = new OffscreenCanvas(cellWidth, cellHeight);
  const offCtx = offscreen.getContext('2d');
  offCtx.font = `${style.fontSize}px ${style.fontFamily}`;
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  
  if (style.outline.enabled) {
    offCtx.strokeStyle = style.outline.color;
    offCtx.lineWidth = style.outline.width;
    offCtx.strokeText(char, cellWidth / 2, cellHeight / 2);
  }
  offCtx.fillStyle = style.color;
  offCtx.fillText(char, cellWidth / 2, cellHeight / 2);
  
  // 2. 贴到主画布
  const imageData = offCtx.getImageData(0, 0, cellWidth, cellHeight);
  canvasCtx.putImageData(imageData, targetX, targetY);
}
```

## 📁 项目结构

```
src/
├─ components/
│  ├─ Toolbar.vue              // 顶部工具栏
│  ├─ CanvasArea.vue           // 画布区域（双层）
│  ├─ ImageConfig.vue          // 图片设置面板
│  ├─ CellConfig.vue           // Cell 设置面板
│  ├─ CharStyle.vue            // 全局字符样式面板
│  ├─ InsertPointControl.vue   // 插入点控制
│  └─ CharacterInput.vue       // 字符输入框
├─ composables/
│  ├─ useCanvas.ts             // Canvas 层管理
│  ├─ useUILayer.ts            // UI 层管理
│  ├─ useCellDetector.ts       // 空单元格检测
│  ├─ useCharRenderer.ts       // 字符渲染
│  └─ useExporter.ts           // 导出功能
├─ utils/
│  ├─ file.ts                  // 文件处理
│  ├─ canvas.ts                // Canvas 工具函数
│  └─ download.ts              // 下载功能
└─ App.vue                     // 主布局

assets/
└─ styles/
   └─ main.css                  // 网格线、高亮等样式
```

## 🧪 测试要点

1. **双层同步**：验证 Canvas 与 DOM 坐标转换、HiDPI 缩放后的像素对齐。
2. **布局计算单测**：对多字符排布、换行、溢出截断、起始 cell 推进等纯函数编写少量测试，确保核心算法稳定。
3. **字符渲染**：覆盖 objectFit 缩放、三种横向/纵向对齐、描边与填充叠加、字符 margin 生效情况。
4. **覆盖渲染**：重复写入同一 cell 时旧像素必须被完整替换，无 alpha 残留。
5. **导出质量**：导出的 PNG 仅包含底图与字符，分辨率与原图一致；性能相关测试暂缓。

## ⚙️ 状态与范围约束
- 仅在前端运行，无登录/服务端依赖；字体文件在用户侧上传、注册与销毁，不进入本地持久化。
- 应用状态（图片/Cell 参数、插入点、字符列表等）保存在 `localStorage`，页面刷新后自动恢复；字体需用户重新上传，并提供“一键清空状态”。
- 当前阶段无需无障碍、键盘导航或国际化增强，但 Unicode 输入须完整支持。
- 目标运行环境为桌面端 Chromium/Firefox（最近两个版本），其他浏览器暂不纳入验收。

## 📅 开发计划（4 周，Vue 3 + Vite + TypeScript + Pinia）

- **Week 1**：搭建 Vite + Vue3 + TypeScript 工程，集成 Pinia/Router；完成图片上传、字体读取与 FontFace 注册、`localStorage` 状态骨架，以及基础 Canvas/UILayer 结构。
- **Week 2**：实现 DOM 网格、插入点交互、高亮同步，完善 Image/Cell 配置面板与统一坐标工具；确保自动/手动模式都能正确定位 cell，并可从本地状态恢复。
- **Week 3**：完成离屏渲染管线（objectFit、对齐、描边）、多字符排布/换行逻辑、字符 margin 调整界面，并串联透明度检测与覆盖策略。
- **Week 4**：打磨导出、错误提示、参数回写，补齐核心计算单测与自测脚本，交付桌面 Chromium/Firefox Demo，整理文档与后续改进清单。

—— 技术方案完毕，等待你的进一步意见。🎯