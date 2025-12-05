# Sprite Font Editor - AI Agent Guide

## Project Overview

Sprite Font Editor 是一个基于 Web 的精灵字体编辑器，允许用户上传字体文件和底图，将文字渲染到指定位置并导出 PNG 图片。项目采用 Vue 3 + TypeScript + Vite 技术栈，具有完整的类型安全和模块化架构。

## Technology Stack

- **Frontend Framework**: Vue 3 with Composition API
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite 5.2.8
- **State Management**: Pinia 2.1.7
- **Routing**: Vue Router 4.3.0
- **Canvas**: HTML5 Canvas API with HiDPI support
- **Styling**: CSS3 with scoped component styles
- **Code Quality**: ESLint with TypeScript and Vue plugins

## Project Structure

```
src/
├── components/          # Vue components (8 total)
│   ├── Toolbar.vue              # Top toolbar with file uploads and actions
│   ├── CanvasArea.vue           # Dual-layer canvas area
│   ├── ControlPanel.vue         # Right panel container
│   ├── ImageConfig.vue          # Image settings (margin/padding)
│   ├── CellConfig.vue           # Grid cell configuration
│   ├── CharStyle.vue            # Global character styling
│   ├── CharacterInput.vue       # Character input and management
│   └── InsertPointInfo.vue      # Insert point information
├── stores/
│   └── editor.ts                # Main Pinia store with all state
├── utils/                       # Utility functions
│   ├── file.ts                  # File handling and validation
│   ├── canvas.ts                # Canvas utilities and CanvasSpace class
│   └── download.ts              # Export and download functions
├── views/
│   └── HomeView.vue             # Main application layout
├── router/
│   └── index.ts                 # Vue Router configuration
├── assets/
│   └── styles/
│       └── main.css             # Global styles
├── App.vue                      # Root component
└── main.ts                      # Application entry point
```

## Architecture Overview

### Dual-Layer Canvas Architecture
The application uses a sophisticated two-layer design:

1. **Canvas Layer (Bottom)**: Pure pixel rendering for the base image and text
2. **UI Layer (Top)**: DOM-based overlay for grids, highlights, and user interaction

This separation ensures optimal performance while maintaining precise visual feedback.

### State Management
- **Centralized Store**: All application state managed through Pinia
- **Type Safety**: Complete TypeScript interfaces for all data structures
- **Persistence**: Automatic localStorage save/restore functionality
- **Reactive Updates**: Real-time UI synchronization with state changes

## Key Features

### File Upload System
- **Image Support**: PNG, JPG, GIF, WebP formats
- **Font Support**: TTF, OTF, WOFF, WOFF2 formats via FontFace API
- **Validation**: File type and extension validation
- **Error Handling**: User-friendly error messages

### Configuration System
- **Image Config**: Margin, padding, width/height constraints
- **Cell Config**: Cell dimensions, margins, padding
- **Alignment**: Horizontal (left/center/right) and vertical (top/middle/bottom)
- **Character Style**: Font family, size, color, outline settings
- **Insert Point**: Auto-detection vs manual selection modes

### Canvas Features
- **HiDPI Support**: Automatic device pixel ratio handling
- **Coordinate System**: Precise CanvasSpace utility for cell/position calculations
- **Grid Rendering**: DOM-based grid overlay with customizable appearance
- **Cell Highlighting**: Visual feedback for current selection
- **Click Detection**: Manual cell selection with coordinate mapping

## Development Commands

```bash
# Install dependencies
npm install

# Development server (port 3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint and fix code
npm run lint
```

## Core Interfaces

### ImageConfig
```typescript
interface ImageConfig {
  padding: { top: number; right: number; bottom: number; left: number }
  margin: { top: number; right: number; bottom: number; left: number }
  width?: number
  height?: number
}
```

### CellConfig
```typescript
interface CellConfig {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
  padding: { top: number; right: number; bottom: number; left: number }
}
```

### CharacterEntry
```typescript
interface CharacterEntry {
  char: string
  margin: { top: number; right: number; bottom: number; left: number }
}
```

## Code Style Guidelines

### Vue Components
- Use Composition API with `<script setup>` syntax
- Prefer computed properties for derived state
- Use TypeScript interfaces for props and emits
- Keep components focused and single-purpose

### State Management
- All state mutations go through store actions
- Use computed properties for derived state
- Implement proper persistence with localStorage
- Maintain type safety throughout

### Canvas Operations
- Always consider device pixel ratio for HiDPI displays
- Use the CanvasSpace utility for coordinate calculations
- Clear canvas before redraw operations
- Handle canvas context availability checks

### File Handling
- Validate file types and extensions
- Provide clear error messages to users
- Handle FileReader errors gracefully
- Clean up object URLs after use

## Testing Strategy

### Current Status
- Unit tests: Planned for Week 4
- Integration tests: Manual testing currently
- Browser compatibility: Chrome/Firefox focus

### Test Areas
- Canvas coordinate calculations
- File upload validation
- State persistence functionality
- UI layer and canvas synchronization
- Character rendering algorithms

## Development Status

### Week 1 (Completed)
- ✅ Project architecture and setup
- ✅ File upload functionality
- ✅ Dual-layer canvas system
- ✅ Complete configuration panels
- ✅ State persistence
- ✅ TypeScript type safety

### Week 2 (Completed)
- ✅ Image auto-scaling for container fit
- ✅ DOM grid rendering system with customizable styles
- ✅ Coordinate transformation utilities
- ✅ Insert point auto-detection (transparency-based)
- ✅ Manual cell selection functionality
- ✅ Enhanced cell highlighting system
- ✅ Image/Cell configuration panel improvements
- ✅ Auto/manual mode integration

### Week 3 (Completed)
- ✅ Off-screen Canvas character rendering
- ✅ Object-fit scaling logic for characters
- ✅ Character alignment (horizontal/vertical)
- ✅ Text outline/stroke functionality
- ✅ Multi-character layout and wrapping
- ✅ Character margin adjustments
- ✅ Integration with transparency detection

### Week 4 (In Progress)
- 🔄 PNG export functionality
- 🔄 Error handling improvements
- 🔄 Unit tests implementation
- 🔄 Browser compatibility testing

## Security Considerations

- File uploads are client-side only
- Font files are loaded into memory via FontFace API
- No server-side processing or storage
- Object URLs are properly cleaned up
- User data stays in browser localStorage

## Performance Notes

- Canvas operations use requestAnimationFrame when appropriate
- DOM grid updates are optimized for minimal reflows
- HiDPI support prevents blurriness on high-resolution displays
- State updates are batched where possible
- File processing is asynchronous

## Browser Support

- **Primary**: Chrome, Firefox (latest 2 versions)
- **Required APIs**: FontFace, Canvas 2D, FileReader
- **Modern Features**: ES2020+, CSS Grid, Flexbox

## Common Development Patterns

### Adding New Components
1. Create component in `src/components/`
2. Use TypeScript interfaces for props
3. Connect to editor store for shared state
4. Add to appropriate parent component

### State Updates
1. Modify store state through defined actions
2. Use computed properties for derived values
3. Call `saveToLocalStorage()` after significant changes
4. Maintain type safety throughout

### Canvas Operations
1. Use CanvasSpace utility for calculations
2. Handle device pixel ratio scaling
3. Clear canvas before redrawing
4. Check for null contexts before operations

This guide should help AI agents understand the project structure, development patterns, and implementation details when working on the Sprite Font Editor.