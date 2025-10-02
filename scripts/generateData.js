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

function cleanTitle(name) {
  return name
    .replace(/\.(pdf)$/i, '')
    .replace(/\b(19|20)\d{2}\b/, '')
    .replace(/[_\-\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readSidecar(pdfFull) {
  const j = pdfFull + '.json';
  if (!fs.existsSync(j)) return null;
  try { return JSON.parse(fs.readFileSync(j, 'utf8')); } catch { return null; }
}

const files = walk(pdfRoot);
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
    subject: (side && side.subject) || subject.replace(/_/g,' '),
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
    try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch(e){ existing = []; }
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

  merged.sort((a,b) => (b.year||0) - (a.year||0) || a.title.localeCompare(b.title));
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log('Wrote', outPath, merged.length, 'entries');
});

console.log('Done.');