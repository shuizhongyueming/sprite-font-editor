# ADR 0003: Appended Character Extra Spacing

## Status

Accepted

## Context

In C3 mode, the editor lets users append new characters to an imported C3 sprite font. Each appended character has a `displayWidth` that controls how far the C3 runtime advances the pen after drawing the character.

The current editor exposes `displayWidth` directly: it auto-calculates as `measured glyph width + padding.left`, and users can manually override it. This works, but it is awkward for the common case where the user wants to add a consistent amount of breathing room after every appended character, plus a little extra for a few specific characters.

For example, a user might append the Latin alphabet and want every letter to have 2 extra pixels of advance, with the letter `i` getting 0 extra and the letter `w` getting 4 extra. With direct `displayWidth` editing, the user must compute and enter a new absolute width for every character instead of thinking in terms of "add this much spacing."

We therefore need a spacing model that is:

1. **Global**: a single default value applied to every appended character.
2. **Per-character**: an override value for individual characters.
3. **Additive**: the two values stack on top of the auto-measured glyph width.
4. **C3-compatible**: the result must still be exported as C3 `spacingData`, which only understands absolute `displayWidth` values.

## Decision

We will introduce **Appended Character Extra Spacing** as an editor-only concept layered on top of C3 `displayWidth`.

### Domain model

For every appended character `c`:

```
displayWidth(c) = autoDisplayWidth(c) + globalExtraSpacing + perCharExtraSpacing(c)
```

where:

- `autoDisplayWidth(c)` is the measured glyph pixel width plus `padding.left`, unchanged from today.
- `globalExtraSpacing` is a single number stored in the editor state, configured in the C3 panel.
- `perCharExtraSpacing(c)` is a number stored on the appended character entry, configured in the character edit popup.

Both extra spacing values default to `0`. They can be negative.

### UI changes

- The C3 panel gains a **Global appended character extra spacing** input.
- The character edit popup replaces the editable **Display Width** input with a read-only **Display Width** summary and an editable **Extra spacing** input.
- The popup continues to show the auto-measured width so the user understands how the final value is derived.

### Behavior

- Changing the global value immediately recomputes the `displayWidth` of every appended character.
- The per-character extra spacing is always added on top of the current global value.
- Only appended characters are affected; imported characters keep their original `displayWidth` from the imported `spacingData`.
- The C3 preview and exported `spacingData` use the computed `displayWidth` directly, so C3 sees the same layout as the preview.

### Persistence

- `globalExtraSpacing` is stored alongside the rest of the C3 project state.
- `perCharExtraSpacing` is stored on each persisted appended character entry.

## Alternatives Considered

### Alternative 1: Keep direct `displayWidth` editing

**Rejected because:**

- It forces users to compute absolute widths mentally when they usually want to add or subtract a fixed amount of spacing.
- It makes global adjustments tedious: changing the breathing room for every appended character requires editing each one individually.

### Alternative 2: Apply extra spacing through C3 `characterSpacing`

**Rejected because:**

- C3's `characterSpacing` is a global value that applies to **all** characters, including imported ones. That would alter the original font's layout, which violates the principle that imported characters are read-only.
- It also cannot express per-character differences.

### Alternative 3: Let global extra spacing apply only to newly appended characters

**Rejected because:**

- It is surprising: a "global" control that does not affect existing characters is hard to discover and explain.
- The additive formula makes real-time updates natural and easy to reason about.

## Consequences

### Positive

- Users can adjust spacing for many characters at once with a single global control.
- Per-character fine-tuning remains possible without abandoning the global default.
- The exported C3 `spacingData` is still valid and reflects exactly what the preview shows.
- Imported characters remain untouched.

### Negative

- We introduce an editor-specific concept that does not exist in C3; users must understand that the editor folds it into `displayWidth`.
- Changing the data model from a single `displayWidth` override to `autoDisplayWidth + global + perChar` requires a migration or defaulting strategy for existing persisted projects.
- The character edit popup gains an extra field, increasing UI complexity slightly.

## Related Documents

- `CONTEXT.md` — domain glossary entry for Appended Character Extra Spacing
- `docs/adr/0001-c3-sprite-font-mode.md` — original C3 mode design
- `src/stores/editor.ts` — editor state and appended character entries
- `src/utils/c3-export.ts` — spacing data export
