const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pdfRoot = path.join(root, 'pdfs');
const dataDir = path.join(root, 'data');

const isSyllabusMode = process.argv.includes('--syllabus');

if (!fs.existsSync(pdfRoot)) {
  console.error('pdfs folder not found:', pdfRoot);
  process.exit(1);
}
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function walk(dir) {
  const out = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...walk(full));
    else if (d.isFile() && /\.pdf$/i.test(d.name)) out.push(full);
  }
  return out;
}

function normalizeSem(seg) {
  if (!seg) return 'sem_unknown';
  const m = seg.match(/sem[\s._-]*?(\d+)/i);
  if (m) return `sem_${m[1]}`.toLowerCase();
  return `sem_${seg.replace(/\s+/g, '_').toLowerCase()}`;
}

function normalizeUnit(seg) {
  if (!seg) return null;
  const m = seg.match(/^(?:Unit|U)[\s._-]*?(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function cleanTitle(name) {
  return name
    .replace(/\.(pdf)$/i, '')
    .replace(/\b(19|20)\d{2}\b/, '')
    .replace(/[_\-]+/g, ' ')       // remove underscores and dashes
    .replace(/(?<!\d)\.+(?!\d)/g, ' ') // remove dots NOT between digits
    .replace(/\s+/g, ' ')
    .trim();
}

function readSidecar(pdfFull) {
  const j = pdfFull + '.json';
  if (!fs.existsSync(j)) return null;
  try { return JSON.parse(fs.readFileSync(j, 'utf8')); } catch { return null; }
}

const files = walk(pdfRoot);

if (isSyllabusMode) {
  // --- SYLLABUS MODE ---
  console.log('Running in Syllabus Mode...');
  const syllabusData = {}; // { semKey: { subjectName: { categoryKey: { category, unitNum, materials: [] } } } }

  files.forEach(full => {
    const rel = path.relative(root, full).replace(/\\/g, '/'); // pdfs/Sem2/Physics/Major_1/Unit_1/Notes.pdf
    const parts = rel.split('/');

    // Expected structure: pdfs / SemX / Subject / [Category] / ... / File.pdf
    // "Category" is the folder immediately inside Subject.

    const semIndex = parts.findIndex(p => /^sem/i.test(p));
    if (semIndex === -1 || !parts[semIndex + 1]) return; // valid sem and subject required

    const semKey = normalizeSem(parts[semIndex]);
    const subject = parts[semIndex + 1].replace(/_/g, ' ');

    const categoryFolder = parts[semIndex + 2];

    // 1. If inside "Papers" folder (normalized), IGNORE in Syllabus Mode.
    if (categoryFolder && categoryFolder.toLowerCase() === 'papers') return;

    // 2. Identify Unit and Category Display
    let unitNum = 0; // Default to 0 (General/Syllabus)
    let displayCategory = null;

    // Determine Category Name and Unit
    if (categoryFolder) {
      if (categoryFolder.toLowerCase().endsWith('.pdf')) {
        displayCategory = null; // File is at root, so no category
      } else {
        // Is the category folder itself a Unit folder?
        const catUnit = normalizeUnit(categoryFolder);
        if (catUnit !== null) {
          unitNum = catUnit;
          displayCategory = null; // It's just a Unit folder at root of subject
        } else {
          // It is a named category like "Major_1", "Syllabus", "SEC", "Yoga-IKS"
          displayCategory = categoryFolder.replace(/_/g, ' ');

          // Check if there is a sub-unit folder?
          // e.g. Sem2/Physics/Major_1/Unit_1/Notes.pdf
          const subFolder = parts[semIndex + 3];
          if (subFolder) {
            const subUnit = normalizeUnit(subFolder);
            if (subUnit !== null) {
              unitNum = subUnit;
            }
          }
        }
      }
    }

    const filename = path.basename(full);
    const titleGuess = cleanTitle(filename);
    const side = readSidecar(full);

    const entry = {
      title: (side && side.title) || titleGuess || filename,
      file: rel.replace(/^\/+/, ''), // relative path
      description: (side && side.description) || ''
    };

    if (!syllabusData[semKey]) syllabusData[semKey] = {};
    if (!syllabusData[semKey][subject]) syllabusData[semKey][subject] = {};

    const catStr = displayCategory || '';
    const unitKey = `${catStr}:::${unitNum}`;

    if (!syllabusData[semKey][subject][unitKey]) {
      syllabusData[semKey][subject][unitKey] = {
        unit: unitNum,
        category: displayCategory,
        materials: []
      };
    }

    syllabusData[semKey][subject][unitKey].materials.push(entry);
  });

  // Write output
  Object.keys(syllabusData).forEach(semKey => {
    const subjectsObj = syllabusData[semKey];

    const outputList = Object.keys(subjectsObj).map(subjName => {
      const unitsMap = subjectsObj[subjName];
      const unitsList = Object.keys(unitsMap).map(uKey => {
        const uData = unitsMap[uKey];
        const materials = uData.materials;
        materials.sort((a, b) => a.title.localeCompare(b.title));

        let displayTitle = "";
        if (uData.unit === 0) {
          displayTitle = uData.category ? uData.category : "Syllabus / Resources";
        } else {
          displayTitle = uData.category ? `${uData.category} : Unit ${uData.unit}` : `Unit ${uData.unit}`;
        }

        return {
          unit: uData.unit,
          category: uData.category,
          title: displayTitle,
          materials: materials
        };
      });

      // Sort logic
      unitsList.sort((a, b) => {
        // 1. Category sort
        if (a.category && b.category) {
          const c = a.category.localeCompare(b.category);
          if (c !== 0) return c;
        }
        if (a.category && !b.category) return 1;
        if (!a.category && b.category) return -1;
        // 2. Unit number sort
        return a.unit - b.unit;
      });

      return {
        subject: subjName,
        units: unitsList
      };
    });

    outputList.sort((a, b) => a.subject.localeCompare(b.subject));

    const outPath = path.join(dataDir, `syllabus_${semKey}.json`);
    fs.writeFileSync(outPath, JSON.stringify(outputList, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${outPath} with ${outputList.length} subjects`);
  });

} else {
  // --- EXAM PAPER MODE ---
  const grouped = {};

  files.forEach(full => {
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const parts = rel.split('/');

    const semIndex = parts.findIndex(p => /^sem/i.test(p));
    if (semIndex === -1 || !parts[semIndex + 1]) return;

    const semKey = normalizeSem(parts[semIndex]);
    const subject = parts[semIndex + 1].replace(/_/g, ' ');
    const categoryFolder = parts[semIndex + 2];

    // PAPERS MODE: Only include if explicitly in "Papers" folder
    if (!categoryFolder || categoryFolder.toLowerCase() !== 'papers') {
      return;
    }

    const filename = path.basename(full);
    const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : null;
    const titleGuess = cleanTitle(filename);
    const side = readSidecar(full);

    const entry = {
      subject: (side && side.subject) || subject,
      title: (side && side.title) || titleGuess || filename,
      year: (side && side.year) || year,
      file: rel.replace(/^\/+/, ''),
      description: (side && side.description) || ''
    };

    grouped[semKey] = grouped[semKey] || [];
    grouped[semKey].push(entry);
  });

  // Merge with existing and write
  const allSemKeys = new Set([...Object.keys(grouped)]);
  // Also scan for existing sem_X.json files to ensure we clear any that are now empty
  const exFiles = fs.readdirSync(dataDir).filter(f => /^sem_\d+\.json$/.test(f));
  exFiles.forEach(f => allSemKeys.add(f.replace('.json', '')));

  allSemKeys.forEach(semKey => {
    const entries = grouped[semKey] || [];
    const outPath = path.join(dataDir, `${semKey}.json`);
    let existing = [];
    if (fs.existsSync(outPath)) {
      try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) { existing = []; }
    }
    const existingMap = new Map((existing || []).map(e => [String(e.file), e]));

    // We only want to keep entries that were found in the current scan (strict mode)
    const merged = entries.map(e => {
      const ex = existingMap.get(e.file);
      if (ex) {
        return {
          ...e,
          title: ex.title || e.title,
          description: ex.description || e.description,
          year: ex.year || e.year,
          subject: ex.subject || e.subject
        };
      }
      return e;
    });

    merged.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    console.log('Wrote', outPath, merged.length, 'entries');
  });
}

console.log('Done.');