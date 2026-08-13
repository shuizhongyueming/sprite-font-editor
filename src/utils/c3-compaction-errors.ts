/**
 * C3 精简的 typed error → 用户文案映射（中英由 i18n 提供）。
 * Toolbar 与 C3CompactionModal 共用，避免重复映射。
 */

import { t } from "@/utils/i18n";
import type { C3CompactionErrorCode } from "@/utils/c3-compaction";

export function compactionErrorMessage(code: C3CompactionErrorCode): string {
  switch (code) {
    case "unreliable-canvas":
      return t("c3CompactionErrorUnreliableCanvas");
    case "alpha-roundtrip-failed":
      return t("c3CompactionErrorAlphaRoundtrip");
    case "invalid-grid":
      return t("c3CompactionErrorInvalidGrid");
    case "no-imported-content":
      return t("c3CompactionErrorNoImportedContent");
    case "content-outside-imported-cells":
      return t("c3CompactionErrorContentOutside");
    case "invalid-output-dimensions":
      return t("c3CompactionErrorInvalidDimensions");
    case "invalid-spacing-data":
      return t("c3CompactionErrorInvalidSpacing");
    case "persistence-failed":
      return t("c3CompactionErrorPersistence");
    default:
      return code;
  }
}
