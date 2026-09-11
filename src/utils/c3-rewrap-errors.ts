/**
 * C3 重排的 typed error → 用户文案映射（中英由 i18n 提供）。
 * 目前由 C3RewrapModal 使用（prepare/apply/文本预览失败路径共用，避免重复映射）。
 */

import { t } from "@/utils/i18n";
import type { C3CompactionErrorCode } from "@/utils/c3-compaction";
import type {
  C3RewrapApplyErrorCode,
  C3RewrapPreparationErrorCode,
} from "@/stores/editor";

export function rewrapErrorMessage(
  code:
    | C3RewrapApplyErrorCode
    | C3RewrapPreparationErrorCode
    | C3CompactionErrorCode,
): string {
  switch (code) {
    case "unreliable-canvas":
      return t("c3RewrapErrorUnreliableCanvas");
    case "alpha-roundtrip-failed":
      return t("c3RewrapErrorAlphaRoundtrip");
    case "invalid-grid":
      return t("c3RewrapErrorInvalidGrid");
    case "no-imported-content":
      return t("c3RewrapErrorNoImportedContent");
    case "content-outside-imported-cells":
      return t("c3RewrapErrorContentOutside");
    case "invalid-output-dimensions":
      return t("c3RewrapErrorInvalidDimensions");
    case "invalid-spacing-data":
      return t("c3RewrapErrorInvalidSpacing");
    case "persistence-failed":
      return t("c3RewrapErrorPersistence");
    case "no-layout-change":
      return t("c3RewrapNoLayoutChange");
    default:
      return code;
  }
}
