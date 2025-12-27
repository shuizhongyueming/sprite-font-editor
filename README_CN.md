# Sprite Font Editor

[![GitHub release](https://img.shields.io/github/v/release/shuizhongyueming/sprite-font-editor)](https://github.com/shuizhongyueming/sprite-font-editor/releases)
[![GitHub pages](https://img.shields.io/badge/GitHub-Pages-blue)](https://shuizhongyueming.github.io/sprite-font-editor/)

[English](README.md) | 中文

一个基于 Vue 3 的精灵字体编辑器。上传字体文件和底图，将字符渲染到单元格并导出为 PNG 图片。

## 在线演示

访问在线版本: https://shuizhongyueming.github.io/sprite-font-editor/

## 功能特性

- 📤 **上传图片** - 支持 PNG、JPG、GIF、WebP 格式
- 🔤 **上传字体** - 支持 TTF、OTF、WOFF、WOFF2 格式
- 🎨 **网格系统** - 可配置的单元格尺寸、间距和内边距
- ✨ **字符渲染** - 支持对齐方式和描边效果
- 🌐 **双语支持** - 中文和英文界面
- 📦 **导出 PNG** - 导出原始尺寸的精灵图
- 🤖 **自动划分网格** - 从图片自动检测网格线
- 🎯 **插入点检测** - 自动或手动模式确定字符位置

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **画布**: HTML5 Canvas API
- **样式**: CSS3（无外部 CSS 框架）

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
打开 http://localhost:3000

### 构建生产版本
```bash
npm run build
```

### 代码检查
```bash
npm run lint
```

### 测试
```bash
npm run test        # 运行测试（带 UI）
npm run test:run    # 运行测试一次（CI）
```

## 项目结构

```
src/
├── components/
│   ├── CanvasArea.vue      # 画布区域（双层架构）
│   ├── Toolbar.vue         # 顶部工具栏
│   ├── ControlPanel.vue    # 侧边栏容器
│   ├── CellConfig.vue      # 网格设置
│   ├── CharStyle.vue       # 字符样式设置
│   ├── CharacterInput.vue  # 字符输入面板
│   ├── InsertPointInfo.vue # 插入点信息
│   └── SegmentControl.vue  # 可复用的分段控制器组件
├── stores/
│   └── editor.ts           # Pinia 状态管理
├── utils/
│   ├── canvas.ts           # 画布坐标转换
│   ├── char-renderer.ts    # 离屏字符渲染
│   ├── grid-detector.ts    # 网格自动检测
│   ├── i18n.ts             # 国际化
│   └── download.ts         # PNG 导出工具
└── assets/
    └── styles/             # 全局样式
```

## 浏览器支持

- Chrome（最新版）
- Firefox（最新版）
- Safari（最新版）
- Edge（最新版）

## 许可证

MIT License - 查看 [LICENSE](LICENSE) 了解更多详情。

## 贡献

欢迎提交 Issues 和 Pull Requests！

## 作者

[@shuizhongyueming](https://github.com/shuizhongyueming)
