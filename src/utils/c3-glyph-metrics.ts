/**
 * C3 导入字形水平度量（bearing / overhang）实测核心（issue #21）。
 *
 * 纯算法模块：只读取 ImageData 的 alpha 通道，不依赖 DOM/Canvas，
 * 可在 vitest 中直接测试。内容判定复用精简模块的同一阈值
 * （C3_CONTENT_ALPHA_MIN，alpha < 16 视为透明）。
 *
 * 背景：C3 spritefont 排版模型中，相邻两字实际视觉间距 =
 * 后字 bearing − 前字 right overhang。追加字符原本只按
 * `glyphWidth + padding.left` 取 advance、落位不含 bearing 对齐，
 * 与导入 sheet 的实测结构不一致，导致混排时重叠/空隙。
 * 本模块从当前导入图像素实测整体 bearing/overhang 中位数，
 * 供追加字符统一水平落位与步进。
 */

import { C3_CONTENT_ALPHA_MIN } from "@/utils/c3-compaction";

/** 导入 sheet 实测出的整体水平度量 */
export interface C3GlyphMetrics {
  /** 可见左缘相对 cell 左缘的偏移（alpha bbox minX 的中位数） */
  bearing: number;
  /** rightEdge − advance（(maxX+1) − advance 的中位数，可为负） */
  overhang: number;
}

/** 单个导入 cell 的像素探针描述 */
export interface C3GlyphCellProbe {
  /** cell 在图里的像素原点 x */
  originX: number;
  /** cell 在图里的像素原点 y */
  originY: number;
  /** cell 宽（= characterWidth） */
  width: number;
  /** cell 高（= characterHeight） */
  height: number;
  /** 该字的 advance（spacing 查表值或默认 characterWidth） */
  advance: number;
}

/** 中位数：奇数个取中间值，偶数个取两中值平均后 Math.round */
function medianRounded(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * 逐 cell 扫 alpha bbox，统计导入 sheet 的整体 bearing/overhang。
 *
 * - bearing = minX（相对 cell 原点）；overhang = (maxX+1) − advance
 * - 跳过无可见像素（alpha < C3_CONTENT_ALPHA_MIN）的 cell
 * - 分别对 bearing 与 overhang 取中位数（偶数个取两中值平均后 Math.round）
 * - 有效 cell 为 0 时返回 null（调用方回退旧口径）
 */
export function measureImportedGlyphMetrics(
  imageData: ImageData,
  cells: C3GlyphCellProbe[],
): C3GlyphMetrics | null {
  const { width: imageWidth, height: imageHeight, data } = imageData;
  const bearings: number[] = [];
  const overhangs: number[] = [];

  for (const cell of cells) {
    const x0 = Math.max(0, cell.originX);
    const y0 = Math.max(0, cell.originY);
    const x1 = Math.min(imageWidth, cell.originX + cell.width);
    const y1 = Math.min(imageHeight, cell.originY + cell.height);
    if (x1 <= x0 || y1 <= y0) continue;

    let minX = Infinity;
    let maxX = -Infinity;
    for (let y = y0; y < y1; y++) {
      const rowStart = y * imageWidth;
      for (let x = x0; x < x1; x++) {
        if (data[(rowStart + x) * 4 + 3] >= C3_CONTENT_ALPHA_MIN) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (maxX < minX) continue;

    bearings.push(minX - cell.originX);
    overhangs.push(maxX + 1 - cell.originX - cell.advance);
  }

  if (bearings.length === 0) {
    return null;
  }

  return {
    bearing: medianRounded(bearings),
    overhang: medianRounded(overhangs),
  };
}

/**
 * 追加字符 advance 新口径（issue #21）：
 * metrics 存在时 = bearing + glyphWidth − overhang（Math.round 后 clamp ≥ 1），
 * 使追加字的视觉右缘（含 overhang 语义）与导入字保持一致步进；
 * metrics 缺失时回退旧口径 = glyphWidth + fallbackPaddingLeft。
 */
export function computeAppendedAdvance(
  glyphWidth: number,
  metrics: C3GlyphMetrics | null,
  fallbackPaddingLeft: number,
): number {
  if (!metrics) {
    return glyphWidth + fallbackPaddingLeft;
  }
  return Math.max(1, Math.round(metrics.bearing + glyphWidth - metrics.overhang));
}

/**
 * 水平自动偏移（全条目统一值，与 glyph 无关）：恒等于导入 sheet 的
 * 实测 bearing；metrics 缺失时 0（保持旧落位）。
 *
 * 渲染链锚定原理：renderCharacterToCellUnscaled 以 alpha bbox 裁剪结果
 * 绘制（sx = rendered.sourceX），glyph ink 左缘精确落在
 * `cellPadding.left + charMargin.left`，与字体自身 ink 偏移、outline 宽度
 * 无关。追加条目渲染可见左缘 = padding.left + autoBearingOffset +
 * margin.left = padding.left + bearing + margin.left：padding.left 为 0
 * 时精确对齐导入 bearing；padding.left 是用户全局水平微调（与垂直方向
 * padding.top + distributionOffset + margin.top 的结构对称）。
 */
export function computeBearingOffset(metrics: C3GlyphMetrics | null): number {
  return metrics ? metrics.bearing : 0;
}
