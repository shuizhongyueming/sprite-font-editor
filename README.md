# Sprite Font Editor

一个基于 Web 的 Sprite Font 编辑器，支持用户上传字体文件和底图，将文字渲染到指定位置并导出 PNG 图片。

## 技术栈

- **Frontend**: Vue 3 + TypeScript
- **Build Tool**: Vite
- **State Management**: Pinia
- **Canvas**: HTML5 Canvas API
- **Styling**: CSS3

## 功能特性

### 已实现 (Week 1)
- ✅ 项目基础架构搭建
- ✅ 图片上传功能（支持 PNG, JPG, GIF, WebP）
- ✅ 字体文件上传和 FontFace API 注册
- ✅ Canvas/UILayer 双层架构
- ✅ 完整的配置面板系统
- ✅ localStorage 状态持久化
- ✅ TypeScript 类型安全

### 已实现 (Week 2)
- ✅ 图片自动缩放（基于容器尺寸）
- ✅ DOM 网格渲染系统（可配置样式）
- ✅ 坐标转换工具函数
- ✅ 插入点自动检测（透明度检测）
- ✅ 插入点手动选择功能
- ✅ 单元格高亮显示（双模式）
- ✅ Image/Cell 配置面板增强
- ✅ 自动/手动模式集成

### 已实现 (Week 3)
- ✅ 离屏 Canvas 字符渲染基础架构
- ✅ object-fit 缩放逻辑
- ✅ 字符对齐功能（水平/垂直）
- ✅ 描边功能
- ✅ 多字符排布和换行逻辑
- ✅ 字符 margin 调整
- ✅ 透明度检测与覆盖策略集成

## 项目结构

```
src/
├─ components/          # Vue 组件
│  ├─ Toolbar.vue      # 顶部工具栏
│  ├─ CanvasArea.vue   # 画布区域（双层）
│  ├─ ControlPanel.vue # 右侧面板容器
│  ├─ ImageConfig.vue  # 图片设置
│  ├─ CellConfig.vue   # 网格设置
│  ├─ CharStyle.vue    # 字符样式
│  ├─ CharacterInput.vue # 字符输入
│  └─ InsertPointInfo.vue # 插入点信息
├─ composables/         # 组合式函数（待实现）
├─ stores/             # Pinia 状态管理
├─ utils/              # 工具函数
├─ views/              # 页面视图
└─ assets/             # 静态资源
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发环境
```bash
npm run dev
```
访问 http://localhost:3000

### 构建生产版本
```bash
npm run build
```

## 开发计划

查看 [TODO.md](./TODO.md) 了解详细的开发进度。

## 许可证

MIT License