/**
 * generate-index.js
 *
 * Scans the data/ folder (syllabus_sem_*.json, sem_*.json) and the pdfs/
 * folder, then writes:
 *   - data/index.json   -> a single flat, machine-readable index of every
 *                          subject/unit/material + every PDF in the repo
 *   - sitemap.xml        -> a standard sitemap listing every page + JSON +
 *                          PDF url, so crawlers/bots (and AI tools that
 *                          fetch URLs) can discover content without running
 *                          any JavaScript.
 *
 * This script has ZERO npm dependencies - only Node's built-in fs/path.
 * Run it any time with:  node scripts/generate-index.js
 *
 * It is safe to run repeatedly - it only reads data/ and pdfs/, and only
 * writes data/index.json + sitemap.xml. It never touches your source JSON,
 * so your existing "just drop a new JSON file in" workflow is unaffected.
 */

const fs = require("fs");
const path = require("path");

// ---- CONFIG -----------------------------------------------------------
// Change this if your GitHub Pages URL ever changes.
const SITE_BASE = "https://harshx091.github.io/Exam_Papers";
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const PDFS_DIR = path.join(REPO_ROOT, "pdfs");
// ------------------------------------------------------------------------

function listFilesRecursive(dir, extFilter) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, extFilter));
    } else if (!extFilter || entry.name.toLowerCase().endsWith(extFilter)) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelative(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

function toUrl(repoRelativePath) {
  // encodeURI keeps existing "/" separators but escapes spaces etc.
  return `${SITE_BASE}/${encodeURI(repoRelativePath)}`;
}

function safeReadJson(absPath) {
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`  ! Skipping ${toRepoRelative(absPath)} - invalid JSON (${err.message})`);
    return null;
  }
}

// Pull the semester number out of a filename like:
//   syllabus_sem_5.json -> "5"
//   sem_5.json          -> "5"
function extractSemFromFilename(filename) {
  const match = filename.match(/sem_?(\d+)/i);
  return match ? match[1] : null;
}

function isSyllabusFile(filename) {
  return filename.toLowerCase().startsWith("syllabus_");
}

function main() {
  console.log("Scanning data/ ...");
  const jsonFiles = listFilesRecursive(DATA_DIR, ".json").filter(
    (f) => path.basename(f) !== "index.json"
  );

  const dataFiles = [];
  const subjectsFlat = []; // flattened rows: sem, subject, unit, title, file, url ...
  const papersFlat = []; // flattened rows for plain past-paper json files

  for (const absPath of jsonFiles) {
    const relPath = toRepoRelative(absPath);
    const filename = path.basename(absPath);
    const sem = extractSemFromFilename(filename);
    const url = toUrl(relPath);

    dataFiles.push({ path: relPath, url, sem, type: isSyllabusFile(filename) ? "syllabus" : "papers" });

    const json = safeReadJson(absPath);
    if (!json || !Array.isArray(json)) continue;

    if (isSyllabusFile(filename)) {
      // Syllabus schema: [{ subject, units: [{ unit, title, courseType, materials: [{title, file, description}] }] }]
      for (const subj of json) {
        const subjectName = subj.subject || "Unknown";
        for (const unit of subj.units || []) {
          const materials = unit.materials || [];
          if (materials.length === 0) {
            subjectsFlat.push({
              sem,
              subject: subjectName,
              unit: unit.unit ?? null,
              unitTitle: unit.title || unit.category || null,
              courseType: unit.courseType || null,
              materialTitle: null,
              file: null,
              fileUrl: null,
              description: null,
            });
          }
          for (const m of materials) {
            const fileRel = (m.file || "").replace(/^\/+/, "");
            subjectsFlat.push({
              sem,
              subject: subjectName,
              unit: unit.unit ?? null,
              unitTitle: unit.title || unit.category || null,
              courseType: unit.courseType || null,
              materialTitle: m.title || null,
              file: fileRel || null,
              fileUrl: fileRel ? toUrl(fileRel) : null,
              description: m.description || null,
            });
          }
        }
      }
    } else {
      // Papers schema: [{ subject, year, title, file, description, courseType }]
      for (const p of json) {
        const fileRel = (p.file || "").replace(/^\/+/, "");
        papersFlat.push({
          sem,
          subject: p.subject || null,
          year: p.year ?? null,
          title: p.title || null,
          courseType: p.courseType || null,
          unitType: p.unitType ?? null,
          file: fileRel || null,
          fileUrl: fileRel ? toUrl(fileRel) : null,
          description: p.description || null,
        });
      }
    }
  }

  console.log(`  Found ${dataFiles.length} data file(s), ${subjectsFlat.length} syllabus row(s), ${papersFlat.length} paper row(s).`);

  console.log("Scanning pdfs/ ...");
  const pdfFiles = listFilesRecursive(PDFS_DIR).map((absPath) => {
    const relPath = toRepoRelative(absPath);
    return { path: relPath, url: toUrl(relPath) };
  });
  console.log(`  Found ${pdfFiles.length} PDF/asset file(s).`);

  const index = {
    generatedAt: new Date().toISOString(),
    siteBase: SITE_BASE,
    dataFiles,
    syllabus: subjectsFlat,
    papers: papersFlat,
    pdfs: pdfFiles,
  };

  const indexPath = path.join(DATA_DIR, "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log(`Wrote ${toRepoRelative(indexPath)}`);

  // ---- sitemap.xml ------------------------------------------------------
  const urls = new Set();
  urls.add(`${SITE_BASE}/index.html`);
  urls.add(`${SITE_BASE}/data/index.json`);

  const semNumbers = new Set(
    dataFiles.map((d) => d.sem).filter(Boolean)
  );
  for (const sem of semNumbers) {
    urls.add(`${SITE_BASE}/subjects.html?sem=${sem}`);
  }
  for (const row of subjectsFlat) {
    if (row.sem && row.subject) {
      urls.add(
        `${SITE_BASE}/pdfs.html?sem=${row.sem}&subject=${encodeURIComponent(row.subject.replace(/ /g, "_"))}&view=syllabus`
      );
    }
  }
  for (const row of papersFlat) {
    if (row.sem && row.subject) {
      urls.add(
        `${SITE_BASE}/pdfs.html?sem=${row.sem}&subject=${encodeURIComponent(row.subject.replace(/ /g, "_"))}&view=papers`
      );
    }
  }
  for (const d of dataFiles) urls.add(d.url);
  for (const p of pdfFiles) urls.add(p.url);

  const sitemapEntries = Array.from(urls)
    .sort()
    .map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`)
    .join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;

  const sitemapPath = path.join(REPO_ROOT, "sitemap.xml");
  fs.writeFileSync(sitemapPath, sitemapXml);
  console.log(`Wrote ${toRepoRelative(sitemapPath)} (${urls.size} urls)`);

  console.log("Done.");
}

main();
