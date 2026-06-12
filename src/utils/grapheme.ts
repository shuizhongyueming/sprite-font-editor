/**
 * Grapheme cluster splitting utilities
 * Uses Intl.Segmenter to match Construct 3's SplitGraphemes behavior
 */

/**
 * Split a string into grapheme clusters using Intl.Segmenter.
 * Throws a clear error if Intl.Segmenter is not available.
 */
export function splitGraphemes(text: string): string[] {
  if (typeof Intl === "undefined" || !Intl.Segmenter) {
    throw new Error(
      "Your browser does not support Intl.Segmenter, which is required for grapheme cluster splitting. Please upgrade to a modern browser.",
    );
  }

  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (segment) => segment.segment);
}
