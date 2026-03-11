const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pdfRoot = path.join(root, 'pdfs');
const dataDir = path.join(root, 'data');

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

function generateSyllabus() {
  console.log('--- Generating Syllabus Data ---');
  const syllabusData = {}; // { semKey: { subjectName: { unitKey: { category, unitName, courseType, unitType, materials: [] } } } }

  files.forEach(full => {
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const parts = rel.split('/');

    const semIndex = parts.findIndex(p => /^sem/i.test(p));
    if (semIndex === -1 || !parts[semIndex + 1]) return;

    const semKey = normalizeSem(parts[semIndex]);
    const subject = parts[semIndex + 1].replace(/_/g, ' ');

    // Path structure: pdfs/{Semester}/{Subject}/{CourseType}/[{UnitType}]/{Category}/[{UnitName}]/filename.pdf
    const courseType = parts[semIndex + 2];
    if (!courseType || courseType.toLowerCase() === 'papers') return; // Skip papers mode

    let unitType = null;
    let category = null;
    let unitName = null;

    let currentIndex = semIndex + 3;

    // Check if next folder is SEC or IKS
    if (parts[currentIndex] && (parts[currentIndex].toUpperCase() === 'SEC' || parts[currentIndex].toUpperCase() === 'IKS')) {
      unitType = parts[currentIndex].toUpperCase();
      currentIndex++;
    }

    // Next folder must be Category (Syllabus, Notes, etc.)
    if (parts[currentIndex]) {
      category = parts[currentIndex];
      currentIndex++;

      // If there's another folder before the file, it's the UnitName
      if (parts[currentIndex] && !parts[currentIndex].toLowerCase().endsWith('.pdf')) {
        unitName = parts[currentIndex].replace(/_/g, ' ');
      }
    }

    // Ignore if not explicitly notes/syllabus or if logic fell apart
    if (!category || category.toLowerCase() === 'papers') return;

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

    // Create a unique key for grouping
    const catStr = category || '';
    const ctStr = courseType || '';
    const utStr = unitType || 'REGULAR';
    const unStr = unitName || 'GENERAL';
    const unitKey = `${ctStr}:::${utStr}:::${catStr}:::${unStr}`;

    if (!syllabusData[semKey][subject][unitKey]) {
      syllabusData[semKey][subject][unitKey] = {
        courseType: courseType,
        unitType: unitType,
        category: category,
        unitName: unitName,
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
        materials.sort((a, b) => {
          const aLower = a.title.toLowerCase();
          const bLower = b.title.toLowerCase();
          if (aLower === 'syllabus' && bLower !== 'syllabus') return -1;
          if (bLower === 'syllabus' && aLower !== 'syllabus') return 1;
          const aHas = aLower.includes('syllabus');
          const bHas = bLower.includes('syllabus');
          if (aHas && !bHas) return -1;
          if (bHas && !aHas) return 1;
          return a.title.localeCompare(b.title);
        });

        // Construct readable Title based on Major/Minor, SEC/IKS, and Unit Name
        let displayTitle = uData.courseType || "General";
        if (uData.unitType) displayTitle += ` • ${uData.unitType}`;

        if (uData.category.toLowerCase() === 'syllabus') {
           displayTitle += ` — Syllabus`;
        } else if (uData.category.toLowerCase() === 'notes') {
           if (uData.unitName) {
             let cleanUnitName = uData.unitName.replace(/_/g, ' ');
             // Prevent "Major — Unit: Major 1 - ..." repetition by collapsing
             if (uData.courseType && cleanUnitName.toLowerCase().startsWith(uData.courseType.toLowerCase())) {
                 displayTitle = cleanUnitName;
                 if (uData.unitType) displayTitle += ` (${uData.unitType})`;
             } else {
                 displayTitle += ` — Unit: ${cleanUnitName}`;
             }
           } else {
             displayTitle += ` — Notes`;
           }
        } else {
           displayTitle += ` — ${uData.category}`;
        }

        return {
          // Pass empty unit/category so the frontend falls back strictly on our generated title
          unit: 0, 
          category: '', 
          title: displayTitle,
          courseType: uData.courseType, // Add raw fields for custom sorting
          materials: materials
        };
      });

      // Sort logic for grouped units
      unitsList.sort((a, b) => {
        // Sort by CourseType first
        const cA = a.courseType || '';
        const cB = b.courseType || '';
        if (cA !== cB) return cA.localeCompare(cB);

        // Then naturally by our generated title (which includes SEC/IKS and Unit Name)
        return a.title.localeCompare(b.title);
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
}

function generatePapers() {
  console.log('--- Generating Exam Papers Data ---');
  const grouped = {};

  files.forEach(full => {
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const parts = rel.split('/');

    const semIndex = parts.findIndex(p => /^sem/i.test(p));
    if (semIndex === -1 || !parts[semIndex + 1]) return;

    const semKey = normalizeSem(parts[semIndex]);
    const subject = parts[semIndex + 1].replace(/_/g, ' ');

    // Path structure: pdfs/{Semester}/{Subject}/{CourseType}/[{UnitType}]/{Category}/[{UnitName}]/filename.pdf
    const courseType = parts[semIndex + 2];
    if (!courseType) return;
    
    // Fall back to old papers processing temporarily if they uploaded to root "Papers" somehow
    if (courseType.toLowerCase() === 'papers') {
        processLegacyPaper(full, rel, semKey, subject, grouped);
        return;
    }

    let unitType = null;
    let category = null;

    let currentIndex = semIndex + 3;

    if (parts[currentIndex] && (parts[currentIndex].toUpperCase() === 'SEC' || parts[currentIndex].toUpperCase() === 'IKS')) {
      unitType = parts[currentIndex].toUpperCase();
      currentIndex++;
    }

    if (parts[currentIndex]) {
      category = parts[currentIndex];
    } else {
      return; // No category found
    }

    // PAPERS MODE: Only include if explicitly in "Papers" folder
    if (category.toLowerCase() !== 'papers') {
      return;
    }

    const filename = path.basename(full);
    const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : null;
    const titleGuess = cleanTitle(filename);
    const side = readSidecar(full);
    
    // Construct readable Title based on Major/Minor, SEC/IKS
    let displayTitle = courseType || "General";
    if (unitType) displayTitle += ` • ${unitType}`;
    displayTitle += ` — ${titleGuess || filename}`;

    const entry = {
      subject: (side && side.subject) || subject,
      title: (side && side.title) || displayTitle,
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

function processLegacyPaper(full, rel, semKey, subject, grouped) {
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
}

// Run logic
try {
  generateSyllabus();
  generatePapers();
  console.log('Done.');
} catch (err) {
  console.error('Error in generation script:', err);
  process.exit(1);
}