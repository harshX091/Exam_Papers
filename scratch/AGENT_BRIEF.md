# Task Brief: Make Exam_Papers site AI/crawler-readable without changing its functionality

## Context

This is a static GitHub Pages site (repo: `harshX091/Exam_Papers`, live at
`https://harshx091.github.io/Exam_Papers/`) that hosts BSc exam papers,
syllabus notes, and study material. The owner frequently adds new content by
just dropping new files into `data/*.json` and `pdfs/`, and wants that
"just add a file" workflow to stay exactly as-is.

**The problem:** Pages like `subjects.html` and `pdfs.html` render their
content entirely client-side via JavaScript `fetch()` calls against JSON
files in `data/` (e.g. `data/syllabus_sem_5.json`, `data/sem_5.json`). Any
tool that only reads raw HTML (search engine crawlers, AI assistants doing a
one-shot page fetch, etc.) sees an empty page shell with no content, because
the content only appears after JS runs in a real browser.

## Goal

Make the site's content (syllabus units, materials, past papers, PDFs)
**discoverable and readable by AI tools/crawlers in a single fetch**,
**without changing the existing site's look, behavior, or the owner's
content-adding workflow in any way.**

This is explicitly an **additive** change, not a rewrite:
- Do NOT modify the rendering behavior of `index.html`, `subjects.html`,
  `coursetype.html`, `pdfs.html`, `viewer.html`, or `upload.html`.
- Do NOT change the JSON schema of existing `data/syllabus_sem_*.json` or
  `data/sem_*.json` files, or how they're structured/named.
- Do NOT introduce a build step that the owner has to run manually before
  every content update — it must be fully automatic via CI.
- Do NOT add any npm dependencies unless truly unavoidable (prefer Node's
  built-in `fs`/`path` only).

## What to implement

1. **`scripts/generate-index.js`** (already drafted — see attached file,
   tested against a mock version of the real schema and confirmed working).
   It scans `data/*.json` and `pdfs/**`, and writes:
   - `data/index.json` — a single flat JSON file listing every data file,
     every syllabus unit + material (with absolute URLs), every past paper
     entry, and every PDF path, so an AI tool or crawler can read the whole
     site's content in one fetch.
   - `sitemap.xml` — standard sitemap listing every subject/paper page URL,
     every data JSON URL, and every PDF URL.

2. **`.github/workflows/build-index.yml`** (already drafted — see attached
   file). A GitHub Action that:
   - Triggers on push to `main` when `data/**`, `pdfs/**`, or the generator
     script changes (plus manual `workflow_dispatch`).
   - Runs `node scripts/generate-index.js`.
   - Commits `data/index.json` and `sitemap.xml` back to the repo
     automatically if they changed, using `contents: write` permission.

## Your job as the implementing agent

1. **Verify against the real repo**, not just the reference files:
   - Open a sample of the actual `data/syllabus_sem_*.json` and
     `data/sem_*.json` files in this repo and confirm the script's
     assumptions about their schema (`subject`, `units[].unit`,
     `units[].title`/`category`, `units[].courseType`,
     `units[].materials[].title/file/description` for syllabus files;
     `subject/year/title/file/description/courseType` for paper files)
     actually match. Adjust the script if any real file deviates —
     don't silently drop data that doesn't fit the assumed shape.
   - Confirm the actual folder names (`data/`, `pdfs/`) match what the
     script expects; adjust `DATA_DIR`/`PDFS_DIR` constants if not.

2. **Add the two files** (`scripts/generate-index.js`,
   `.github/workflows/build-index.yml`) to the repo, adapting only what's
   necessary per step 1.

3. **Run the script locally against the real data** and sanity-check
   `data/index.json` — confirm every current subject/semester shows up,
   URLs are correctly formed (`https://harshx091.github.io/Exam_Papers/...`),
   and nothing throws or silently skips real content.

4. **Verify the existing site still works unchanged** — `subjects.html`,
   `pdfs.html`, etc. should behave exactly as before, since this change
   only adds new files and never edits the existing ones.

5. **Commit and push**, confirm the GitHub Action runs green in the Actions
   tab, and confirm `data/index.json` and `sitemap.xml` land in the repo
   automatically.

## Acceptance criteria

- [ ] Existing site UX is 100% unchanged (visually and functionally).
- [ ] Owner's workflow of adding new `data/*.json` / PDF files is unchanged.
- [ ] `data/index.json` exists, is valid JSON, and contains every current
      subject/unit/material/paper/PDF with correct absolute URLs.
- [ ] `sitemap.xml` exists and lists every relevant page and asset URL.
- [ ] Pushing a new syllabus or paper JSON file automatically regenerates
      both files via the GitHub Action, with no manual step required.
- [ ] `https://harshx091.github.io/Exam_Papers/data/index.json` is fetchable
      directly and returns the full content index in one request.

## Reference files attached

- `scripts/generate-index.js` — tested, working generator script.
- `.github/workflows/build-index.yml` — GitHub Action to automate it.

Treat these as a strong starting draft, not gospel — validate step 1 above
against the real repo contents before finalizing.
