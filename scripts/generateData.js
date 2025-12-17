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
  const syllabusData = {}; // { semKey: { subjectName: { unitKey: { num, category, materials: [] } } } }

  files.forEach(full => {
    const rel = path.relative(root, full).replace(/\\/g, '/'); // pdfs/Sem4/Physics/Unit_1/Notes.pdf
    const parts = rel.split('/');

    // Expected structure: pdfs / SemX / Subject / [Category?] / UnitY / File.pdf

    let semKey = 'sem_unknown';
    let subject = 'Unknown';
    let unitNum = null;
    let category = null;

    // Find Sem part
    const semIndex = parts.findIndex(p => /^sem/i.test(p));
    if (semIndex !== -1) {
      semKey = normalizeSem(parts[semIndex]);
      // Subject is typically next
      if (parts[semIndex + 1]) subject = parts[semIndex + 1].replace(/_/g, ' ');
    }

    // Find Unit part
    const unitIndex = parts.findIndex(p => /^(?:Unit|U)[\s._-]*?\d+/i.test(p));
    if (unitIndex !== -1) {
      unitNum = normalizeUnit(parts[unitIndex]);

      // Check for Category (between Subject and Unit)
      // Subject is at semIndex + 1. Unit is at unitIndex.
      // If unitIndex > semIndex + 2, there is something in between.
      if (unitIndex > semIndex + 2) {
        // Join intermediate parts as category
        category = parts.slice(semIndex + 2, unitIndex).join(' ').replace(/_/g, ' ');
      }
    } else {
      // No Unit folder found, treat as General/Syllabus (Unit 0)
      // Must ensure we are inside a subject.
      if (semIndex !== -1 && parts[semIndex + 1]) {
        unitNum = 0;
        // Check for Category (between Subject and Filename)
        // Subject is at semIndex + 1. File is at parts.length - 1.
        const fileIndex = parts.length - 1;
        if (fileIndex > semIndex + 2) {
          category = parts.slice(semIndex + 2, fileIndex).join(' ').replace(/_/g, ' ');
        }
      }
    }

    if (unitNum === null) return;

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

    // Create a unique key for the unit combining Category + UnitNum to distinguish matching unit numbers in different categories
    const unitKey = category ? `${category}:::${unitNum}` : `${unitNum}`;

    if (!syllabusData[semKey][subject][unitKey]) {
      syllabusData[semKey][subject][unitKey] = {
        num: unitNum,
        category: category,
        materials: []
      };
    }

    syllabusData[semKey][subject][unitKey].materials.push(entry);
  });

  // Write output
  Object.keys(syllabusData).forEach(semKey => {
    const subjectsObj = syllabusData[semKey];
    // Convert to array format matches SYLLABUS.md
    // [ { subject: "Physics", units: [ { unit: 1, title: "Unit 1", materials: [] } ] } ]

    const outputList = Object.keys(subjectsObj).map(subjName => {
      const unitsMap = subjectsObj[subjName];
      const unitsList = Object.keys(unitsMap).map(uKey => {
        const uData = unitsMap[uKey];
        const materials = uData.materials;

        materials.sort((a, b) => a.title.localeCompare(b.title));

        // Use the title of the first PDF as the Unit Title if available
        // Prefix with Category if present
        let baseTitle = materials.length > 0 ? materials[0].title : `Unit ${uData.num}`;
        if (uData.num === 0) baseTitle = "Syllabus";

        // If we have a category, prepending it might be good: "Major 1 - Mechanics..."
        // Or just relying on the user to name PDF "Major 1 - Mechanics"?
        // Let's prepend it for clarity if it's not already in the title maybe?
        // Simpler: Just prepend it. "Major 1: Mechanics..."

        let displayTitle = baseTitle;
        // Clean check: if baseTitle already starts with category, don't repeat
        if (uData.category && !baseTitle.toLowerCase().startsWith(uData.category.toLowerCase())) {
          displayTitle = `${uData.category}: ${baseTitle}`;
        }

        return {
          unit: uData.num,
          // We might want to pass the raw category separately if UI wants to group them, 
          // but for now let's flatten it into the title structure or a new field.
          // SYLLABUS.md doesn't specify 'category' field, but extra fields are usually fine.
          category: uData.category,
          title: displayTitle,
          materials: materials
        };
      });

      // Sort logic: first by Category, then by Unit Number
      unitsList.sort((a, b) => {
        if (a.category && b.category) {
          const catComp = a.category.localeCompare(b.category);
          if (catComp !== 0) return catComp;
        }
        if (a.category && !b.category) return 1; // Uncategorized first? or last? Let's put major ones last.
        if (!a.category && b.category) return -1;

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
  // --- EXISTING EXAM PAPER MODE ---
  const grouped = {};

  files.forEach(full => {
    const rel = path.relative(root, full).replace(/\\/g, '/'); // pdfs/Sem2/Physics/...
    const parts = rel.split('/');
    const semSeg = parts.find(p => /^sem/i.test(p)) || parts[1] || 'sem_unknown';
    const semKey = normalizeSem(semSeg);
    const semIndex = parts.indexOf(semSeg);
    const subject = parts[semIndex + 1] || 'Unknown';
    const filename = path.basename(full);
    const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : null;
    const titleGuess = cleanTitle(filename);
    const side = readSidecar(full); // optional overrides: { title, description, year, subject }

    const entry = {
      subject: (side && side.subject) || subject.replace(/_/g, ' '),
      title: (side && side.title) || titleGuess || filename,
      year: (side && side.year) || year,
      file: rel.replace(/^\/+/, ''), // keep relative path with no leading slash
      description: (side && side.description) || ''
    };

    grouped[semKey] = grouped[semKey] || [];
    grouped[semKey].push(entry);
  });

  // Merge with existing and write
  Object.entries(grouped).forEach(([semKey, entries]) => {
    const outPath = path.join(dataDir, `${semKey}.json`);
    let existing = [];
    if (fs.existsSync(outPath)) {
      try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch (e) { existing = []; }
    }
    const existingMap = new Map((existing || []).map(e => [String(e.file), e]));
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