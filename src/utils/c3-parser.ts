import { splitGraphemes } from "@/utils/grapheme";

/**
 * Construct 3 Sprite Font instance array
 * Indices 0-14 cover the fields exported by C3; additional fields may follow
 */
export type C3InstanceArray = [
  string, // 0: _text
  boolean, // 1: _enableBBCode
  number, // 2: _characterWidth
  number, // 3: _characterHeight
  string, // 4: _characterSet
  string, // 5: spacingData
  number, // 6: _characterScale
  number, // 7: _characterSpacing
  number, // 8: _lineHeight
  number, // 9: _horizontalAlign
  number, // 10: _verticalAlign
  number, // 11: _wrapByWord
  boolean, // 12: initially-visible
  unknown, // 13: origin
  boolean, // 14: read-aloud
  ...unknown[], // future fields
];

/**
 * Structured data parsed from a C3 instance array
 */
export interface C3ParsedData {
  characterWidth: number;
  characterHeight: number;
  characterSet: string[];
  spacingData: string;
  characterSpacing: number;
  lineHeight: number;
  displayWidthMap: Map<string, number>;
  spaceWidth: number | null;
  rawArray: C3InstanceArray;
}

export class C3ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "C3ParseError";
  }
}

function assertSpacingData(value: unknown): asserts value is Array<[number, string]> {
  if (!Array.isArray(value)) {
    throw new C3ParseError("spacingData must be a JSON array");
  }

  for (const tuple of value) {
    if (!Array.isArray(tuple) || tuple.length !== 2) {
      throw new C3ParseError(
        "spacingData entries must be [number, string] arrays",
      );
    }

    if (typeof tuple[0] !== "number" || typeof tuple[1] !== "string") {
      throw new C3ParseError(
        "spacingData entries must be [number, string] arrays",
      );
    }
  }
}

/**
 * Parse a C3 Sprite Font instance array JSON string into structured data
 */
export function parseC3InstanceArray(input: string): C3ParsedData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new C3ParseError("Invalid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new C3ParseError("Input must be a JSON array");
  }

  if (parsed.length < 6) {
    throw new C3ParseError("Array must contain at least 6 elements");
  }

  const characterWidth = parsed[2];
  const characterHeight = parsed[3];
  const characterSetRaw = parsed[4];
  const spacingDataRaw = parsed[5];

  if (
    typeof characterWidth !== "number" ||
    !Number.isInteger(characterWidth) ||
    characterWidth <= 0
  ) {
    throw new C3ParseError("characterWidth must be a positive integer");
  }

  if (
    typeof characterHeight !== "number" ||
    !Number.isInteger(characterHeight) ||
    characterHeight <= 0
  ) {
    throw new C3ParseError("characterHeight must be a positive integer");
  }

  if (typeof characterSetRaw !== "string") {
    throw new C3ParseError("characterSet must be a string");
  }

  if (typeof spacingDataRaw !== "string") {
    throw new C3ParseError("spacingData must be a string");
  }

  let spacingTuples: unknown;
  try {
    spacingTuples = JSON.parse(spacingDataRaw);
  } catch {
    throw new C3ParseError("spacingData is not valid JSON");
  }

  assertSpacingData(spacingTuples);

  const characterSet = splitGraphemes(characterSetRaw);

  const displayWidthMap = new Map<string, number>();

  for (const [width, chars] of spacingTuples as Array<[number, string]>) {
    if (width === characterWidth) {
      // C3 ignores spacing entries whose width equals the cell width
      continue;
    }

    for (const char of splitGraphemes(chars)) {
      displayWidthMap.set(char, width);
    }
  }

  const spaceWidth = displayWidthMap.has(" ")
    ? (displayWidthMap.get(" ") ?? null)
    : null;

  return {
    characterWidth,
    characterHeight,
    characterSet,
    spacingData: spacingDataRaw,
    characterSpacing: typeof parsed[7] === "number" ? parsed[7] : 0,
    lineHeight: typeof parsed[8] === "number" ? parsed[8] : 0,
    displayWidthMap,
    spaceWidth,
    rawArray: parsed as C3InstanceArray,
  };
}
