# ADR 0004: Project Import/Export

## Status

Accepted

## Context

The Sprite Font Editor currently persists its state automatically to `localStorage` and `IndexedDB` so a single editing session can survive page reloads. This works well for one continuous task, but it does not let users:

- Switch between multiple distinct works.
- Share an editable snapshot with another machine or teammate.
- Re-adjust a previous design after starting something new.
- Use external scripts to generate or mutate configurations.

Users need an explicit **Project** concept: a portable bundle that contains everything required to restore an editable editing session, with a human- and script-editable JSON configuration at its center.

## Decision

We will add a **Project import/export** feature. A Project is a folder (or a ZIP archive containing that folder) with the following structure:

```
my-project/
├── project.json          # editor metadata, mode, and editable configuration
├── image.png             # original base image (preserves original filename)
├── c3-instance.json      # original C3 instance array (C3 mode only)
└── font.ttf              # optional custom font file
```

### Scope

A Project covers **both** the normal sprite-font mode and C3 mode. The top-level `mode` field in `project.json` is `"normal"` or `"c3"`; the editor restores the corresponding mode on import.

### Import semantics

- Importing a Project **replaces** the current editor state.
- If the current editor has any state, a confirmation dialog is shown first.
- After a successful import, the automatic `localStorage` / `IndexedDB` snapshot is overwritten so the imported Project becomes the active session.
- Import is **transactional**: files are parsed and validated into a temporary structure; the editor state is only replaced after every required asset succeeds.

### C3 mode specifics

Project export in C3 mode stores the **editable source**, not the rendered output:

- The exported image is the **original imported C3 sprite sheet** (without appended characters baked in).
- `c3-instance.json` contains the **original imported C3 instance array**.
- `project.json` stores the appended character entries (`appendedEntries`), the global extra spacing, and other editor-specific C3 state.

This preserves the ability to re-edit appended characters after re-import. The font file is included because re-rendering appended characters requires it.

### Import/export mechanism

Because web browsers have limited file-system access, we support two paths:

- **Folder path** (preferred): uses the File System Access API (`showDirectoryPicker`) for export and `<input type="file" webkitdirectory>` for import.
- **ZIP path** (fallback for export; additional entry for import): export produces a downloadable ZIP when the File System Access API is unavailable; import accepts either a folder or a dropped ZIP file.

### Versioning and migration

`project.json` carries a `version` field starting at `1`. Import enforces:

- Unknown/future versions fail with a clear error.
- Older versions are upgraded through a chain of migration functions before the state is applied.

Additional metadata fields (`exportedAt`, `appVersion`) are included for debugging and file management but are not part of the compatibility contract.

### Error handling

| Scenario | Handling |
|----------|----------|
| Missing or unreadable `project.json` | Hard error |
| Unsupported `version` | Hard error |
| Missing base image | Hard error |
| Missing `c3-instance.json` in C3 mode | Hard error |
| Invalid C3 instance array | Hard error |
| Missing or corrupt font file | Warning; import continues with fallback font |
| Extra files in the folder | Ignored |

## Alternatives Considered

### Alternative 1: Project covers only one mode

We could have limited Project import/export to either normal mode or C3 mode. This was rejected because "Project" in user language means "everything I am working on now," and surfacing mode-specific project types would create a confusing split between two different save/load workflows.

### Alternative 2: Store the rendered C3 image instead of the original imported image

We could have exported the final rendered sprite sheet (imported characters + appended characters) and the effective C3 instance array. This would make the Project self-contained without requiring the font file, but it would turn previously appended characters into read-only imported characters on re-import. That conflicts with the goal of re-adjusting a project, so it was rejected.

### Alternative 3: Single-file project (JSON + base64 image)

We could have encoded the image as base64 inside `project.json`. This was rejected because:

- Base64 images are hard for scripts to edit and inflate file size.
- Keeping image and JSON as separate files matches the user's stated mental model ("a folder containing JSON and the base image").
- It allows users to swap the image file directly when batch-processing projects.

### Alternative 4: Only folder import/export, no ZIP fallback

We could have required the File System Access API for both directions. This was rejected because it would lock Firefox and Safari users out of the feature entirely.

## Consequences

### Positive

- Users can switch between multiple projects and archive old work.
- Projects are script-editable: tools can generate characters, adjust spacing, or batch-modify configurations.
- The editable-source model for C3 keeps appended characters adjustable across import/export cycles.
- Versioning and migrations give us a clear path to evolve the schema without breaking older projects.

### Negative

- We must maintain two import/export code paths (folder and ZIP).
- C3 Projects depend on the font file being present for faithful re-rendering of appended characters.
- The Project JSON schema becomes a public contract; field renames require version bumps and migrations.
- Toolbar UI needs a new "Project" menu to avoid overcrowding the existing button row.

## Related Documents

- `CONTEXT.md` — domain glossary, including the "Project" definition
- `docs/adr/0001-c3-sprite-font-mode.md` — C3 mode decisions that affect Project export semantics
