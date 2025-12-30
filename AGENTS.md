# AGENTS.md

This file provides guidance for agentic coding agents operating in this repository.

## Project Overview

Sprite Font Editor - A Vue 3 based sprite font editor. Upload font files and base images, render characters to cells, and export as PNG images.

## Build Commands

```bash
npm run dev              # Start dev server (port 3000)
npm run build            # TypeScript type check + production build
npm run lint             # ESLint auto-fix
npm run test             # Run vitest tests (watch mode)
npm run test:run         # Run tests once (CI environment)
npm run test:ui          # Run tests with UI
npm run preview          # Preview production build
```

**Running a single test:**
```bash
# Run specific test file
npx vitest run src/test/canvas.test.ts

# Run test with matching name
npx vitest run -t "detectGridFast"
```

## Code Style Guidelines

### Imports

- Use absolute imports with `@/` alias for src root
- Group imports: external libs → @/ utils → local components
- Vue imports: use named imports from 'vue'

```typescript
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { CanvasSpace } from '@/utils/canvas'
import { notify } from '@/utils/notification'
import Ruler from './Ruler.vue'
```

### TypeScript

- Enable `strict: true` (inferred from project config)
- Use interfaces for object shapes, types for unions/primitives
- Export all interfaces used across modules
- Use optional properties with `?` when appropriate
- Avoid `any`; use `unknown` for truly unknown types

```typescript
export interface CellConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface GridCellInfo {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### Naming Conventions

- **Files**: kebab-case for components (`CanvasArea.vue`), camelCase for utils (`char-renderer.ts`)
- **Variables/Functions**: camelCase (`baseCellConfig`, `renderCharacterToCell`)
- **Interfaces/Types**: PascalCase (`CellConfig`, `GridCellInfo`)
- **Constants**: SCREAMING_SNAKE_CASE for config objects, camelCase for values
- **Vue Components**: PascalCase in code, kebab-case in templates
- **Refs**: suffixed with type or `ref` (e.g., `canvasLayer ref<HTMLCanvasElement>()`)

### Vue Component Structure

```vue
<template>
  <!-- Full template first -->
</template>

<script setup lang="ts">
// Imports
// Types/Interfaces
// Constants
// Component refs
// Computed properties
// Watchers
// Lifecycle hooks
// Methods
// Expose
</script>

<style scoped>
/* Scoped CSS */
</style>
```

### CSS/Styling

- Use scoped CSS in Vue components
- BEM-like naming: `.block`, `.block__element`, `.block--modifier`
- Use CSS variables for theming when appropriate
- Avoid inline styles except for dynamic values

```scss
.canvas-container {
  position: relative;
  
  &__header {
    font-weight: 500;
  }
  
  &--active {
    border-color: #007bff;
  }
}
```

### Error Handling

- Use `try/catch` with specific error handling
- Notify users via `notify.error()`, `notify.warning()`, `notify.success()`
- Log errors with `console.error()` for debugging
- Never swallow errors silently

```typescript
try {
  const result = detectGridFast(image, config);
  if (!result) {
    notify.warning(t('gridDetectionFailed'));
    return;
  }
} catch (error) {
  console.error('Grid detection failed:', error);
  notify.error(t('gridDetectionError'));
}
```

### Canvas Operations

- Use `imageSmoothingEnabled = false` for pixel art
- Always check `getContext('2d')` for null
- Clean up canvas with `clearRect()` before redrawing
- Handle DPI scaling when needed

### File Handling

- Use `FileReader` for reading uploaded files
- Revoke object URLs after use (`URL.revokeObjectURL()`)
- Use `FontFace` API for custom fonts

## Architecture Patterns

### Dual Canvas Architecture

- **Canvas Layer**: Renders base image and characters via `<canvas>`
- **UI Layer**: DOM overlay for grids, highlights, rulers
- Separation ensures performance while maintaining visual precision

### State Management (Pinia)

- `editorStore` in `src/stores/editor.ts` manages all state
- Base configs (original image size) vs Display configs (scaled)
- Use `computed` for derived state

### Rendering Flow

1. Upload base image → `setBaseImage()` → auto-scale to fit container
2. Configure grid (`cellConfig`) and character positions
3. `CanvasArea.vue` draws image, then renders characters
4. Grids/highlights use DOM elements for performance

## Important File Locations

- Store: `src/stores/editor.ts`
- Canvas utilities: `src/utils/canvas.ts`
- Character rendering: `src/utils/char-renderer.ts`
- Grid detection: `src/utils/grid-detector.ts`
- Main canvas component: `src/components/CanvasArea.vue`
