/**
 * C3 Sprite 重排（Re-wrap）核心算法与校验。
 *
 * 纯算法模块：保持 cell 尺寸与 row-major 字符顺序不变，仅改变 sheet 换行宽度
 * （列数），把导入字符像素按新列数物理重排到一张新透明图上。
 * 相对精简只搬像素、不做 alpha 内容分析；唯一例外是
 * content-outside-imported-cells 阻断校验（读取 alpha，
 * 阈值与精简一致：C3_CONTENT_ALPHA_MIN）。
 * 零 DOM 依赖，纯函数。
 */

import {
  computeC3CellOrigins,
  computeOldGrid,
  hasContentOutsideImportedCells,
  isValidImageData,
  isValidSource,
} from "@/utils/c3-compaction";
import type { C3CompactionSource } from "@/utils/c3-compaction";

/**
 * 输出单边尺寸上限：目标宽度或结果（密铺/自定义）高度超过即阻断
 * （invalid-output-dimensions）。对齐 WebGL 常见的 16384 最大纹理边长。
 */
export const C3_MAX_TEXTURE_SIZE = 16384;

/** 阻断错误的可判别代码。UI 依据 code 分支，不解析文案。 */
export type C3RewrapErrorCode =
  | "unreliable-canvas"
  | "invalid-grid"
  | "no-imported-content"
  | "content-outside-imported-cells"
  | "invalid-output-dimensions";

/** 统一的阻断错误结果 */
export interface C3RewrapError {
  kind: "error";
  code: C3RewrapErrorCode;
}

/**
 * 可接受的重排方案：新列数/行数与默认输出高度（精确密铺）。
 * cell 尺寸不变（沿用 source.characterWidth/Height），故方案不重复携带。
 * 行数按导入+追加的总字符数计：追加字符按新布局重渲染，
 * 其占位行在输出图中保持透明。
 */
export interface C3RewrapPlan {
  kind: "plan";
  /** 目标输出宽度（输出图片宽度精确等于该值，右侧余量透明） */
  targetWidth: number;
  /** 新列数 = floor(targetWidth / characterWidth) */
  newColumns: number;
  /** 行数 = ceil((imported + appended) / newColumns) */
  newRows: number;
  /** 默认输出高度（精确密铺）= newRows × characterHeight */
  newImageHeight: number;
  importedCount: number;
  /** 旧列数（computeOldGrid 同一映射，repack 一致性校验用） */
  oldColumns: number;
  /** 旧 Font Sprite 宽度（预览对比用） */
  oldFontSpriteWidth: number;
  /** 旧最终纹理高度（导入+追加按旧列数密铺，预览对比用） */
  oldFinalTextureHeight: number;
}

/**
 * 非阻断结果：新列数与当前列数相同，布局无变化，不允许应用
 * （地位类似精简的 no-savings）。
 */
export interface C3RewrapNoLayoutChange {
  kind: "no-layout-change";
  /** 当前（旧）列数 */
  oldColumns: number;
  /** 请求的目标宽度 */
  targetWidth: number;
}

export type C3RewrapPlanResult =
  | C3RewrapPlan
  | C3RewrapNoLayoutChange
  | C3RewrapError;

function error(code: C3RewrapErrorCode): C3RewrapError {
  return { kind: "error", code };
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * 计算重排方案：给定当前 C3 项目的导入网格配置与任意目标宽度，
 * 产出新列数/行数与精确密铺高度，并做 fail-closed 校验。
 *
 * 校验顺序：像素数据 → 源配置 → 空导入集 → 旧网格 → cell 越界 →
 * 覆盖表外内容 → 目标宽度 → 同列数（非阻断）→ 结果高度上限。
 * 目标宽度小于 characterWidth、或目标宽度/结果高度越过 C3_MAX_TEXTURE_SIZE
 * 均阻断；宽度恰等于 characterWidth（1 列）、单行/单字符 sheet、
 * 极端宽高比均允许。
 */
export function computeC3RewrapPlan(
  imageData: ImageData,
  source: C3CompactionSource,
  targetWidth: number,
): C3RewrapPlanResult {
  if (!isValidImageData(imageData)) {
    return error("unreliable-canvas");
  }
  if (!isValidSource(source)) {
    return error("invalid-grid");
  }

  const importedCount = source.importedCharacterSet.length;
  if (importedCount === 0) {
    return error("no-imported-content");
  }

  const oldGrid = computeOldGrid(imageData, source);
  if (!oldGrid) {
    return error("invalid-grid");
  }
  if (importedCount > oldGrid.columns * oldGrid.rows) {
    return error("invalid-grid");
  }

  const cellOrigins = computeC3CellOrigins(imageData, source, oldGrid.columns);
  if (!cellOrigins) {
    return error("invalid-grid");
  }
  if (
    hasContentOutsideImportedCells(
      imageData,
      cellOrigins,
      source.characterWidth,
      source.characterHeight,
    )
  ) {
    return error("content-outside-imported-cells");
  }

  const cellWidth = source.characterWidth;
  const cellHeight = source.characterHeight;
  if (
    !isPositiveInt(targetWidth) ||
    targetWidth < cellWidth ||
    targetWidth > C3_MAX_TEXTURE_SIZE
  ) {
    return error("invalid-output-dimensions");
  }

  const newColumns = Math.floor(targetWidth / cellWidth);
  if (newColumns === oldGrid.columns) {
    return {
      kind: "no-layout-change",
      oldColumns: oldGrid.columns,
      targetWidth,
    };
  }

  const totalCharacterCount = importedCount + source.appendedCharacterCount;
  const newRows = Math.ceil(totalCharacterCount / newColumns);
  const newImageHeight = newRows * cellHeight;
  if (newImageHeight > C3_MAX_TEXTURE_SIZE) {
    return error("invalid-output-dimensions");
  }

  return {
    kind: "plan",
    targetWidth,
    newColumns,
    newRows,
    newImageHeight,
    importedCount,
    oldColumns: oldGrid.columns,
    oldFontSpriteWidth: source.fontSpriteWidth,
    oldFinalTextureHeight:
      Math.ceil(totalCharacterCount / oldGrid.columns) * cellHeight,
  };
}

/** rewrapC3ImportedCells 的可选输出控制 */
export interface C3RewrapOptions {
  /**
   * 自定义输出高度：必须是不小于方案密铺高度的整数（余量行保持透明），
   * 且不超过 C3_MAX_TEXTURE_SIZE；缺省为 plan.newImageHeight（精确密铺）。
   */
  outputHeight?: number;
}

export type C3RewrapRepackResult =
  | { kind: "ok"; image: ImageData }
  | C3RewrapError;

/**
 * 把导入字符按新列数 row-major 物理重排到新透明图。
 *
 * 输出宽度精确等于 plan.targetWidth（右侧余量透明），默认输出高度为精确密铺；
 * cell 尺寸不变、RGBA 原样拷贝、绝不缩放；全透明导入 cell 保留索引位置，
 * 输出为透明 cell。
 * 分配输出前对 plan 与 source 做完整一致性校验（fail closed，镜像精简 repack）：
 * 任何不一致都不得分配输出或读取像素。
 */
export function rewrapC3ImportedCells(
  imageData: ImageData,
  plan: C3RewrapPlan,
  source: C3CompactionSource,
  options?: C3RewrapOptions,
): C3RewrapRepackResult {
  if (!isValidImageData(imageData)) {
    return error("unreliable-canvas");
  }
  if (!isValidSource(source)) {
    return error("invalid-grid");
  }

  // plan 与 source 的一致性校验（fail closed），保证错误分类与字段校验顺序无关
  const importedCount = source.importedCharacterSet.length;
  const totalCharacterCount = importedCount + source.appendedCharacterCount;
  if (
    plan.kind !== "plan" ||
    plan.importedCount < 1 ||
    plan.importedCount !== importedCount ||
    !isPositiveInt(plan.targetWidth) ||
    plan.targetWidth < source.characterWidth ||
    plan.targetWidth > C3_MAX_TEXTURE_SIZE ||
    plan.newColumns !==
      Math.floor(plan.targetWidth / source.characterWidth) ||
    plan.newRows !== Math.ceil(totalCharacterCount / plan.newColumns) ||
    plan.newImageHeight !== plan.newRows * source.characterHeight
  ) {
    return error("invalid-output-dimensions");
  }

  const outputHeight = options?.outputHeight ?? plan.newImageHeight;
  if (
    !isPositiveInt(outputHeight) ||
    outputHeight < plan.newImageHeight ||
    outputHeight > C3_MAX_TEXTURE_SIZE
  ) {
    return error("invalid-output-dimensions");
  }

  const oldGrid = computeOldGrid(imageData, source);
  if (!oldGrid) {
    return error("invalid-grid");
  }
  // plan 必须基于同一旧网格（防 plan 生成后配置被改动）
  if (plan.oldColumns !== oldGrid.columns) {
    return error("invalid-grid");
  }

  const cellOrigins = computeC3CellOrigins(imageData, source, oldGrid.columns);
  if (!cellOrigins) {
    return error("invalid-grid");
  }

  const { width: imageWidth, data } = imageData;
  const cellWidth = source.characterWidth;
  const cellHeight = source.characterHeight;

  const output = new ImageData(plan.targetWidth, outputHeight);
  const outputData = output.data;

  for (let i = 0; i < plan.importedCount; i++) {
    const srcOrigin = cellOrigins[i];
    const newCol = i % plan.newColumns;
    const newRow = Math.floor(i / plan.newColumns);
    const dstX = newCol * cellWidth;
    const dstY = newRow * cellHeight;

    // cellOrigins 已统一做边界校验，此处逐行 subarray 拷贝、RGBA 原样
    for (let y = 0; y < cellHeight; y++) {
      const srcStart = ((srcOrigin.y + y) * imageWidth + srcOrigin.x) * 4;
      const dstStart = ((dstY + y) * plan.targetWidth + dstX) * 4;
      outputData.set(
        data.subarray(srcStart, srcStart + cellWidth * 4),
        dstStart,
      );
    }
  }

  return { kind: "ok", image: output };
}

/** 候选宽度的纯几何度量（宽度选择器「列数 × 行数 → 新高度」标注与最方标记共用） */
export interface C3RewrapCandidate {
  /** 目标输出宽度（输出图片宽度精确等于该值） */
  targetWidth: number;
  /** 列数 = floor(targetWidth / characterWidth) */
  columns: number;
  /** 行数 = ceil(totalCharacterCount / columns)（导入 + 追加） */
  rows: number;
  /** 密铺高度 = rows × characterHeight */
  imageHeight: number;
}

export interface C3RewrapCandidateInput {
  characterWidth: number;
  characterHeight: number;
  /** 总字符数（导入 + 追加） */
  totalCharacterCount: number;
}

/**
 * 计算一组候选宽度的几何度量，保持输入顺序。
 * 跳过不可应用项：非正整数宽度、列数 < 1（宽度 < characterWidth）、
 * 宽度或密铺高度越过 C3_MAX_TEXTURE_SIZE、总字符数为 0。
 * 最终能否应用仍以 computeC3RewrapPlan 的 fail-closed 校验为准。
 */
export function computeC3RewrapCandidates(
  targetWidths: readonly number[],
  input: C3RewrapCandidateInput,
): C3RewrapCandidate[] {
  const { characterWidth, characterHeight, totalCharacterCount } = input;
  if (
    !isPositiveInt(characterWidth) ||
    !isPositiveInt(characterHeight) ||
    !isNonNegativeInt(totalCharacterCount) ||
    totalCharacterCount === 0
  ) {
    return [];
  }

  const candidates: C3RewrapCandidate[] = [];
  for (const targetWidth of targetWidths) {
    if (!isPositiveInt(targetWidth) || targetWidth > C3_MAX_TEXTURE_SIZE) {
      continue;
    }
    const columns = Math.floor(targetWidth / characterWidth);
    if (columns < 1) continue;
    const rows = Math.ceil(totalCharacterCount / columns);
    const imageHeight = rows * characterHeight;
    if (imageHeight > C3_MAX_TEXTURE_SIZE) continue;
    candidates.push({ targetWidth, columns, rows, imageHeight });
  }
  return candidates;
}

/**
 * 最接近正方形候选：min |log2(W/H)|（W = 目标宽度，H = 密铺高度）；
 * 并列取总面积（W×H）更小者；仍完全并列时保留先出现者。
 * 返回 null 表示无候选。
 */
export function findMostSquareC3RewrapCandidate(
  candidates: readonly C3RewrapCandidate[],
): C3RewrapCandidate | null {
  let best: C3RewrapCandidate | null = null;
  let bestScore = Infinity;
  let bestArea = Infinity;
  for (const candidate of candidates) {
    const score = Math.abs(
      Math.log2(candidate.targetWidth / candidate.imageHeight),
    );
    const area = candidate.targetWidth * candidate.imageHeight;
    if (score < bestScore || (score === bestScore && area < bestArea)) {
      best = candidate;
      bestScore = score;
      bestArea = area;
    }
  }
  return best;
}
