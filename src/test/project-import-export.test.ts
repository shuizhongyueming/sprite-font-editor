import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useEditorStore } from "@/stores/editor";
import { exportProjectToZip, buildProjectFiles } from "@/utils/project-export";
import {
  parseProjectFiles,
  readZipProject,
  ProjectImportError,
} from "@/utils/project-import";
import { parseC3InstanceArray } from "@/utils/c3-parser";
import type { C3InstanceArray } from "@/utils/c3-parser";
import { FontStorage } from "@/utils/storage";

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
  return vi.fn(async (blob: Blob) => {
    void blob;
    return createMockImage(width, height);
  });
}

function createC3Array(characterSet: string = "AB"): C3InstanceArray {
  return [
    "Sample",
    true,
    16,
    16,
    characterSet,
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
  ] as unknown as C3InstanceArray;
}

describe("project import/export", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should round-trip normal mode project files", async () => {
    const store = useEditorStore();
    const image = createMockImage(64, 64);
    await store.setBaseImage(image, undefined, "sprite.png");

    store.baseCellConfig = {
      width: 16,
      height: 16,
      margin: { top: 1, right: 2, bottom: 3, left: 4 },
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    store.baseImageConfig = {
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    };
    store.cellAlignment = { horizontal: "left", vertical: "top" };
    store.characterStyle = {
      fontFamily: "Arial",
      fontSize: 20,
      color: "#ff0000",
      outline: { enabled: true, color: "#000000", width: 2 },
      pixelStyle: true,
    };
    store.insertPointConfig = { mode: "manual", startCellIndex: 3 };
    store.gridConfig = {
      enabled: false,
      cellBorder: false,
      cellBorderColor: "rgba(0,0,0,0.5)",
      cellBorderWidth: 2,
      marginLines: true,
      marginLineColor: "rgba(255,0,0,0.5)",
      paddingLines: true,
      paddingLineColor: "rgba(0,0,255,0.5)",
    };
    store.canvasBg = "black";
    store.canvasViewMode = "actual";
    store.characterEntries = [
      { char: "A", margin: { top: 0, right: 0, bottom: 0, left: 0 } },
      { char: "B", margin: { top: 1, right: 1, bottom: 1, left: 1 } },
    ];

    const files = await buildProjectFiles(store);

    expect(files.projectJson.version).toBe(2);
    expect(files.projectJson.mode).toBe("normal");
    expect(files.projectJson.state.characterEntries).toHaveLength(2);
    expect(files.imageFilename).toBe("sprite.png");

    const map = new Map<string, Blob>();
    map.set(
      "project.json",
      new Blob([JSON.stringify(files.projectJson, null, 2)]),
    );
    map.set(files.imageFilename, files.imageBlob);

    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(64, 64),
    );

    expect(projectData.mode).toBe("normal");
    expect(projectData.state.characterEntries).toEqual(store.characterEntries);
    expect(projectData.state.baseCellConfig).toEqual(store.baseCellConfig);
    expect(projectData.state.canvasBg).toBe("black");
    expect(projectData.imageFilename).toBe("sprite.png");

    // Apply to a fresh store and verify persistence
    setActivePinia(createPinia());
    const targetStore = useEditorStore();
    await targetStore.applyProject(projectData);

    expect(targetStore.isC3Mode).toBe(false);
    expect(targetStore.characterEntries).toEqual(store.characterEntries);
    expect(targetStore.baseCellConfig).toEqual(store.baseCellConfig);
    expect(targetStore.canvasBg).toBe("black");
    expect(targetStore.baseImageFilename).toBe("sprite.png");
    expect(targetStore.originalImageWidth).toBe(64);
    expect(targetStore.originalImageHeight).toBe(64);
  });

  it("should round-trip C3 mode project files including appended entries", async () => {
    const store = useEditorStore();
    const image = createMockImage(64, 64);
    const array = createC3Array("AB");
    const parsed = parseC3InstanceArray(JSON.stringify(array));

    store.importC3SpriteFont(
      image,
      array,
      parsed,
      "c3-sprite.png",
      64,
      64,
    );
    store.c3GlobalExtraSpacing = 4;
    store.appendC3Characters(["C"]);
    store.updateC3AppendedExtraSpacing(0, 2);

    const files = await buildProjectFiles(store);

    expect(files.projectJson.version).toBe(2);
    expect(files.projectJson.mode).toBe("c3");
    expect(files.projectJson.c3Instance).toBe("c3-instance.json");
    expect(files.projectJson.state.c3AppendedEntries).toHaveLength(1);
    expect(files.projectJson.state.c3GlobalExtraSpacing).toBe(4);
    expect(files.projectJson.state.c3AppendedVerticalAlignment).toBe("middle");
    expect(files.imageFilename).toBe("c3-sprite.png");

    const map = new Map<string, Blob>();
    map.set(
      "project.json",
      new Blob([JSON.stringify(files.projectJson, null, 2)]),
    );
    map.set(files.imageFilename, files.imageBlob);
    map.set(
      files.projectJson.c3Instance!,
      new Blob([JSON.stringify(files.c3InstanceArray, null, 2)]),
    );

    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(64, 64),
    );

    expect(projectData.mode).toBe("c3");
    expect(projectData.c3InstanceArray).toEqual(array);
    expect(projectData.state.importedCharacterSet).toBe("AB");
    expect(projectData.state.c3GlobalExtraSpacing).toBe(4);
    expect(projectData.state.c3AppendedEntries?.[0].char).toBe("C");
    expect(projectData.state.c3AppendedEntries?.[0].extraSpacing).toBe(2);

    setActivePinia(createPinia());
    const targetStore = useEditorStore();
    await targetStore.applyProject(projectData);

    expect(targetStore.isC3Mode).toBe(true);
    expect(targetStore.c3InstanceArray).toEqual(array);
    expect(targetStore.importedCharacterSet).toBe("AB");
    expect(targetStore.c3GlobalExtraSpacing).toBe(4);
    expect(targetStore.c3AppendedEntries).toHaveLength(1);
    expect(targetStore.c3AppendedEntries[0].char).toBe("C");
    expect(targetStore.c3ImportedImageFilename).toBe("c3-sprite.png");
  });

  it("should support ZIP round-trip", async () => {
    const store = useEditorStore();
    const image = createMockImage(32, 32);
    await store.setBaseImage(image, undefined, "sheet.png");
    store.characterEntries = [{ char: "X", margin: { top: 0, right: 0, bottom: 0, left: 0 } }];

    const zipBlob = await exportProjectToZip(store);
    const map = await readZipProject(zipBlob);

    expect(map.has("project.json")).toBe(true);
    expect(map.has("sheet.png")).toBe(true);

    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(32, 32),
    );

    expect(projectData.mode).toBe("normal");
    expect(projectData.state.characterEntries).toEqual(store.characterEntries);
  });

  it("should leave the store unchanged when import validation fails", async () => {
    const store = useEditorStore();
    const image = createMockImage(64, 64);
    await store.setBaseImage(image, undefined, "sprite.png");
    store.characterEntries = [{ char: "A", margin: { top: 0, right: 0, bottom: 0, left: 0 } }];
    store.canvasBg = "black";

    const originalEntries = [...store.characterEntries];
    const originalCanvasBg = store.canvasBg;

    const emptyMap = new Map<string, Blob>();

    await expect(parseProjectFiles(emptyMap)).rejects.toBeInstanceOf(
      ProjectImportError,
    );

    expect(store.characterEntries).toEqual(originalEntries);
    expect(store.canvasBg).toBe(originalCanvasBg);
    expect(store.baseImage).toBe(image);
  });

  it("should fail when image dimensions do not match metadata", async () => {
    const store = useEditorStore();
    const image = createMockImage(64, 64);
    await store.setBaseImage(image, undefined, "sprite.png");

    const files = await buildProjectFiles(store);
    const map = new Map<string, Blob>();
    map.set(
      "project.json",
      new Blob([JSON.stringify(files.projectJson, null, 2)]),
    );
    map.set(files.imageFilename, files.imageBlob);

    await expect(
      parseProjectFiles(map, createMockImageLoader(128, 128)),
    ).rejects.toBeInstanceOf(ProjectImportError);
  });

  it("should round-trip a custom font file", async () => {
    const store = useEditorStore();
    const image = createMockImage(32, 32);
    await store.setBaseImage(image, undefined, "sprite.png");

    const fontData = new ArrayBuffer(8);
    store.fontFilename = "custom-font.ttf";
    vi.mocked(FontStorage.load).mockResolvedValueOnce({
      name: "CustomFont",
      data: fontData,
    });

    const files = await buildProjectFiles(store);

    expect(files.fontFilename).toBe("custom-font.ttf");
    expect(files.fontBlob).toBeDefined();

    const map = new Map<string, Blob>();
    map.set(
      "project.json",
      new Blob([JSON.stringify(files.projectJson, null, 2)]),
    );
    map.set(files.imageFilename, files.imageBlob);
    map.set(files.fontFilename!, files.fontBlob!);

    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(32, 32),
    );

    expect(projectData.font).toBeDefined();
    expect(projectData.font!.filename).toBe("custom-font.ttf");
    expect(projectData.font!.data.byteLength).toBe(fontData.byteLength);

    setActivePinia(createPinia());
    const targetStore = useEditorStore();
    await targetStore.applyProject(projectData);

    expect(targetStore.fontFilename).toBe("custom-font.ttf");
  });

  it("should migrate version-1 C3 projects to version 2", async () => {
    const array = createC3Array("AB");

    const v1ProjectJson = {
      version: 1,
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
          fontSpriteWidth: 64,
          fontSpriteHeight: 64,
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
        canvasBg: "white" as const,
        canvasViewMode: "fit" as const,
        originalImageWidth: 64,
        originalImageHeight: 64,
        baseImageFilename: "c3-sprite.png",
        importedCharacterSet: "AB",
        importedSpacingData: "[]",
        importedCharacterSpacing: 0,
        importedLineHeight: 0,
        c3GlobalExtraSpacing: 0,
        c3AppendedEntries: [
          {
            char: "C",
            margin: { top: 4, right: 0, bottom: 0, left: 0 },
            autoDisplayWidth: 8,
            autoGlyphHeight: 12,
            extraSpacing: 0,
          },
          {
            char: "D",
            margin: { top: 2, right: 0, bottom: 0, left: 0 },
            autoDisplayWidth: 8,
            autoGlyphHeight: 6,
            extraSpacing: 0,
          },
        ],
      },
    };

    const map = new Map<string, Blob>();
    map.set(
      "project.json",
      new Blob([JSON.stringify(v1ProjectJson, null, 2)]),
    );
    map.set("c3-sprite.png", new Blob(["image"]));
    map.set(
      "c3-instance.json",
      new Blob([JSON.stringify(array, null, 2)]),
    );

    const projectData = await parseProjectFiles(
      map,
      createMockImageLoader(64, 64),
    );

    expect(projectData.state.c3AppendedVerticalAlignment).toBe("middle");
    expect(projectData.state.c3AppendedEntries).toHaveLength(2);
    expect(projectData.state.c3AppendedEntries![0].margin.top).toBe(0);
    expect(projectData.state.c3AppendedEntries![1].margin.top).toBe(0);
    expect(projectData.state.c3AppendedEntries![0].distributionOffset).toBe(0);
    expect(projectData.state.c3AppendedEntries![1].distributionOffset).toBe(3);

    setActivePinia(createPinia());
    const targetStore = useEditorStore();
    await targetStore.applyProject(projectData);

    expect(targetStore.c3AppendedVerticalAlignment).toBe("middle");
    expect(targetStore.c3AppendedEntries[0].margin.top).toBe(0);
    expect(targetStore.c3AppendedEntries[1].margin.top).toBe(0);
  });
});
