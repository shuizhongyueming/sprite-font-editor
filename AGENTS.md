# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述
Sprite Font Editor - 一个基于 Vue 3 的精灵字体编辑器。上传字体文件和底图，将字符渲染到单元格并导出为 PNG 图片。

## 常用命令
```bash
npm run dev          # 启动开发服务器 (端口 3000)
npm run build        # TypeScript 类型检查 + 生产构建
npm run lint         # ESLint 自动修复
npm run test         # 运行 vitest 单元测试
npm run test:run     # 运行测试一次（CI 环境）
```

## 架构设计

### 双层 Canvas 架构
- **Canvas 层** (底层): `CanvasArea.vue` 通过 `<canvas>` 元素渲染底图和字符
- **UI 层** (顶层): DOM 覆盖层渲染网格、高亮、标尺 - 不涉及 Canvas 操作
- 分离设计确保性能的同时保持视觉反馈的精确性

### 核心状态管理 (Pinia)
`src/stores/editor.ts` 中管理所有状态：
- `imageConfig`: 底图的边距和内边距
- `cellConfig`: 网格单元格的尺寸和间距
- `characterEntries`: 已渲染字符数组，格式为 `{ char, margin }`
- `insertPointConfig`: `{ mode: 'auto' | 'manual', startCellIndex }`
- `baseImage`: 上传的底图（设置时触发自动缩放）

### 核心工具类
- **`CanvasSpace`** (`src/utils/canvas.ts`): 单元格与网格坐标转换工具。关键方法：`indexToRowCol`、`rowColToIndex`、`getCellPosition`、`positionToCell`
- **`renderCharacterToCell`** (`src/utils/char-renderer.ts`): 离屏 Canvas 渲染，支持 object-fit 缩放、对齐方式和描边效果

### 渲染流程
1. 用户上传底图 → `editorStore.setBaseImage()` → 自动缩放以适应容器
2. 用户配置网格 (`cellConfig`) 和字符位置
3. `CanvasArea.vue` 绘制底图，然后通过 `renderCharacterToCell()` 渲染字符
4. 网格和高亮效果使用 DOM 元素（非 Canvas）以提升性能

### 插入点检测
- **自动模式**: `detectInsertPoints()` 扫描 Canvas 像素寻找空单元格（基于 alpha 透明度阈值）
- **手动模式**: 用户点击单元格设置起始位置
- 字符渲染从 `characterEntries` 中的 `startCellIndex` 开始按顺序渲染

## TypeScript 接口定义
```typescript
interface CellConfig { width, height, margin, padding }
interface CharacterEntry { char, margin }
interface InsertPointConfig { mode, startCellIndex }
```

## 文件处理
- 字体文件: 使用 `FontFace` API，通过 `src/utils/file.ts` 处理
- 图片文件: `FileReader` → `Image` 对象 → `canvas.drawImage()`
- Object URLs 使用后应及时释放
