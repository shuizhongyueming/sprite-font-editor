/**
 * C3 精简候选预览的 DOM/canvas 辅助。
 *
 * 不包含像素分析 / 重排 / spacing 迁移算法（见 src/utils/c3-compaction.ts），
 * 只负责：把图片/ImageData 画成可复用 canvas，以及用同一 sample text
 * 渲染「旧/新」C3 文本预览。像素提取（imageToImageData）在
 * c3-compaction-dom.ts。追加字符的严格 cell clipping 由
 * renderC3AppendedCharacter 统一保证。
 */

import { renderC3AppendedCharacter } from "@/utils/c3-char-renderer";
import { migrateC3SpacingData, type C3CompactionError } from "@/utils/c3-compaction";
import type { C3AppendedEntry } from "@/utils/c3-export";
import { getC3AppendedEffectiveMargin } from "@/utils/c3-export";
import { splitGraphemes } from "@/utils/grapheme";

/** 把 HTMLImageElement 原尺寸画成 canvas（context 缺失时抛出，不静默假成功） */
export function imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  return canvas;
}

/** 把 ImageData 无损画成 canvas（context 缺失时抛出，不静默假成功） */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export interface C3TextPreviewFont {
  fontFamily: string;
  fontSize: number;
  color: string;
  outline?: {
    enabled: boolean;
    color: string;
    width: number;
  };
  pixelStyle?: boolean;
}

export interface C3TextDisplayWidthMapsOptions {
  importedSpacingData: string;
  oldCharacterWidth: number;
  appendedEntries: C3AppendedEntry[];
  globalExtraSpacing: number;
}

export interface C3TextDisplayWidthMapsSuccess {
  kind: "ok";
  old: Map<string, number>;
  new: Map<string, number>;
}

export type C3TextDisplayWidthMapsResult =
  | C3TextDisplayWidthMapsSuccess
  | C3CompactionError;

/**
 * 按真实迁移语义构造 old/new 两套显示宽 map（fail closed，不静默降级）：
 * - imported 显式 spacing 复用 migrateC3SpacingData 校验并迁移
 *   （等于旧 characterWidth 的冗余项删除 → 两侧默认；其他显式值两侧同值）。
 * - appended entry 的有效显示宽度 autoDisplayWidth + globalExtraSpacing +
 *   extraSpacing 在 new pane 必须显式保留，即便等于旧 characterWidth
 *   （追加字符不缩放/不重测）。
 * 返回 typed error（invalid-spacing-data）而非吞错降级。
 */
export function buildC3TextDisplayWidthMaps(
  options: C3TextDisplayWidthMapsOptions,
): C3TextDisplayWidthMapsResult {
  const oldMap = new Map<string, number>();
  const newMap = new Map<string, number>();

  // 复用核心 spacing 迁移做校验与清理（不复制 tuple validation）；
  // migrate 成功时其输出必定是可解析的合法 JSON
  const migrated = migrateC3SpacingData(
    options.importedSpacingData,
    options.oldCharacterWidth,
  );
  if (migrated.kind === "error") {
    return { kind: "error", code: migrated.code };
  }

  const tuples = JSON.parse(migrated.spacingData) as Array<
    [number, string]
  >;
  for (const [width, chars] of tuples) {
    for (const char of splitGraphemes(chars)) {
      oldMap.set(char, width);
      newMap.set(char, width);
    }
  }

  for (const entry of options.appendedEntries) {
    const width =
      entry.autoDisplayWidth +
      options.globalExtraSpacing +
      entry.extraSpacing;
    oldMap.set(entry.char, width);
    newMap.set(entry.char, width);
  }

  return { kind: "ok", old: oldMap, new: newMap };
}

export interface C3TextPreviewOptions {
  /** 导入基线图（旧 = 原导入图；新 = repacked ImageData 的 canvas） */
  sourceCanvas: HTMLCanvasElement;
  characterWidth: number;
  characterHeight: number;
  characterSpacing: number;
  lineHeight: number;
  /** Imported Character Set 的 grapheme 序列（row-major 顺序） */
  importedCharacterSet: string[];
  appendedEntries: C3AppendedEntry[];
  /** 显式显示宽（imported explicit spacing + appended display width），不含默认步进 */
  displayWidthMap: Map<string, number>;
  spaceWidth: number;
  sampleText: string;
  /** 相同容器宽度下对比换行点 */
  containerWidth: number;
  /**
   * imported cell 的 grid 映射（与 compaction 核心唯一一致）：
   * 旧 pane 传候选的 oldGrid（origin = margin+padding，有效列数来自 computeOldGrid）；
   * 新 pane 传 { originX: 0, originY: 0, columns: plan.newColumns }。
   */
  sourceGrid: {
    originX: number;
    originY: number;
    columns: number;
  };
  cellPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  font: C3TextPreviewFont;
  currentFontFamily?: string;
}

/**
 * 用同一 sample text 渲染 C3 文本预览：
 * - imported 字符从 sourceCanvas 按 cell 网格 drawImage（不缩放）
 * - 追加字符用 renderC3AppendedCharacter 动态渲染（同字号、严格 cell clipping）
 * - 默认步进 = characterWidth；显式 spacing / appended width 来自 displayWidthMap
 * - 超宽换行、行高 = characterHeight + lineHeight
 * 返回渲染后的逻辑高度（调用方据此设置 canvas 尺寸）。
 */
export function renderC3TextPreview(
  canvas: HTMLCanvasElement,
  options: C3TextPreviewOptions,
): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const {
    sourceCanvas,
    characterWidth,
    characterHeight,
    characterSpacing,
    lineHeight,
    containerWidth,
    sourceGrid,
  } = options;

  const lineAdvance = characterHeight + lineHeight;
  const chars = splitGraphemes(options.sampleText);
  const importedSet = options.importedCharacterSet;
  const appendedSet = options.appendedEntries.map((entry) => entry.char);
  const columns = Math.max(1, sourceGrid.columns);

  let x = 0;
  let y = 0;

  for (const char of chars) {
    const explicitWidth = options.displayWidthMap.get(char);
    const width =
      char === " " ? options.spaceWidth : (explicitWidth ?? characterWidth);

    // 换行：与 C3Preview 一致，空格不触发换行；避免 x=0 时单个字符过宽无限换行
    if (char !== " " && x + width > containerWidth && x > 0) {
      x = 0;
      y += lineAdvance;
    }

    const importedIndex = importedSet.indexOf(char);
    if (importedIndex >= 0) {
      const srcCol = importedIndex % columns;
      const srcRow = Math.floor(importedIndex / columns);
      ctx.drawImage(
        sourceCanvas,
        sourceGrid.originX + srcCol * characterWidth,
        sourceGrid.originY + srcRow * characterHeight,
        characterWidth,
        characterHeight,
        x,
        y,
        characterWidth,
        characterHeight,
      );
    } else {
      const appendedIndex = appendedSet.indexOf(char);
      if (appendedIndex >= 0) {
        const entry = options.appendedEntries[appendedIndex];
        renderC3AppendedCharacter({
          char,
          targetCtx: ctx,
          baseCellX: x,
          baseCellY: y,
          baseCellWidth: characterWidth,
          baseCellHeight: characterHeight,
          renderScale: 1,
          charMargin: getC3AppendedEffectiveMargin(entry),
          cellPadding: options.cellPadding,
          fontFamily: options.currentFontFamily || options.font.fontFamily,
          fontSize: options.font.fontSize,
          color: options.font.color,
          outline: options.font.outline,
          pixelStyle: options.font.pixelStyle,
          alignment: { horizontal: "left", vertical: "top" },
        });
      }
    }

    x += width + characterSpacing;
  }

  return y + characterHeight;
}
