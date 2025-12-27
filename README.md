# Sprite Font Editor

[![GitHub release](https://img.shields.io/github/v/release/shuizhongyueming/sprite-font-editor)](https://github.com/shuizhongyueming/sprite-font-editor/releases)
[![GitHub pages](https://img.shields.io/badge/GitHub-Pages-blue)](https://shuizhongyueming.github.io/sprite-font-editor/)

[English](README.md) | [中文](README_CN.md)

A Vue 3 based sprite font editor. Upload font files and base images, render characters to cells, and export as PNG images.

一个基于 Vue 3 的精灵字体编辑器。上传字体文件和底图，将字符渲染到单元格并导出为 PNG 图片。

## Live Demo

访问在线版本: https://shuizhongyueming.github.io/sprite-font-editor/

## Features

- 📤 **Upload Images** - Support PNG, JPG, GIF, WebP formats
- 🔤 **Upload Fonts** - Support TTF, OTF, WOFF, WOFF2 formats
- 🎨 **Grid System** - Configurable cell size, margin, and padding
- ✨ **Character Rendering** - Render characters with alignment and outline options
- 🌐 **Bilingual Support** - Chinese and English UI
- 📦 **Export PNG** - Export spritesheet with original size
- 🤖 **Auto-detect Grid** - Automatically detect grid lines from images
- 🎯 **Insert Point Detection** - Auto or manual mode for character positioning

## Tech Stack

- **Frontend Framework**: Vue 3 + TypeScript
- **Build Tool**: Vite
- **State Management**: Pinia
- **Canvas**: HTML5 Canvas API
- **Styling**: CSS3 (no external CSS framework)

## Quick Start

### Install Dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```
Open http://localhost:3000

### Build for Production
```bash
npm run build
```

### Lint
```bash
npm run lint
```

### Test
```bash
npm run test        # Run tests with UI
npm run test:run    # Run tests once (CI)
```

## Project Structure

```
src/
├── components/
│   ├── CanvasArea.vue      # Canvas area with dual-layer architecture
│   ├── Toolbar.vue         # Top toolbar with tools
│   ├── ControlPanel.vue    # Side panel container
│   ├── CellConfig.vue      # Grid settings
│   ├── CharStyle.vue       # Character style settings
│   ├── CharacterInput.vue  # Character input panel
│   ├── InsertPointInfo.vue # Insert point information
│   └── SegmentControl.vue  # Reusable segment control component
├── stores/
│   └── editor.ts           # Pinia store for editor state
├── utils/
│   ├── canvas.ts           # Canvas coordinate conversion
│   ├── char-renderer.ts    # Offscreen character rendering
│   ├── grid-detector.ts    # Grid auto-detection
│   ├── i18n.ts             # Internationalization
│   └── download.ts         # PNG export utility
└── assets/
    └── styles/             # Global styles
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Issues and Pull Requests are welcome!

## Author

[@shuizhongyueming](https://github.com/shuizhongyueming)
