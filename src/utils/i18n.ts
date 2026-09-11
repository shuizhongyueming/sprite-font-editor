/**
 * i18n 国际化模块
 * 支持中文和英文，便于扩展其他语言
 */

import { ref, computed } from "vue";

export type Locale = "zh-CN" | "en-US";

export interface Translations {
  // Toolbar
  uploadImage: string;
  uploadFont: string;
  exportImage: string;
  insertPoint: string;
  autoMode: string;
  manualMode: string;
  clearAll: string;
  canvasBackground: string;
  bgWhite: string;
  bgBlack: string;
  bgCheckerboard: string;

  // ImageConfig
  fontSpriteSize: string;
  imageMargin: string;
  imagePadding: string;

  // CellConfig
  cellSize: string;
  cellMargin: string;
  cellPadding: string;
  alignment: string;
  horizontal: string;
  vertical: string;
  leftAlign: string;
  centerAlign: string;
  rightAlign: string;
  topAlign: string;
  middleAlign: string;
  bottomAlign: string;
  gridDisplay: string;
  gridLines: string;
  cellBorder: string;
  marginLine: string;
  paddingLine: string;
  borderColor: string;
  borderWidth: string;
  autoDetect: string;
  manualSelect: string;

  // CharStyle
  font: string;
  fontSize: string;
  textColor: string;
  enableOutline: string;
  outlineColor: string;
  outlineWidth: string;
  fontNotLoaded: string;
  fontLoaded: string;
  pixelStyle: string;

  // CharacterInput
  inputText: string;
  inputTextPlaceholder: string;
  charCount: string;
  clear: string;
  renderText: string;
  editMargin: string;
  marginLabel: string;
  confirm: string;

  // InsertPointInfo
  currentMode: string;
  highlightedCell: string;
  gridSize: string;
  nextEmptyCell: string;
  notFound: string;
  detecting: string;
  detectionThreshold: string;
  detectionStatus: string;
  disabled: string;
  foundCount: string;

  // Additional
  row: string;
  col: string;
  rows: string;
  cols: string;
  index: string;
  clickToHighlight: string;

  // Control Panel
  imageSettings: string;
  gridSettings: string;
  charStyle: string;
  charInput: string;
  insertPointInfo: string;

  // Language Switcher
  switchLanguage: string;

  // Auto Detect Grid
  autoDetectGrid: string;
  noImageLoaded: string;
  canvasNotReady: string;
  gridDetectionFailed: string;
  gridDetectionSuccess: string;

  // Canvas View Mode
  viewFitToView: string;
  viewActualSize: string;
  viewZoom: string;
  spacePanHint: string;

  // Notifications
  invalidImageFile: string;
  invalidFontFile: string;
  imageLoadFailed: string;
  fontLoadSuccess: string;
  fontLoadFailed: string;
  pleaseUploadImage: string;
  exportSuccess: string;
  exportFailed: string;
  renderComplete: string;
  cleared: string;
  confirmClear: string;

  // Project Import/Export
  projectMenu: string;
  importProject: string;
  exportProject: string;
  saveProject: string;
  saveProjectSuccess: string;
  saveProjectFailed: string;
  exportingProject: string;
  projectImportSuccess: string;
  projectImportFailed: string;
  projectExportSuccess: string;
  projectExportFailed: string;
  confirmImportProject: string;
  projectImageDimensionMismatch: string;
  projectFontLoadWarning: string;

  // C3 Sprite Font
  importC3SpriteFont: string;
  c3ImportTitle: string;
  c3ImportImage: string;
  c3ImportArray: string;
  c3Validate: string;
  c3Import: string;
  c3ImportSuccess: string;
  c3ImportError: string;
  c3ReimportConfirm: string;
  c3ModeActive: string;
  c3ImportedCount: string;
  c3AppendedCount: string;
  c3CellConfigLocked: string;
  c3FontSpriteSize: string;
  c3FontSpriteWidth: string;
  c3FontSpriteHeight: string;
  c3ImageTooSmallError: string;
  c3ParseSuccess: string;
  c3StorageVersionMismatch: string;
  c3SaveFailed: string;
  c3AppendPlaceholder: string;
  c3DuplicateChars: string;
  c3DuplicateCharsSkipped: string;
  c3AppendButton: string;
  c3AppendSuccess: string;
  c3DisplayWidth: string;
  c3AutoDisplayWidth: string;
  c3FinalDisplayWidth: string;
  c3GlyphHeight: string;
  c3DistributionOffset: string;
  c3ExtraSpacing: string;
  c3ResetExtraSpacing: string;
  c3GlobalExtraSpacing: string;
  c3ResetAuto: string;
  c3AppendedVerticalAlignment: string;
  c3AutoFitSpriteSize: string;
  c3SpriteSizeOverflowWarning: string;
  c3FinalTopOffset: string;
  c3Preview: string;
  c3SampleText: string;
  c3ResetSampleText: string;
  c3CollapsePreview: string;
  c3ExpandPreview: string;
  c3ShowMore: string;
  c3ShowLess: string;
  c3ExportTitle: string;
  c3ExportCopy: string;
  c3ExportCopied: string;
  c3ExportSuccess: string;

  // C3 精简（issue #10）
  c3CompactButton: string;
  c3CompactButtonTitle: string;
  c3CompactButtonTooltip: string;
  c3CompactionAnalyzing: string;
  c3CompactionNoSavings: string;
  c3CompactionModalTitle: string;
  c3CompactionModalSubtitle: string;
  c3CompactionMetricCell: string;
  c3CompactionMetricColumns: string;
  c3CompactionMetricImported: string;
  c3CompactionMetricFinal: string;
  c3CompactionMetricRgba: string;
  c3CompactionMetricSavings: string;
  c3CompactionBottleneckTitle: string;
  c3CompactionBottleneckWidth: string;
  c3CompactionBottleneckHeight: string;
  c3CompactionBottleneckThumbAlt: string;
  c3CompactionTabSprite: string;
  c3CompactionTabText: string;
  c3CompactionOldBaseline: string;
  c3CompactionNewBaseline: string;
  c3CompactionZoomFit: string;
  c3CompactionZoomActual: string;
  c3CompactionZoom: string;
  c3CompactionSampleText: string;
  c3CompactionResetSample: string;
  c3CompactionConfigDetails: string;
  c3CompactionConfigCharSet: string;
  c3CompactionConfigSpacing: string;
  c3CompactionConfigKeep: string;
  c3CompactionCaveatSpacing: string;
  c3CompactionCaveatNoScale: string;
  c3CompactionCaveatStrictClip: string;
  c3CompactionCaveatNoUndo: string;
  c3CompactionApply: string;
  c3CompactionApplySuccess: string;
  c3CompactionApplyFailed: string;
  c3CompactionAnalyzeFailed: string;
  c3CompactionErrorUnreliableCanvas: string;
  c3CompactionErrorAlphaRoundtrip: string;
  c3CompactionErrorInvalidGrid: string;
  c3CompactionErrorNoImportedContent: string;
  c3CompactionErrorContentOutside: string;
  c3CompactionErrorInvalidDimensions: string;
  c3CompactionErrorInvalidSpacing: string;
  c3CompactionErrorPersistence: string;
  c3RewrapButton: string;
  c3RewrapButtonTitle: string;
  c3RewrapButtonTooltip: string;
  c3RewrapModalTitle: string;
  c3RewrapModalSubtitle: string;
  c3RewrapWidthLabel: string;
  c3RewrapChipMostSquare: string;
  c3RewrapChipTooNarrow: string;
  c3RewrapChipTooTall: string;
  c3RewrapWidthErrorInteger: string;
  c3RewrapWidthErrorMin: string;
  c3RewrapWidthErrorMax: string;
  c3RewrapWidthErrorTall: string;
  c3RewrapHeightErrorInteger: string;
  c3RewrapHeightErrorMin: string;
  c3RewrapHeightErrorMax: string;
  c3RewrapNoLayoutChange: string;
  c3RewrapMetricWidth: string;
  c3RewrapMetricColumns: string;
  c3RewrapMetricFinal: string;
  c3RewrapMetricRgba: string;
  c3RewrapTabSprite: string;
  c3RewrapTabText: string;
  c3RewrapOldBaseline: string;
  c3RewrapNewBaseline: string;
  c3RewrapZoomFit: string;
  c3RewrapZoomActual: string;
  c3RewrapZoom: string;
  c3RewrapSampleText: string;
  c3RewrapResetSample: string;
  c3RewrapConfigDetails: string;
  c3RewrapConfigSpriteSize: string;
  c3RewrapConfigCharSet: string;
  c3RewrapCaveatCell: string;
  c3RewrapCaveatNoScale: string;
  c3RewrapCaveatMargin: string;
  c3RewrapCaveatNoUndo: string;
  c3RewrapApply: string;
  c3RewrapApplying: string;
  c3RewrapApplySuccess: string;
  c3RewrapApplyFailed: string;
  c3RewrapErrorUnreliableCanvas: string;
  c3RewrapErrorAlphaRoundtrip: string;
  c3RewrapErrorInvalidGrid: string;
  c3RewrapErrorNoImportedContent: string;
  c3RewrapErrorContentOutside: string;
  c3RewrapErrorInvalidDimensions: string;
  c3RewrapErrorInvalidSpacing: string;
  c3RewrapErrorPersistence: string;

  // DimensionsInput
  width: string;
  height: string;

  // Common
  ok: string;
  cancel: string;
  N_A: string;
}

export const translations: Record<Locale, Translations> = {
  "zh-CN": {
    // Toolbar
    uploadImage: "上传图片",
    uploadFont: "上传字体",
    exportImage: "导出图片",
    insertPoint: "插入点:",
    autoMode: "自动",
    manualMode: "手动",
    clearAll: "清空",
    projectMenu: "项目",
    importProject: "导入项目",
    exportProject: "导出项目",
    saveProject: "保存项目",
    saveProjectSuccess: "项目已保存",
    saveProjectFailed: "项目保存失败：{message}",
    exportingProject: "导出中...",
    projectImportSuccess: "项目导入成功！",
    projectImportFailed: "项目导入失败：{message}",
    projectExportSuccess: "项目导出成功！",
    projectExportFailed: "项目导出失败：{message}",
    confirmImportProject: "导入项目将覆盖当前编辑器状态，是否继续？",
    projectImageDimensionMismatch: "图片尺寸与项目元数据不匹配",
    projectFontLoadWarning: "项目字体加载失败，已回退到系统字体",
    canvasBackground: "画布背景",
    bgWhite: "白色",
    bgBlack: "黑色",
    bgCheckerboard: "棋盘",

    // ImageConfig
    fontSpriteSize: "Font Sprite 尺寸",
    imageMargin: "外边距 (margin)",
    imagePadding: "内边距 (padding)",

    // CellConfig
    cellSize: "单元格尺寸",
    cellMargin: "单元格间距 (margin)",
    cellPadding: "字符内边距 (padding)",
    alignment: "对齐方式",
    horizontal: "水平:",
    vertical: "垂直:",
    leftAlign: "左对齐",
    centerAlign: "居中",
    rightAlign: "右对齐",
    topAlign: "顶部",
    middleAlign: "居中",
    bottomAlign: "底部",
    gridDisplay: "网格显示",
    gridLines: "网格线",
    cellBorder: "边框",
    marginLine: "margin",
    paddingLine: "padding",
    borderColor: "边框颜色",
    borderWidth: "宽度",
    autoDetect: "自动检测",
    manualSelect: "手动选择",

    // CharStyle
    font: "字体",
    fontSize: "字体大小",
    textColor: "文字颜色",
    enableOutline: "启用描边",
    outlineColor: "描边颜色",
    outlineWidth: "描边宽度",
    fontNotLoaded: "未加载",
    fontLoaded: "已加载",
    pixelStyle: "像素风",

    // CharacterInput
    inputText: "输入文字",
    inputTextPlaceholder: "请输入要渲染的文字...",
    charCount: "共 {count} 个字符",
    clear: "清空",
    renderText: "渲染文字",
    editMargin: "编辑边距:",
    marginLabel: "边距",
    confirm: "确定",

    // InsertPointInfo
    currentMode: "当前模式:",
    highlightedCell: "高亮单元格:",
    gridSize: "网格尺寸:",
    nextEmptyCell: "下一个空单元格:",
    notFound: "未找到",
    detecting: "检测中...",
    detectionThreshold: "检测阈值:",
    detectionStatus: "检测状态:",
    disabled: "已禁用",
    foundCount: "已找到 {count} 个",

    // Additional
    row: "第",
    col: "列",
    rows: "行",
    cols: "列",
    index: "索引",
    clickToHighlight: "点击高亮字符",

    // Control Panel
    imageSettings: "图片设置",
    gridSettings: "网格设置",
    charStyle: "字符样式",
    charInput: "字符输入",
    insertPointInfo: "插入点信息",

    // Language Switcher
    switchLanguage: "切换语言",

    // Auto Detect Grid
    autoDetectGrid: "自动划分网格",
    noImageLoaded: "请先上传图片",
    canvasNotReady: "画布未就绪",
    gridDetectionFailed: "无法自动检测网格，请手动调整",
    gridDetectionSuccess:
      "网格检测成功！尺寸: {width}x{height}，网格: {rows}行×{cols}列",

    // Canvas View Mode
    viewFitToView: "适应窗口",
    viewActualSize: "1:1",
    viewZoom: "{percent}%",
    spacePanHint: "按住 Space 拖拽",

    // Notifications
    invalidImageFile: "请选择有效的图片文件 (PNG, JPG, GIF, WebP)",
    invalidFontFile: "请选择有效的字体文件 (TTF, OTF, WOFF)",
    imageLoadFailed: "图片加载失败",
    fontLoadSuccess: "字体上传成功！",
    fontLoadFailed: "字体加载失败",
    pleaseUploadImage: "请先上传图片",
    exportSuccess: "图片导出成功！",
    exportFailed: "导出失败，请重试",
    renderComplete: "字符渲染完成",
    cleared: "已清空所有内容",
    confirmClear: "确定要清空所有内容吗？",

    // C3 Sprite Font
    importC3SpriteFont: "导入 C3 Sprite Font",
    c3ImportTitle: "导入 C3 Sprite Font",
    c3ImportImage: "选择图片",
    c3ImportArray: "C3 实例数组 JSON",
    c3Validate: "验证",
    c3Import: "导入",
    c3ImportSuccess: "C3 Sprite Font 导入成功！",
    c3ImportError: "导入失败：{message}",
    c3ReimportConfirm:
      "重新导入将覆盖当前 C3 项目和所有追加字符，是否继续？",
    c3ModeActive: "C3 模式",
    c3ImportedCount: "已导入字符：{count}",
    c3AppendedCount: "已追加字符：{count}",
    c3CellConfigLocked: "C3 模式下单元格边距和对齐方式已固定",
    c3FontSpriteSize: "Font Sprite 尺寸",
    c3FontSpriteWidth: "Font Sprite 宽度",
    c3FontSpriteHeight: "Font Sprite 高度",
    c3ImageTooSmallError:
      "图片只能容纳 {capacity} 个字符，当前字符集有 {count} 个，超出部分将被省略",
    c3ParseSuccess: "验证成功：{count} 个字符",
    c3StorageVersionMismatch: "C3 项目存储版本不匹配，请重新导入",
    c3SaveFailed: "C3 项目保存失败，最近的修改可能无法在刷新后保留",
    c3AppendPlaceholder: "输入要追加的字符...",
    c3DuplicateChars: "以下字符已存在：{chars}",
    c3DuplicateCharsSkipped: "以下字符已存在，已跳过：{chars}",
    c3AppendButton: "追加",
    c3AppendSuccess: "成功追加 {count} 个字符",
    c3DisplayWidth: "显示宽度",
    c3AutoDisplayWidth: "自动宽度",
    c3FinalDisplayWidth: "最终显示宽度",
    c3GlyphHeight: "字符高度",
    c3DistributionOffset: "分布偏移",
    c3ExtraSpacing: "额外间距",
    c3ResetExtraSpacing: "重置额外间距",
    c3GlobalExtraSpacing: "全局追加字符额外间距",
    c3ResetAuto: "自动",
    c3AppendedVerticalAlignment: "追加字符垂直分布",
    c3AutoFitSpriteSize: "自动适配全部字符",
    c3SpriteSizeOverflowWarning:
      "字符数量已超出当前图片容量，请调大 Font Sprite 尺寸或点击「自动适配全部字符」",
    c3FinalTopOffset: "最终顶部偏移",
    c3Preview: "C3 预览",
    c3SampleText: "示例文本",
    c3ResetSampleText: "重置示例文本",
    c3CollapsePreview: "收起预览",
    c3ExpandPreview: "展开预览",
    c3ShowMore: "显示全部",
    c3ShowLess: "收起",
    c3ExportTitle: "导出 C3 Sprite Font",
    c3ExportCopy: "复制到剪贴板",
    c3ExportCopied: "已复制",
    c3ExportSuccess: "C3 Sprite Font 导出成功！",
    c3CompactButton: "精简",
    c3CompactButtonTitle: "精简 Font Sprite（C3）",
    c3CompactButtonTooltip:
      "分析导入图片的透明留白，缩小 cell 与最终纹理高度并重排导入字符；显式 spacing 保留，追加字符不缩放，应用后不可撤销",
    c3CompactionAnalyzing: "正在分析导入图片…",
    c3CompactionNoSavings: "当前图片无可精简收益（无透明留白可裁或纹理高度不减少）",
    c3CompactionModalTitle: "精简 Font Sprite — 应用前确认",
    c3CompactionModalSubtitle:
      "Imported Character Set {imported} 字符 + 追加 {appended} 字符（仍动态渲染）",
    c3CompactionMetricCell: "cell 尺寸",
    c3CompactionMetricColumns: "列数",
    c3CompactionMetricImported: "导入基线",
    c3CompactionMetricFinal: "最终纹理",
    c3CompactionMetricRgba: "RGBA 估算",
    c3CompactionMetricSavings: "纹理高度节省",
    c3CompactionBottleneckTitle: "瓶颈字符（仅导入字符，前三名次并列全列出）",
    c3CompactionBottleneckWidth: "横向最宽",
    c3CompactionBottleneckHeight: "竖向最高",
    c3CompactionBottleneckThumbAlt: "字符 cell 缩略图",
    c3CompactionTabSprite: "Sprite",
    c3CompactionTabText: "C3 文本",
    c3CompactionOldBaseline: "旧当前基线",
    c3CompactionNewBaseline: "新精简后基线",
    c3CompactionZoomFit: "适应窗口",
    c3CompactionZoomActual: "1:1",
    c3CompactionZoom: "缩放",
    c3CompactionSampleText: "示例文本",
    c3CompactionResetSample: "重置",
    c3CompactionConfigDetails: "配置变化（C3 indices 2/3/4/5 · spacing 迁移）",
    c3CompactionConfigCharSet: "仍只含 Imported Character Set（{count} 字符，不烘焙追加）",
    c3CompactionConfigSpacing: "显式步进保留（仅删除等于旧 characterWidth {width} 的冗余项）",
    c3CompactionConfigKeep: "保持同值",
    c3CompactionCaveatSpacing: "spacingData 显式步进原样保留（仅删除等于旧 characterWidth 的冗余项）",
    c3CompactionCaveatNoScale: "追加字符的字体/字号/间距/测量数据不重新计算、不缩放",
    c3CompactionCaveatStrictClip: "超出新 cell 的内容会被严格裁切在各自 cell 内",
    c3CompactionCaveatNoUndo: "应用精简后无法撤销（旧导入图与旧配置将被替换）",
    c3CompactionApply: "应用精简",
    c3CompactionApplySuccess: "精简已应用",
    c3CompactionApplyFailed: "应用精简失败",
    c3CompactionAnalyzeFailed: "精简分析失败，请重试",
    c3CompactionErrorUnreliableCanvas: "无法可靠读取画布像素，请重试",
    c3CompactionErrorAlphaRoundtrip: "当前画布无法无损保留透明通道（alpha round-trip 失败），已阻止精简",
    c3CompactionErrorInvalidGrid: "当前 C3 网格配置无效，无法分析",
    c3CompactionErrorNoImportedContent: "导入图片中未检测到可见字符内容",
    c3CompactionErrorContentOutside: "导入字符 cell 之外存在像素内容，已阻止精简",
    c3CompactionErrorInvalidDimensions: "精简输出尺寸无效",
    c3CompactionErrorInvalidSpacing: "spacing 数据无效，无法迁移",
    c3CompactionErrorPersistence: "候选数据保存失败，请重试",

    // C3 Sprite Re-wrap（重排）
    c3RewrapButton: "重排",
    c3RewrapButtonTitle: "重排 Font Sprite（C3）",
    c3RewrapButtonTooltip:
      "仅改变换行列数（512/1024/2048/4096 快选或自定义宽度），把导入字符像素按新列数物理重排；cell 尺寸、字符顺序与 spacingData 不变，追加字符按新布局重渲染，应用后不可撤销",
    c3RewrapModalTitle: "重排 Font Sprite — 应用前确认",
    c3RewrapModalSubtitle:
      "Imported Character Set {imported} 字符 + 追加 {appended} 字符；仅改变换行列数，cell 尺寸 {width}×{height} 与字符顺序不变",
    c3RewrapWidthLabel: "目标宽度",
    c3RewrapChipMostSquare: "最方",
    c3RewrapChipTooNarrow: "宽度小于字符宽度 {width}px，不可用",
    c3RewrapChipTooTall: "按此宽度密铺高度超过 {max}px 上限，不可用",
    c3RewrapWidthErrorInteger: "宽度必须是整数",
    c3RewrapWidthErrorMin: "宽度不能小于字符宽度 {width}px",
    c3RewrapWidthErrorMax: "宽度不能超过 {max}px",
    c3RewrapWidthErrorTall: "按此宽度密铺高度超过 {max}px 上限",
    c3RewrapHeightErrorInteger: "高度必须是整数",
    c3RewrapHeightErrorMin: "高度不能小于密铺高度 {height}px",
    c3RewrapHeightErrorMax: "高度不能超过 {max}px",
    c3RewrapNoLayoutChange: "该宽度与当前列数相同，布局无变化，无需重排",
    c3RewrapMetricWidth: "目标宽度",
    c3RewrapMetricColumns: "列数",
    c3RewrapMetricFinal: "最终纹理",
    c3RewrapMetricRgba: "RGBA 估算",
    c3RewrapTabSprite: "Sprite",
    c3RewrapTabText: "C3 文本",
    c3RewrapOldBaseline: "旧当前基线",
    c3RewrapNewBaseline: "新重排后基线",
    c3RewrapZoomFit: "适应窗口",
    c3RewrapZoomActual: "1:1",
    c3RewrapZoom: "缩放",
    c3RewrapSampleText: "示例文本",
    c3RewrapResetSample: "重置",
    c3RewrapConfigDetails: "配置变化（仅 Font Sprite 尺寸 · cell 与 spacingData 不变）",
    c3RewrapConfigSpriteSize: "[2] characterWidth / [3] characterHeight: 保持同值",
    c3RewrapConfigCharSet:
      "[4] characterSet / [5] spacingData: 保持同值（重排不做 spacing 迁移）",
    c3RewrapCaveatCell:
      "cell 尺寸与字符顺序不变，仅改变换行列数；右侧与底部余量保持透明",
    c3RewrapCaveatNoScale:
      "追加字符的字体/字号/间距/测量数据不重新计算、不缩放，按新布局重渲染",
    c3RewrapCaveatMargin: "应用后 image margin/padding 归零",
    c3RewrapCaveatNoUndo: "应用重排后无法撤销（旧导入图与旧配置将被替换）",
    c3RewrapApply: "应用重排",
    c3RewrapApplying: "正在应用重排…",
    c3RewrapApplySuccess: "重排已应用",
    c3RewrapApplyFailed: "应用重排失败",
    c3RewrapErrorUnreliableCanvas: "无法可靠读取画布像素，请重试",
    c3RewrapErrorAlphaRoundtrip:
      "当前画布无法无损保留透明通道（alpha round-trip 失败），已阻止重排",
    c3RewrapErrorInvalidGrid: "当前 C3 网格配置无效，无法重排",
    c3RewrapErrorNoImportedContent: "导入图片中未检测到可见字符内容",
    c3RewrapErrorContentOutside: "导入字符 cell 之外存在像素内容，已阻止重排",
    c3RewrapErrorInvalidDimensions: "重排输出尺寸无效",
    c3RewrapErrorInvalidSpacing: "spacing 数据无效，无法渲染文本预览",
    c3RewrapErrorPersistence: "候选数据保存失败，请重试",

    // DimensionsInput
    width: "宽度",
    height: "高度",

    // Common
    ok: "确定",
    cancel: "取消",
    N_A: "N/A",
  },
  "en-US": {
    // Toolbar
    uploadImage: "Upload Image",
    uploadFont: "Upload Font",
    exportImage: "Export Image",
    insertPoint: "Insert Point:",
    autoMode: "Auto",
    manualMode: "Manual",
    clearAll: "Clear All",
    projectMenu: "Project",
    importProject: "Import Project",
    exportProject: "Export Project",
    saveProject: "Save Project",
    saveProjectSuccess: "Project saved",
    saveProjectFailed: "Project save failed: {message}",
    exportingProject: "Exporting...",
    projectImportSuccess: "Project imported successfully!",
    projectImportFailed: "Project import failed: {message}",
    projectExportSuccess: "Project exported successfully!",
    projectExportFailed: "Project export failed: {message}",
    confirmImportProject: "Importing a project will overwrite the current editor state. Continue?",
    projectImageDimensionMismatch: "Image dimensions do not match project metadata",
    projectFontLoadWarning: "Failed to load project font, falling back to system font",
    canvasBackground: "Canvas Background",
    bgWhite: "White",
    bgBlack: "Black",
    bgCheckerboard: "Checkerboard",

    // ImageConfig
    fontSpriteSize: "Font Sprite Size",
    imageMargin: "Margin",
    imagePadding: "Padding",

    // CellConfig
    cellSize: "Cell Size",
    cellMargin: "Cell Margin",
    cellPadding: "Character Padding",
    alignment: "Alignment",
    horizontal: "Horizontal:",
    vertical: "Vertical:",
    leftAlign: "Left",
    centerAlign: "Center",
    rightAlign: "Right",
    topAlign: "Top",
    middleAlign: "Middle",
    bottomAlign: "Bottom",
    gridDisplay: "Grid Display",
    gridLines: "Grid Lines",
    cellBorder: "Border",
    marginLine: "Margin",
    paddingLine: "Padding",
    borderColor: "Color",
    borderWidth: "Width",
    autoDetect: "Auto Detect",
    manualSelect: "Manual Select",

    // CharStyle
    font: "Font",
    fontSize: "Font Size",
    textColor: "Text Color",
    enableOutline: "Enable Outline",
    outlineColor: "Outline Color",
    outlineWidth: "Outline Width",
    fontNotLoaded: "Not Loaded",
    fontLoaded: "Loaded",
    pixelStyle: "Pixel Style",

    // CharacterInput
    inputText: "Input Text",
    inputTextPlaceholder: "Enter text to render...",
    charCount: "{count} characters",
    clear: "Clear",
    renderText: "Render Text",
    editMargin: "Edit Margin:",
    marginLabel: "Margin",
    confirm: "OK",

    // InsertPointInfo
    currentMode: "Current Mode:",
    highlightedCell: "Highlighted Cell:",
    gridSize: "Grid Size:",
    nextEmptyCell: "Next Empty Cell:",
    notFound: "Not Found",
    detecting: "Detecting...",
    detectionThreshold: "Detection Threshold:",
    detectionStatus: "Detection Status:",
    disabled: "Disabled",
    foundCount: "Found {count}",

    // Additional
    row: "Row",
    col: "Col",
    rows: "rows",
    cols: "cols",
    index: "Index",
    clickToHighlight: "Click to highlight character",

    // Control Panel
    imageSettings: "Image Settings",
    gridSettings: "Grid Settings",
    charStyle: "Character Style",
    charInput: "Character Input",
    insertPointInfo: "Insert Point Info",

    // Language Switcher
    switchLanguage: "Switch Language",

    // Auto Detect Grid
    autoDetectGrid: "Auto Detect Grid",
    noImageLoaded: "Please upload an image first",
    canvasNotReady: "Canvas not ready",
    gridDetectionFailed:
      "Cannot detect grid automatically, please adjust manually",
    gridDetectionSuccess:
      "Grid detected! Size: {width}x{height}, Grid: {rows}×{cols}",

    // Canvas View Mode
    viewFitToView: "Fit to view",
    viewActualSize: "1:1",
    viewZoom: "{percent}%",
    spacePanHint: "Hold Space to pan",

    // Notifications
    invalidImageFile: "Please select a valid image file (PNG, JPG, GIF, WebP)",
    invalidFontFile: "Please select a valid font file (TTF, OTF, WOFF)",
    imageLoadFailed: "Failed to load image",
    fontLoadSuccess: "Font uploaded successfully!",
    fontLoadFailed: "Failed to load font",
    pleaseUploadImage: "Please upload an image first",
    exportSuccess: "Image exported successfully!",
    exportFailed: "Export failed, please try again",
    renderComplete: "Character rendering complete",
    cleared: "All content cleared",
    confirmClear: "Are you sure you want to clear all content?",

    // C3 Sprite Font
    importC3SpriteFont: "Import C3 Sprite Font",
    c3ImportTitle: "Import C3 Sprite Font",
    c3ImportImage: "Select Image",
    c3ImportArray: "C3 Instance Array JSON",
    c3Validate: "Validate",
    c3Import: "Import",
    c3ImportSuccess: "C3 Sprite Font imported successfully!",
    c3ImportError: "Import failed: {message}",
    c3ReimportConfirm:
      "Re-importing will overwrite the current C3 project and any appended characters. Continue?",
    c3ModeActive: "C3 Mode",
    c3ImportedCount: "Imported characters: {count}",
    c3AppendedCount: "Appended characters: {count}",
    c3CellConfigLocked: "Cell margin and alignment are fixed in C3 mode",
    c3FontSpriteSize: "Font Sprite Size",
    c3FontSpriteWidth: "Font Sprite Width",
    c3FontSpriteHeight: "Font Sprite Height",
    c3ImageTooSmallError:
      "The image can only hold {capacity} characters, but the character set has {count}; excess characters will be omitted",
    c3ParseSuccess: "Validation successful: {count} characters",
    c3StorageVersionMismatch:
      "C3 project storage version mismatch, please re-import",
    c3SaveFailed:
      "Failed to save the C3 project; recent changes may not survive a refresh",
    c3AppendPlaceholder: "Enter characters to append...",
    c3DuplicateChars: "Characters already exist: {chars}",
    c3DuplicateCharsSkipped: "Characters already exist, skipped: {chars}",
    c3AppendButton: "Append",
    c3AppendSuccess: "{count} character(s) appended",
    c3DisplayWidth: "Display Width",
    c3AutoDisplayWidth: "Auto Width",
    c3FinalDisplayWidth: "Final Display Width",
    c3GlyphHeight: "Glyph Height",
    c3DistributionOffset: "Distribution Offset",
    c3ExtraSpacing: "Extra Spacing",
    c3ResetExtraSpacing: "Reset Extra Spacing",
    c3GlobalExtraSpacing: "Global Appended Extra Spacing",
    c3ResetAuto: "Auto",
    c3AppendedVerticalAlignment: "Appended Vertical Alignment",
    c3AutoFitSpriteSize: "Auto-fit All Characters",
    c3SpriteSizeOverflowWarning:
      "Character count exceeds current image capacity. Increase the Font Sprite Size or click \"Auto-fit All Characters\".",
    c3FinalTopOffset: "Final Top Offset",
    c3Preview: "C3 Preview",
    c3SampleText: "Sample Text",
    c3ResetSampleText: "Reset Sample Text",
    c3CollapsePreview: "Collapse Preview",
    c3ExpandPreview: "Expand Preview",
    c3ShowMore: "Show more",
    c3ShowLess: "Show less",
    c3ExportTitle: "Export C3 Sprite Font",
    c3ExportCopy: "Copy to Clipboard",
    c3ExportCopied: "Copied",
    c3ExportSuccess: "C3 Sprite Font exported successfully!",
    c3CompactButton: "Compact",
    c3CompactButtonTitle: "Compact C3 Font Sprite",
    c3CompactButtonTooltip:
      "Analyze transparent margins of the imported image, shrink cells and the final texture height, and re-layout imported characters; explicit spacing is kept, appended characters are not scaled, and the change is not undoable",
    c3CompactionAnalyzing: "Analyzing the imported image…",
    c3CompactionNoSavings:
      "No compaction benefit (no transparent margin to crop or texture height does not shrink)",
    c3CompactionModalTitle: "Compact Font Sprite — confirm before applying",
    c3CompactionModalSubtitle:
      "Imported Character Set {imported} chars + {appended} appended (still rendered dynamically)",
    c3CompactionMetricCell: "Cell size",
    c3CompactionMetricColumns: "Columns",
    c3CompactionMetricImported: "Imported baseline",
    c3CompactionMetricFinal: "Final texture",
    c3CompactionMetricRgba: "RGBA estimate",
    c3CompactionMetricSavings: "Texture height saved",
    c3CompactionBottleneckTitle: "Bottleneck characters (imported only, top 3 ranks incl. ties)",
    c3CompactionBottleneckWidth: "Widest",
    c3CompactionBottleneckHeight: "Tallest",
    c3CompactionBottleneckThumbAlt: "Character cell thumbnail",
    c3CompactionTabSprite: "Sprite",
    c3CompactionTabText: "C3 Text",
    c3CompactionOldBaseline: "Current baseline",
    c3CompactionNewBaseline: "Compacted baseline",
    c3CompactionZoomFit: "Fit",
    c3CompactionZoomActual: "1:1",
    c3CompactionZoom: "Zoom",
    c3CompactionSampleText: "Sample text",
    c3CompactionResetSample: "Reset",
    c3CompactionConfigDetails: "Config changes (C3 indices 2/3/4/5 · spacing migration)",
    c3CompactionConfigCharSet: "Keeps only the Imported Character Set ({count} chars, appended not baked in)",
    c3CompactionConfigSpacing: "Explicit steps kept (only entries equal to the old characterWidth {width} are removed)",
    c3CompactionConfigKeep: "kept unchanged",
    c3CompactionCaveatSpacing:
      "Explicit spacingData steps are kept (only entries equal to the old characterWidth are removed)",
    c3CompactionCaveatNoScale:
      "Appended characters are not remeasured or scaled (font/size/spacing/metrics stay)",
    c3CompactionCaveatStrictClip:
      "Content overflowing the new cell is strictly clipped to its cell",
    c3CompactionCaveatNoUndo:
      "Applying compaction cannot be undone (old image and config are replaced)",
    c3CompactionApply: "Apply compaction",
    c3CompactionApplySuccess: "Compaction applied",
    c3CompactionApplyFailed: "Failed to apply compaction",
    c3CompactionAnalyzeFailed: "Failed to analyze compaction, please retry",
    c3CompactionErrorUnreliableCanvas: "Failed to read canvas pixels reliably, please retry",
    c3CompactionErrorAlphaRoundtrip:
      "This canvas cannot preserve the alpha channel losslessly (alpha round-trip failed); compaction is blocked",
    c3CompactionErrorInvalidGrid: "The current C3 grid configuration is invalid",
    c3CompactionErrorNoImportedContent: "No visible character content detected in the imported image",
    c3CompactionErrorContentOutside:
      "Pixel content exists outside the imported character cells; compaction is blocked",
    c3CompactionErrorInvalidDimensions: "Invalid compaction output dimensions",
    c3CompactionErrorInvalidSpacing: "Invalid spacing data, cannot migrate",
    c3CompactionErrorPersistence: "Failed to save the candidate data, please retry",

    // C3 Sprite Re-wrap
    c3RewrapButton: "Re-wrap",
    c3RewrapButtonTitle: "Re-wrap C3 Font Sprite",
    c3RewrapButtonTooltip:
      "Change only the wrap column count (512/1024/2048/4096 presets or a custom width) and physically re-flow imported characters to the new layout; cell size, character order and spacingData stay unchanged, appended characters are re-rendered at their new positions, and the change is not undoable",
    c3RewrapModalTitle: "Re-wrap Font Sprite — confirm before applying",
    c3RewrapModalSubtitle:
      "Imported Character Set {imported} chars + {appended} appended; only the wrap column count changes, cell size {width}×{height} and character order stay unchanged",
    c3RewrapWidthLabel: "Target width",
    c3RewrapChipMostSquare: "Most square",
    c3RewrapChipTooNarrow: "Width is below the character width {width}px; not available",
    c3RewrapChipTooTall:
      "Exact tiling at this width exceeds the {max}px limit; not available",
    c3RewrapWidthErrorInteger: "Width must be an integer",
    c3RewrapWidthErrorMin: "Width must not be below the character width {width}px",
    c3RewrapWidthErrorMax: "Width must not exceed {max}px",
    c3RewrapWidthErrorTall: "Exact tiling at this width exceeds the {max}px limit",
    c3RewrapHeightErrorInteger: "Height must be an integer",
    c3RewrapHeightErrorMin:
      "Height must not be below the exact tiling height {height}px",
    c3RewrapHeightErrorMax: "Height must not exceed {max}px",
    c3RewrapNoLayoutChange:
      "This width keeps the current column count; nothing to re-wrap",
    c3RewrapMetricWidth: "Target width",
    c3RewrapMetricColumns: "Columns",
    c3RewrapMetricFinal: "Final texture",
    c3RewrapMetricRgba: "RGBA estimate",
    c3RewrapTabSprite: "Sprite",
    c3RewrapTabText: "C3 Text",
    c3RewrapOldBaseline: "Current baseline",
    c3RewrapNewBaseline: "Rewrapped baseline",
    c3RewrapZoomFit: "Fit",
    c3RewrapZoomActual: "1:1",
    c3RewrapZoom: "Zoom",
    c3RewrapSampleText: "Sample text",
    c3RewrapResetSample: "Reset",
    c3RewrapConfigDetails:
      "Config changes (Font Sprite size only · cell and spacingData unchanged)",
    c3RewrapConfigSpriteSize: "[2] characterWidth / [3] characterHeight: kept unchanged",
    c3RewrapConfigCharSet:
      "[4] characterSet / [5] spacingData: kept unchanged (no spacing migration in re-wrap)",
    c3RewrapCaveatCell:
      "Cell size and character order stay unchanged; only the wrap column count changes, with right/bottom margins left transparent",
    c3RewrapCaveatNoScale:
      "Appended characters are not remeasured or scaled (font/size/spacing/metrics stay), only re-rendered at their new positions",
    c3RewrapCaveatMargin: "Image margin/padding are zeroed after applying",
    c3RewrapCaveatNoUndo:
      "Applying a re-wrap cannot be undone (old image and config are replaced)",
    c3RewrapApply: "Apply re-wrap",
    c3RewrapApplying: "Applying re-wrap…",
    c3RewrapApplySuccess: "Re-wrap applied",
    c3RewrapApplyFailed: "Failed to apply re-wrap",
    c3RewrapErrorUnreliableCanvas: "Failed to read canvas pixels reliably, please retry",
    c3RewrapErrorAlphaRoundtrip:
      "This canvas cannot preserve the alpha channel losslessly (alpha round-trip failed); re-wrap is blocked",
    c3RewrapErrorInvalidGrid: "The current C3 grid configuration is invalid",
    c3RewrapErrorNoImportedContent:
      "No visible character content detected in the imported image",
    c3RewrapErrorContentOutside:
      "Pixel content exists outside the imported character cells; re-wrap is blocked",
    c3RewrapErrorInvalidDimensions: "Invalid re-wrap output dimensions",
    c3RewrapErrorInvalidSpacing: "Invalid spacing data, cannot render the text preview",
    c3RewrapErrorPersistence: "Failed to save the candidate data, please retry",

    // DimensionsInput
    width: "Width",
    height: "Height",

    // Common
    ok: "OK",
    cancel: "Cancel",
    N_A: "N/A",
  },
};

// 响应式语言状态
const localeState = ref<Locale>("en-US");

/**
 * 获取当前语言设置
 */
export function getLocale(): Locale {
  return localeState.value;
}

/**
 * 设置当前语言
 */
export function setLocale(locale: Locale): void {
  localeState.value = locale;
  document.documentElement.lang = locale;
}

/**
 * 当前语言是否为中文
 */
export const isChinese = computed(() => localeState.value === "zh-CN");

/**
 * 翻译函数
 * 支持带参数的翻译，如 t('charCount', { count: 5 }) 替换 {count} 占位符
 */
export function t<K extends keyof Translations>(
  key: K,
  params?: Record<string, string | number>,
): string {
  let text = translations[localeState.value][key];

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
    }
  }

  return text;
}

/**
 * 获取浏览器推荐语言
 */
export function getBrowserLocale(): Locale {
  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith("zh")) {
    return "zh-CN";
  }
  return "en-US";
}

/**
 * 初始化语言设置
 * 从 localStorage 恢复或使用浏览器推荐语言
 */
export function initLocale(): Locale {
  const stored = localStorage.getItem("locale") as Locale | null;

  if (stored && (stored === "zh-CN" || stored === "en-US")) {
    setLocale(stored);
    return stored;
  }

  const browserLocale = getBrowserLocale();
  setLocale(browserLocale);
  return browserLocale;
}

/**
 * 切换语言并保存
 */
export function toggleLocale(): void {
  const newLocale = localeState.value === "zh-CN" ? "en-US" : "zh-CN";
  setLocale(newLocale);
  localStorage.setItem("locale", newLocale);
}

/**
 * 设置语言并保存
 */
export function setLanguage(locale: Locale): void {
  setLocale(locale);
  localStorage.setItem("locale", locale);
}
