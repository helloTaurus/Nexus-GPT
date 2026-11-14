# Nexus Finance: complete style update

This package extends the earlier homepage redesign across the app. It contains replacement files for the existing nex-fi repository, not a standalone project.

## Apply the update

1. Download and unzip this package on your computer.
2. Open your local copy of the nex-fi repository.
3. Copy the contents of the `update` folder into the repository root. Merge folders and replace files when asked. Do not copy the outer `update` folder itself.
4. The root should contain `index.html`, `package-lock.json`, `vite.config.ts`, `src`, and `docs` alongside your existing project files. Preserve all existing assets, package.json, and GitHub workflows.
5. Run `npm ci`, then `npm run build` and `npx tsc --noEmit`.
6. Commit and push to main. The existing GitHub Pages workflow will build and deploy.

For GitHub's website uploader, select the CONTENTS of `update` at the repository root, retaining the `src/components` and `src/hooks` subfolders. Upload the whole set in one commit. Do not place root files inside `src`, and do not upload this README or the preview images as application source.

The old `src/nexus-first-pass.css` is now unused. You may delete it; leaving it there will not affect the new design. The previously uploaded patch file is not required by the app.

## Changes

- One sapphire, ink, porcelain and restrained emerald palette across all pages.
- Shared light/dark themes, text weights, type scale, borders, shadows and spacing.
- Consistent button, form, card and icon treatment.
- Product pages, About, careers, blog, gallery, contact, application dialogs and CMS styling.
- Simpler partner strip, readable footer branding in both themes, and reduced motion support.
- Form labels and keyboard focus/escape handling for application dialogs.

`docs/DESIGN-SYSTEM.md` explains how to keep future pages consistent.

## Verification and publication status

Production build, TypeScript checks and whitespace checks passed. Browser checks covered both themes, mobile and desktop widths, public page templates, calculator controls and application focus behaviour.

This update has NOT been published. GitHub's connected integration returned HTTP 403: Resource not accessible by integration. The source was checked against your current public repository at commit 4f9c68f8e27f57a909945cc0f1ba654afec4dcc5; its prior code changes match the earlier delivered homepage update.

Existing demonstration form delivery and CMS authentication behaviour are preserved. This is a visual consistency update, not a backend implementation.
