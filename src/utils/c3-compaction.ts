/**
 * C3 Font Sprite 精简分析与配置迁移核心。
 *
 * 纯算法模块：像素判定只读取 alpha（alpha < C3_CONTENT_ALPHA_MIN 透明，
 * 否则为内容，RGB 忽略），不依赖 DOM/Canvas。
 * DOM 包装（图片解码、Canvas alpha 自检）与纯算法分离。
 */

/**
 * 内容判定的 alpha 阈值：alpha < 16 视为透明。
 *
 * 豁免真实素材中肉眼不可见的低 alpha 碎像素（渲染残尘、压缩噪点），
 * 同时高于 Canvas 抗指纹回读噪声（±2），远低于精灵图软阴影/辉光的真实内容。
 * 内置固定值，不向用户开放（决议见 wayfinder 地图 #11 / issue #12）。
 */
export const C3_CONTENT_ALPHA_MIN = 16

/** 四边数值（margin / padding / crop 共用） */
export interface C3Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * 精简分析/重排所需的旧网格与导入配置。
 * 所有尺寸均为自然像素（1:1、整数坐标）。
 */
export interface C3CompactionSource {
  /** 当前 Font Sprite 宽度（保持原值） */
  fontSpriteWidth: number;
  /** 当前 Font Sprite 高度 */
  fontSpriteHeight: number;
  /** 旧 characterWidth（C3 instance index 2） */
  characterWidth: number;
  /** 旧 characterHeight（C3 instance index 3） */
  characterHeight: number;
  /** 图片 margin（C3 默认 0，用于把精灵定位到更大的 atlas 中） */
  imageMargin: C3Box;
  /** 图片 padding */
  imagePadding: C3Box;
  /** Imported Character Set 的 grapheme 序列（顺序即旧 row-major 顺序） */
  importedCharacterSet: string[];
  /**
   * 当前已追加的字符数量（非负整数）。仅用于计算最终组合纹理高度（导入+追加），
   * 不参与像素/边界分析。
   */
  appendedCharacterCount: number;
}

/** 阻断错误的可判别代码。UI 依据 code 分支，不解析文案。 */
export type C3CompactionErrorCode =
  | "unreliable-canvas"
  | "alpha-roundtrip-failed"
  | "invalid-grid"
  | "no-imported-content"
  | "content-outside-imported-cells"
  | "invalid-output-dimensions"
  | "invalid-spacing-data"
  | "persistence-failed";

/** 统一的阻断错误结果 */
export interface C3CompactionError {
  kind: "error";
  code: C3CompactionErrorCode;
}

/**
 * 单个导入 cell 的内容跨度（瓶颈榜单数据）。
 * 与精简判定共用同一 alpha 阈值（C3_CONTENT_ALPHA_MIN），
 * 全透明 cell 不参与（无内容可量）。
 */
export interface C3CellExtent {
  /** 导入字符索引（row-major，对应 importedCharacterSet 下标） */
  index: number;
  /** 内容横向跨度 px = characterWidth - 左侧留白 - 右侧留白 */
  contentWidth: number;
  /** 内容竖向跨度 px = characterHeight - 顶部留白 - 底部留白 */
  contentHeight: number;
}

/**
 * 可接受的精简方案：统一四边裁剪量 + 重排后的新网格/新图尺寸。
 * 应用方把该方案交给 repackC3ImportedCells 产出新透明图片。
 */
export interface C3CompactionPlan {
  kind: "plan";
  /** 每个源 cell 的统一裁剪量（至少保留 1px 透明安全边缘） */
  crop: C3Box;
  newCharacterWidth: number;
  newCharacterHeight: number;
  /** 重排后的列数：floor(fontSpriteWidth / newCharacterWidth) */
  newColumns: number;
  /**
   * 实际导入基图宽度 = source.fontSpriteWidth（保持原值，即使最后一列留下透明余量）。
   * 与使用的列跨度（newColumns × newCharacterWidth）不同。
   */
  newImageWidth: number;
  /** 新导入基图高度 = ceil(importedCount / newColumns) × newCharacterHeight */
  newImageHeight: number;
  importedCount: number;
  /** 旧最终纹理高度（导入+追加按旧列数）= ceil(total / oldColumns) × oldCharacterHeight */
  oldFinalTextureHeight: number;
  /** 新最终纹理高度（导入+追加按新列数）= ceil(total / newColumns) × newCharacterHeight */
  newFinalTextureHeight: number;
  /** 每个非空导入 cell 的内容跨度（供预览榜单定位瓶颈字符；追加字符不参与） */
  cellExtents: C3CellExtent[];
}

/**
 * 瓶颈榜单取数：按 contentWidth/contentHeight 降序取前三名次（dense rank），
 * 名次并列的 cell 全部带出、不设硬上限——漏掉并列者会让裁剪瓶颈仍在。
 */
export function rankC3CellExtents(
  extents: C3CellExtent[],
  key: "contentWidth" | "contentHeight",
  ranks = 3,
): C3CellExtent[] {
  const sorted = [...extents].sort((a, b) => b[key] - a[key]);
  const result: C3CellExtent[] = [];
  let rank = 0;
  let previous = -1;
  for (const extent of sorted) {
    if (extent[key] !== previous) {
      rank++;
      previous = extent[key];
    }
    if (rank > ranks) break;
    result.push(extent);
  }
  return result;
}

/** 非阻断结果：无可精简收益，不允许执行无效应用 */
export interface C3CompactionNoSavings {
  kind: "no-savings";
  crop: C3Box;
}

export type C3CompactionAnalysisResult =
  | C3CompactionPlan
  | C3CompactionNoSavings
  | C3CompactionError;

function error(code: C3CompactionErrorCode): C3CompactionError {
  return { kind: "error", code };
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isBox(value: C3Box): boolean {
  return (
    isNonNegativeInt(value.top) &&
    isNonNegativeInt(value.right) &&
    isNonNegativeInt(value.bottom) &&
    isNonNegativeInt(value.left)
  );
}

export function isValidImageData(imageData: ImageData): boolean {
  return (
    imageData.width > 0 &&
    imageData.height > 0 &&
    imageData.data.length === imageData.width * imageData.height * 4
  );
}

/**
 * 校验精简/重排源配置（analyze、repack 与 rewrap 共用，fail closed）。
 * 覆盖 computeOldGrid 依赖的全部字段与追加字符数量。
 */
export function isValidSource(source: C3CompactionSource): boolean {
  return (
    isPositiveInt(source.fontSpriteWidth) &&
    isPositiveInt(source.fontSpriteHeight) &&
    isPositiveInt(source.characterWidth) &&
    isPositiveInt(source.characterHeight) &&
    isBox(source.imageMargin) &&
    isBox(source.imagePadding) &&
    isNonNegativeInt(source.appendedCharacterCount) &&
    source.importedCharacterSet.every((char) => typeof char === "string")
  );
}

/**
 * 旧网格可用宽度/高度，与 CanvasSpace.usableWidth/usableHeight 保持同一映射：
 * 取「图片扣除 padding/margin」与「fontSprite 扣除 padding」两者较小。
 * C3 cell margin 固定为 0，故列数 = floor(usable / cellSize)。
 * 导出供候选预览复用同一映射（origin/columns 唯一一致）。
 */
export function computeOldGrid(
  imageData: ImageData,
  source: C3CompactionSource,
): { columns: number; rows: number } | null {
  const { imageMargin, imagePadding, fontSpriteWidth, fontSpriteHeight } =
    source;
  const usableWidth = Math.min(
    imageData.width -
      imagePadding.left -
      imagePadding.right -
      imageMargin.left -
      imageMargin.right,
    fontSpriteWidth - imagePadding.left - imagePadding.right,
  );
  const usableHeight = Math.min(
    imageData.height -
      imagePadding.top -
      imagePadding.bottom -
      imageMargin.top -
      imageMargin.bottom,
    fontSpriteHeight - imagePadding.top - imagePadding.bottom,
  );
  const columns = Math.floor(usableWidth / source.characterWidth);
  const rows = Math.floor(usableHeight / source.characterHeight);
  if (columns < 1 || rows < 1) return null;
  return { columns, rows };
}

/**
 * 每个导入字符对应的旧 cell 左上角坐标（row-major），
 * origin = imageMargin + imagePadding（与 CanvasSpace 同一惯例）。
 * 任何 cell 越出图片边界返回 null（invalid-grid）。
 * 精简 analyze 与重排（c3-rewrap）共用同一映射，保证 origin/columns 唯一一致。
 */
export function computeC3CellOrigins(
  imageData: ImageData,
  source: C3CompactionSource,
  columns: number,
): Array<{ x: number; y: number }> | null {
  const { width: imageWidth, height: imageHeight } = imageData;
  const cellWidth = source.characterWidth;
  const cellHeight = source.characterHeight;
  const originX = source.imageMargin.left + source.imagePadding.left;
  const originY = source.imageMargin.top + source.imagePadding.top;

  const cellOrigins: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < source.importedCharacterSet.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = originX + col * cellWidth;
    const y = originY + row * cellHeight;
    if (
      x < 0 ||
      y < 0 ||
      x + cellWidth > imageWidth ||
      y + cellHeight > imageHeight
    ) {
      return null;
    }
    cellOrigins.push({ x, y });
  }
  return cellOrigins;
}

/**
 * 导入 cell 并集覆盖表之外是否存在 alpha >= C3_CONTENT_ALPHA_MIN 的内容
 * （全透明像素与 RGB 噪点不阻断）。精简 analyze 与重排共用同一覆盖表思路。
 */
export function hasContentOutsideImportedCells(
  imageData: ImageData,
  cellOrigins: ReadonlyArray<{ x: number; y: number }>,
  cellWidth: number,
  cellHeight: number,
): boolean {
  const { width: imageWidth, height: imageHeight, data } = imageData;
  const covered = new Uint8Array(imageWidth * imageHeight);
  for (const origin of cellOrigins) {
    for (let y = origin.y; y < origin.y + cellHeight; y++) {
      const rowStart = y * imageWidth;
      for (let x = origin.x; x < origin.x + cellWidth; x++) {
        covered[rowStart + x] = 1;
      }
    }
  }
  for (let y = 0; y < imageHeight; y++) {
    const rowStart = y * imageWidth;
    for (let x = 0; x < imageWidth; x++) {
      if (
        data[(rowStart + x) * 4 + 3] >= C3_CONTENT_ALPHA_MIN &&
        covered[rowStart + x] === 0
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 分析导入图片并产出精简方案。
 *
 * 输入必须是已成功导入的 C3 项目的原始导入图片（自然尺寸 ImageData）；
 * 不分析叠加了追加字符的工作画布，追加字符不参与边界分析。
 */
export function analyzeC3SpriteCompaction(
  imageData: ImageData,
  source: C3CompactionSource,
): C3CompactionAnalysisResult {
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

  const { width: imageWidth, data } = imageData;
  const cellWidth = source.characterWidth;
  const cellHeight = source.characterHeight;

  // 每个导入字符对应的旧 cell 左上角坐标（row-major；与重排共用同一映射）
  const cellOrigins = computeC3CellOrigins(imageData, source, oldGrid.columns);
  if (!cellOrigins) {
    return error("invalid-grid");
  }

  // 导入 cell 并集覆盖表之外的内容（alpha >= 阈值）阻断
  if (
    hasContentOutsideImportedCells(
      imageData,
      cellOrigins,
      cellWidth,
      cellHeight,
    )
  ) {
    return error("content-outside-imported-cells");
  }

  // 每个非空 cell（含内容像素）求四边连续透明留白；无内容 cell 不参与最小值
  let minTop = Infinity;
  let minRight = Infinity;
  let minBottom = Infinity;
  let minLeft = Infinity;
  let nonEmptyCount = 0;
  const cellExtents: C3CellExtent[] = [];

  const hasContent = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      const rowStart = y * imageWidth;
      for (let x = x0; x < x1; x++) {
        if (data[(rowStart + x) * 4 + 3] >= C3_CONTENT_ALPHA_MIN) return true;
      }
    }
    return false;
  };

  for (let i = 0; i < cellOrigins.length; i++) {
    const origin = cellOrigins[i];
    const containsAny = hasContent(
      origin.x,
      origin.y,
      origin.x + cellWidth,
      origin.y + cellHeight,
    );
    if (!containsAny) continue;
    nonEmptyCount++;

    let top = 0;
    for (let y = origin.y; y < origin.y + cellHeight; y++) {
      if (hasContent(origin.x, y, origin.x + cellWidth, y + 1)) break;
      top++;
    }

    let bottom = 0;
    for (let y = origin.y + cellHeight - 1; y >= origin.y; y--) {
      if (hasContent(origin.x, y, origin.x + cellWidth, y + 1)) break;
      bottom++;
    }

    let left = 0;
    for (let x = origin.x; x < origin.x + cellWidth; x++) {
      if (hasContent(x, origin.y, x + 1, origin.y + cellHeight)) break;
      left++;
    }

    let right = 0;
    for (let x = origin.x + cellWidth - 1; x >= origin.x; x--) {
      if (hasContent(x, origin.y, x + 1, origin.y + cellHeight)) break;
      right++;
    }

    minTop = Math.min(minTop, top);
    minRight = Math.min(minRight, right);
    minBottom = Math.min(minBottom, bottom);
    minLeft = Math.min(minLeft, left);

    cellExtents.push({
      index: i,
      contentWidth: cellWidth - left - right,
      contentHeight: cellHeight - top - bottom,
    });
  }

  if (nonEmptyCount === 0) {
    return error("no-imported-content");
  }

  // 每侧至少保留 1px 透明安全边缘
  const crop: C3Box = {
    top: Math.max(0, minTop - 1),
    right: Math.max(0, minRight - 1),
    bottom: Math.max(0, minBottom - 1),
    left: Math.max(0, minLeft - 1),
  };

  const newCharacterWidth = cellWidth - crop.left - crop.right;
  const newCharacterHeight = cellHeight - crop.top - crop.bottom;
  if (newCharacterWidth <= 0 || newCharacterHeight <= 0) {
    return error("invalid-output-dimensions");
  }

  const newColumns = Math.floor(source.fontSpriteWidth / newCharacterWidth);
  if (newColumns < 1) {
    return error("invalid-output-dimensions");
  }

  // 导入基图宽度保持 fontSpriteWidth（用户确认应用时以原 Font Sprite 宽度替换导入图片）
  const newImageWidth = source.fontSpriteWidth;
  const newImageHeight =
    Math.ceil(importedCount / newColumns) * newCharacterHeight;

  // 最终组合纹理（导入 + 追加）高度：无收益判定基于它，而非仅导入部分
  const totalCharacterCount = importedCount + source.appendedCharacterCount;
  const oldFinalTextureHeight =
    Math.ceil(totalCharacterCount / oldGrid.columns) * cellHeight;
  const newFinalTextureHeight =
    Math.ceil(totalCharacterCount / newColumns) * newCharacterHeight;

  // 四边裁剪均为 0，或最终组合纹理高度没有减少 → 非阻断 no-savings
  const cropIsZero =
    crop.top === 0 && crop.right === 0 && crop.bottom === 0 && crop.left === 0;
  if (cropIsZero || newFinalTextureHeight >= oldFinalTextureHeight) {
    return { kind: "no-savings", crop };
  }

  return {
    kind: "plan",
    crop,
    newCharacterWidth,
    newCharacterHeight,
    newColumns,
    newImageWidth,
    newImageHeight,
    importedCount,
    oldFinalTextureHeight,
    newFinalTextureHeight,
    cellExtents,
  };
}

export type C3RepackResult =
  | { kind: "ok"; image: ImageData }
  | C3CompactionError;

/**
 * 把导入字符按新 cell row-major 重排到新透明图片。
 *
 * 输出宽度固定为 source.fontSpriteWidth（保持原值），最后一列之后的余量保持透明；
 * 输出高度 = ceil(importedCount / newColumns) × newCharacterHeight。
 * 每个源 cell 只做统一的四边裁剪，字形像素（RGBA）原样拷贝、绝不缩放；
 * 全透明导入 cell 保留其索引位置，输出为透明 cell。
 * 分配输出前对 plan 与 source 做完整一致性校验（fail closed）。
 */
export function repackC3ImportedCells(
  imageData: ImageData,
  plan: C3CompactionPlan,
  source: C3CompactionSource,
): C3RepackResult {
  if (!isValidImageData(imageData)) {
    return error("unreliable-canvas");
  }
  // 先校验源配置（invalid-grid），再校验 plan 与 source 的一致性（invalid-output-dimensions），
  // 保证错误分类与字段校验顺序无关。
  if (!isValidSource(source)) {
    return error("invalid-grid");
  }
  // plan 与 source 的一致性校验（fail closed）：任何不一致都不得分配输出或读取像素。
  // 禁止 new ImageData(width, 0) / Infinity 或越界、跨 cell 读取。
  if (
    plan.importedCount < 1 ||
    plan.importedCount !== source.importedCharacterSet.length ||
    plan.crop.top < 0 ||
    plan.crop.right < 0 ||
    plan.crop.bottom < 0 ||
    plan.crop.left < 0 ||
    plan.newCharacterWidth !==
      source.characterWidth - plan.crop.left - plan.crop.right ||
    plan.newCharacterHeight !==
      source.characterHeight - plan.crop.top - plan.crop.bottom ||
    plan.newCharacterWidth <= 0 ||
    plan.newCharacterHeight <= 0 ||
    plan.newColumns < 1 ||
    plan.newColumns !==
      Math.floor(source.fontSpriteWidth / plan.newCharacterWidth) ||
    plan.newImageWidth !== source.fontSpriteWidth ||
    plan.newImageHeight !==
      Math.ceil(plan.importedCount / plan.newColumns) * plan.newCharacterHeight
  ) {
    return error("invalid-output-dimensions");
  }

  const oldGrid = computeOldGrid(imageData, source);
  if (!oldGrid) {
    return error("invalid-grid");
  }

  const { width: imageWidth, height: imageHeight, data } = imageData;
  const originX = source.imageMargin.left + source.imagePadding.left;
  const originY = source.imageMargin.top + source.imagePadding.top;

  const output = new ImageData(plan.newImageWidth, plan.newImageHeight);
  const outputData = output.data;

  for (let i = 0; i < plan.importedCount; i++) {
    const oldCol = i % oldGrid.columns;
    const oldRow = Math.floor(i / oldGrid.columns);
    const srcX = originX + oldCol * source.characterWidth + plan.crop.left;
    const srcY = originY + oldRow * source.characterHeight + plan.crop.top;
    const newCol = i % plan.newColumns;
    const newRow = Math.floor(i / plan.newColumns);
    const dstX = newCol * plan.newCharacterWidth;
    const dstY = newRow * plan.newCharacterHeight;

    if (
      srcX < 0 ||
      srcY < 0 ||
      srcX + plan.newCharacterWidth > imageWidth ||
      srcY + plan.newCharacterHeight > imageHeight
    ) {
      return error("invalid-grid");
    }

    for (let y = 0; y < plan.newCharacterHeight; y++) {
      const srcStart = ((srcY + y) * imageWidth + srcX) * 4;
      const dstStart = ((dstY + y) * plan.newImageWidth + dstX) * 4;
      outputData.set(
        data.subarray(srcStart, srcStart + plan.newCharacterWidth * 4),
        dstStart,
      );
    }
  }

  return { kind: "ok", image: output };
}

export interface C3SpacingMigrationResult {
  kind: "migrated";
  /** 迁移后的 spacingData JSON 字符串（宽度等于旧 characterWidth 的冗余项已删除） */
  spacingData: string;
  keptEntries: number;
  removedEntries: number;
}

export type C3SpacingMigrationOutcome = C3SpacingMigrationResult | C3CompactionError;

/**
 * 迁移 spacingData 到新的 characterWidth。
 *
 * 规则：宽度不等于旧 `characterWidth` 的实际生效项原值保留（分组与字符原样）；
 * 等于旧 `characterWidth` 的冗余项删除（C3 在旧配置中忽略它们，保留到新宽度下会意外
 * 变成显式 override）；不裁剪量不作用于显式步进。未覆盖字符默认跟随新 characterWidth，
 * 由调用方处理。
 */
export function migrateC3SpacingData(
  spacingData: string,
  oldCharacterWidth: number,
): C3SpacingMigrationOutcome {
  if (!isPositiveInt(oldCharacterWidth)) {
    return error("invalid-grid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(spacingData);
  } catch {
    return error("invalid-spacing-data");
  }
  if (!Array.isArray(parsed)) {
    return error("invalid-spacing-data");
  }

  const kept: Array<[number, string]> = [];
  let removedEntries = 0;

  for (const tuple of parsed) {
    if (
      !Array.isArray(tuple) ||
      tuple.length !== 2 ||
      typeof tuple[0] !== "number" ||
      typeof tuple[1] !== "string"
    ) {
      return error("invalid-spacing-data");
    }
    if (tuple[0] === oldCharacterWidth) {
      removedEntries++;
      continue;
    }
    kept.push([tuple[0], tuple[1]]);
  }

  return {
    kind: "migrated",
    spacingData: JSON.stringify(kept),
    keptEntries: kept.length,
    removedEntries,
  };
}

/**
 * 纯函数：比较两个像素缓冲的 alpha 通道是否一致（RGB 忽略）。
 * DOM 包装层用它做 putImageData/getImageData round-trip 判定。
 * tolerance 为每像素允许的 alpha 绝对偏差，默认 0（完全一致）。
 */
export function alphaRoundTrips(
  source: ImageData,
  readback: ImageData,
  tolerance = 0,
): boolean {
  if (
    source.width !== readback.width ||
    source.height !== readback.height ||
    source.data.length !== readback.data.length
  ) {
    return false;
  }
  for (let i = 3; i < source.data.length; i += 4) {
    if (Math.abs(source.data[i] - readback.data[i]) > tolerance) return false;
  }
  return true;
}

/**
 * DOM 包装 seam：Canvas alpha round-trip 自检（fail closed）。
 *
 * 用含 alpha 0/1/254/255 的探针做 putImageData/getImageData 并比对读回；
 * 逐像素容差 ±2：Chrome 151+ (macOS) 的 Canvas 预乘/half-float 路径对低
 * alpha 值存在稳定的 ±1 读回漂移（实测全量 0..255 扫描，见 issue #6），
 * 该量级对阈值 16 的内容判定和 PNG 导出均无影响。
 * context 创建、putImageData、getImageData 失败，或读回偏差超过容差
 * （清零、随机化等真实腐坏）时返回 false，调用方应禁止预览与应用。
 */
export function verifyCanvasAlphaRoundTrip(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return false;
    }

    const probe = new ImageData(4, 1);
    const alphas = [0, 1, 254, 255];
    for (let i = 0; i < alphas.length; i++) {
      const idx = i * 4;
      probe.data[idx] = 128;
      probe.data[idx + 1] = 200;
      probe.data[idx + 2] = 40;
      probe.data[idx + 3] = alphas[i];
    }

    ctx.putImageData(probe, 0, 0);
    const readback = ctx.getImageData(0, 0, 4, 1);
    return alphaRoundTrips(probe, readback, 2);
  } catch {
    return false;
  }
}
