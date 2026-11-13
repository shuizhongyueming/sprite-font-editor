import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEditorStore } from "@/stores/editor";
import { parseProjectFiles } from "@/utils/project-import";
import * as c3CharRenderer from "@/utils/c3-char-renderer";
import * as c3CompactionDom from "@/utils/c3-compaction-dom";

vi.mock("@/utils/storage", () => ({
  ImageStorage: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  FontStorage: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  C3ImageStorage: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  C3ConfigStorage: {
    save: vi.fn(),
    load: vi.fn().mockReturnValue(null),
    remove: vi.fn(),
  },
  C3GenerationStorage: {
    stage: vi.fn().mockImplementation(async () => "gen-test"),
    commit: vi.fn(),
    readActiveC3GenerationId: vi.fn().mockReturnValue(null),
    readC3Generation: vi.fn().mockReturnValue(null),
    readActiveC3Generation: vi.fn().mockReturnValue(null),
    loadActiveC3ImageAsset: vi.fn().mockResolvedValue(null),
    discard: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
    prune: vi.fn(),
    clearAll: vi.fn().mockResolvedValue(undefined),
  },
  C3_STORAGE_VERSION: 3,
  clearAll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/notification", () => ({
  notify: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, "naturalWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(img, "naturalHeight", {
    value: height,
    configurable: true,
  });
  img.width = width;
  img.height = height;
  return img;
}

function createMockImageLoader(width: number, height: number) {
  return vi.fn(async () => createMockImage(width, height));
}

interface AppendedEntryFixture {
  char: string;
  margin: { top: number; right: number; bottom: number; left: number };
  autoDisplayWidth: number;
  autoGlyphWidth: number;
  autoGlyphHeight: number;
  extraSpacing: number;
  distributionOffset: number;
}

function makeAppendedEntry(
  char: string,
  overrides: Partial<AppendedEntryFixture> = {},
): AppendedEntryFixture {
  return {
    char,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    autoDisplayWidth: 16,
    autoGlyphWidth: 16,
    autoGlyphHeight: 0,
    extraSpacing: 0,
    distributionOffset: 0,
    ...overrides,
  };
}

async function importProject(appendedEntries: AppendedEntryFixture[]) {
  const instanceArray = [
    "XXXX",
    true,
    16,
    16,
    "AB",
    "[]",
    1,
    2,
    4,
    0,
    0,
    0,
    true,
    null,
    false,
  ];

  const projectJson = {
    version: 2,
    exportedAt: new Date().toISOString(),
    appVersion: "0.0.0",
    mode: "c3",
    image: "c3-sprite.png",
    c3Instance: "c3-instance.json",
    state: {
      baseCellConfig: {
        width: 16,
        height: 16,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      baseImageConfig: {
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        fontSpriteWidth: 32,
        fontSpriteHeight: 32,
      },
      cellAlignment: { horizontal: "left", vertical: "middle" },
      characterStyle: {
        fontFamily: "Arial",
        fontSize: 16,
        color: "#000000",
        outline: { enabled: false, color: "#ffffff", width: 1 },
        pixelStyle: false,
      },
      insertPointConfig: { mode: "auto", startCellIndex: 0 },
      gridConfig: {
        enabled: true,
        cellBorder: true,
        cellBorderColor: "rgba(0, 255, 0, 0.5)",
        cellBorderWidth: 1,
        marginLines: false,
        marginLineColor: "rgba(255, 0, 0, 0.3)",
        paddingLines: false,
        paddingLineColor: "rgba(0, 0, 255, 0.3)",
      },
      canvasBg: "white",
      canvasViewMode: "fit",
      originalImageWidth: 32,
      originalImageHeight: 32,
      baseImageFilename: "c3-sprite.png",
      importedCharacterSet: "AB",
      importedSpacingData: "[]",
      importedCharacterSpacing: 2,
      importedLineHeight: 4,
      c3GlobalExtraSpacing: 0,
      c3AppendedVerticalAlignment: "middle",
      c3AppendedEntries: appendedEntries,
    },
  };

  const map = new Map<string, Blob>();
  map.set("project.json", new Blob([JSON.stringify(projectJson)]));
  map.set("c3-sprite.png", new Blob(["image"]));
  map.set("c3-instance.json", new Blob([JSON.stringify(instanceArray)]));

  const projectData = await parseProjectFiles(
    map,
    createMockImageLoader(32, 32),
  );

  setActivePinia(createPinia());
  const store = useEditorStore();
  await store.applyProject(projectData);
  return store;
}

describe("C3 project import auto-recalculation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(c3CompactionDom, "imageToImageData").mockReturnValue(
      new ImageData(32, 32),
    );
    vi.spyOn(c3CharRenderer, "measureGlyphBounds").mockImplementation(
      ({ text }) => ({
        width: 8,
        height: text === "A" ? 10 : 14,
        left: 2,
        top: 0,
      }),
    );
  });

  it("recalculates placeholder metrics (autoGlyphHeight 0) after import", async () => {
    const store = await importProject([
      makeAppendedEntry("A"),
      makeAppendedEntry("B"),
    ]);

    expect(store.c3AppendedEntries).toHaveLength(2);
    expect(store.c3AppendedEntries[0].autoGlyphHeight).toBe(10);
    expect(store.c3AppendedEntries[0].autoGlyphWidth).toBe(8);
    expect(store.c3AppendedEntries[1].autoGlyphHeight).toBe(14);
    // middle 分布：maxHeight 14，A 偏移 2，B 偏移 0
    expect(store.c3AppendedEntries[0].distributionOffset).toBe(2);
    expect(store.c3AppendedEntries[1].distributionOffset).toBe(0);
  });

  it("keeps already measured metrics untouched", async () => {
    const store = await importProject([
      makeAppendedEntry("A", { autoGlyphHeight: 12, distributionOffset: 3 }),
    ]);

    expect(store.c3AppendedEntries[0].autoGlyphHeight).toBe(12);
    expect(store.c3AppendedEntries[0].distributionOffset).toBe(3);
  });

  it("leaves legacy entries without autoGlyphWidth untouched", async () => {
    const legacy = makeAppendedEntry("A", { autoGlyphHeight: 0 });
    delete (legacy as Partial<AppendedEntryFixture>).autoGlyphWidth;

    const store = await importProject([legacy]);

    expect(store.c3AppendedEntries[0].autoGlyphHeight).toBe(0);
    expect(store.c3AppendedEntries[0].distributionOffset).toBe(0);
  });
});
