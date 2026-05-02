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
    .replace(/_+/g, ' ') // Only remove underscores, keep hyphens
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
const globalSearchIndex = [];

function addToGlobalIndex(entry, type, semKey, subject) {
  globalSearchIndex.push({
    title: entry.title,
    subject: subject,
    type: type,
    semester: semKey.replace('sem_', 'Semester '),
    file: entry.file
  });
}

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
    if (parts[currentIndex] && (parts[currentIndex].toUpperCase() === 'SEC' || parts[currentIndex].toUpperCase() === 'IKS' || parts[currentIndex].toUpperCase() === 'VAC')) {
      unitType = parts[currentIndex].toUpperCase();
      currentIndex++;
    }

    // Auto-assign unitType if the subject itself is a general subject (e.g. pdfs/Sem_4/Sec/Botany/...)
    const genSubjs = ['SEC', 'IKS', 'VAC'];
    if (!unitType && genSubjs.includes(subject.toUpperCase())) {
      unitType = subject.toUpperCase();
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

    const baseTitle = (side && side.title) || titleGuess || filename;
    
    // Construct readable Title based on Major/Minor, SEC/IKS, and Unit for Global Search
    let searchDisplayTitle = courseType || "General";
    if (unitType) searchDisplayTitle += ` • ${unitType}`;
    
    if (unitName) {
      let cleanUnitName = unitName.replace(/_/g, ' ');
      if (courseType && cleanUnitName.toLowerCase().startsWith(courseType.toLowerCase())) {
         searchDisplayTitle = cleanUnitName;
         if (unitType) searchDisplayTitle += ` • ${unitType}`;
      } else {
         // Avoid double "Unit Unit 1", just in case
         let displayUnit = cleanUnitName.toLowerCase().startsWith('unit') ? cleanUnitName : `Unit ${cleanUnitName}`;
         searchDisplayTitle += ` • ${displayUnit}`;
      }
    }
    
    searchDisplayTitle += ` — ${baseTitle}`;

    const entry = {
      title: baseTitle,
      file: rel.replace(/^\/+/, ''), // relative path
      description: (side && side.description) || ''
    };
    
    // Add specifically styled title to global search index
    addToGlobalIndex({ ...entry, title: searchDisplayTitle }, category || 'Notes', semKey, subject);

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

        // Construct a clean, readable Title (e.g., "SEC • Botany Unit 1" or "Major Unit 1")
        let typeStr = uData.unitType || uData.courseType || "";
        if (uData.unitType && uData.courseType && ['SEC', 'IKS', 'VAC'].includes(uData.unitType.toUpperCase())) {
            typeStr = `${uData.courseType} • ${uData.unitType}`;
        }
        let displayTitle = "";

        if (uData.category.toLowerCase() === 'syllabus') {
            displayTitle = typeStr ? `${typeStr} Syllabus` : "Syllabus";
        } else if (uData.category.toLowerCase() === 'notes') {
            if (uData.unitName) {
                const cleanUnitName = uData.unitName.replace(/_/g, ' ');
                // For general subjects, always prepend the typeStr (Associated Subject • SEC)
                if (uData.unitType && ['SEC', 'IKS', 'VAC'].includes(uData.unitType.toUpperCase())) {
                    displayTitle = `${typeStr} — ${cleanUnitName}`;
                } else if (cleanUnitName.toLowerCase().includes("major") || cleanUnitName.toLowerCase().startsWith("unit")) {
                    // If it's a designated unit (Major 1/2) or already starts with "Unit", use it directly
                    // This prevents "Major Unit 1" and favors just "Unit 1" for regular units.
                    displayTitle = cleanUnitName;
                } else {
                    displayTitle = typeStr ? `${typeStr} ${cleanUnitName}` : cleanUnitName;
                }
            } else {
                displayTitle = typeStr ? `${typeStr} Notes` : "Notes";
            }
        } else {
            displayTitle = typeStr ? `${typeStr} ${uData.category}` : uData.category;
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

        // Prioritize Syllabus at the top within the same CourseType
        const aIsSyllabus = a.title.toLowerCase().includes('syllabus');
        const bIsSyllabus = b.title.toLowerCase().includes('syllabus');
        if (aIsSyllabus && !bIsSyllabus) return -1;
        if (bIsSyllabus && !aIsSyllabus) return 1;

        // Then naturally by our generated title
        return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
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

    if (parts[currentIndex] && (parts[currentIndex].toUpperCase() === 'SEC' || parts[currentIndex].toUpperCase() === 'IKS' || parts[currentIndex].toUpperCase() === 'VAC')) {
      unitType = parts[currentIndex].toUpperCase();
      currentIndex++;
    }

    // Auto-assign unitType if the subject itself is a general subject
    const genSubjs = ['SEC', 'IKS', 'VAC'];
    if (!unitType && genSubjs.includes(subject.toUpperCase())) {
      unitType = subject.toUpperCase();
    }

    if (parts[currentIndex]) {
      category = parts[currentIndex];
      currentIndex++;
    } else {
      return; // No category found
    }

    // PAPERS MODE: Only include if explicitly in "Papers" folder
    if (category.toLowerCase() !== 'papers') {
      return;
    }

    let examType = null;
    if (parts[currentIndex] && !parts[currentIndex].toLowerCase().endsWith('.pdf')) {
      examType = parts[currentIndex];
      // Normalize if possible, but keep original for now
    }

    const filename = path.basename(full);
    const yearMatch = filename.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : null;
    const titleGuess = cleanTitle(filename);
    const side = readSidecar(full);
    
    // Construct a clean, readable Title (e.g., "Major — Physics 201" or "Physics • SEC — ...")
    let typeStr = unitType || courseType || "";
    // If it's a general subject (SEC/IKS/VAC), prepend the core subject (courseType) if unitType is present
    if (unitType && courseType && ['SEC', 'IKS', 'VAC'].includes(unitType.toUpperCase())) {
      typeStr = `${courseType} • ${unitType}`;
    }
    const cleanFileName = titleGuess || filename;
    const displayTitle = typeStr ? `${typeStr} — ${cleanFileName}` : cleanFileName;

    let description = (side && side.description) || '';
    if (examType && !description.includes(examType)) {
      description = description ? `${examType} • ${description}` : examType;
    }

    const entry = {
      subject: (side && side.subject) || subject,
      title: (side && side.title) || displayTitle,
      courseType: courseType, // Store raw course type for robust filtering
      unitType: unitType,
      year: (side && side.year) || year,
      file: rel.replace(/^\/+/, ''),
      description: description
    };
    addToGlobalIndex(entry, 'Papers', semKey, subject);

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
        // Prioritize generated fields if they are more informative or required for UI logic
        return {
          ...e,
          // If the existing title doesn't start with the course type but the new one does, 
          // we favor the new one to fix visibility issues.
          title: (e.title.toLowerCase().startsWith(e.courseType.toLowerCase()) && !ex.title.toLowerCase().startsWith(e.courseType.toLowerCase())) 
                 ? e.title : (['SEC', 'IKS', 'VAC'].includes(e.unitType?.toUpperCase()) ? e.title : (ex.title || e.title)),
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
    addToGlobalIndex(entry, 'Papers', semKey, subject);

    grouped[semKey] = grouped[semKey] || [];
    grouped[semKey].push(entry);
}

// Run logic
try {
  generateSyllabus();
  generatePapers();
  
  const searchIndexPath = path.join(dataDir, 'search_index.json');
  fs.writeFileSync(searchIndexPath, JSON.stringify(globalSearchIndex, null, 0) + '\n', 'utf8');
  console.log(`Wrote ${searchIndexPath} with ${globalSearchIndex.length} items for global search.`);
  
  console.log('Done.');
} catch (err) {
  console.error('Error in generation script:', err);
  process.exit(1);
}