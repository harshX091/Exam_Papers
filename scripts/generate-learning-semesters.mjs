import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const contentDir = path.join(rootDir, 'learning_src', 'content');
const subjectsFile = path.join(rootDir, 'scripts', 'subjects.js');

// 1. Load subjects from scripts/subjects.js
const subjectsCode = fs.readFileSync(subjectsFile, 'utf8');
const commonSubjectsMatch = subjectsCode.match(/const\s+COMMON_SUBJECTS\s*=\s*\[([\s\S]*?)\];/);

let COMMON_SUBJECTS = [
  "Physics", "Chemistry", "Mathematics", "Zoology",
  "Botany", "Computer_Science", "English_AEC",
  "SEC", "IKS", "VAC"
];

if (commonSubjectsMatch) {
  try {
    COMMON_SUBJECTS = eval(`[${commonSubjectsMatch[1]}]`);
  } catch (e) {
    console.warn("Failed to eval COMMON_SUBJECTS, using fallback", e);
  }
}

// Subject display meta (icons and subtitles)
const SUBJECT_META = {
  "Physics": { icon: "⚛️", desc: "Core Physics, Mechanics, Optics & Quantum" },
  "Chemistry": { icon: "🧪", desc: "Organic, Inorganic & Physical Chemistry" },
  "Mathematics": { icon: "📐", desc: "Calculus, Algebra, Analysis & Geometry" },
  "Zoology": { icon: "🦁", desc: "Animal Diversity, Physiology & Genetics" },
  "Botany": { icon: "🌿", desc: "Plant Biology, Physiology & Ecology" },
  "Computer_Science": { icon: "💻", desc: "Programming, Data Structures & DBMS" },
  "English_AEC": { icon: "📖", desc: "Ability Enhancement & Communication" },
  "SEC": { icon: "🛠️", desc: "Skill Enhancement Courses" },
  "IKS": { icon: "🏛️", desc: "Indian Knowledge Systems" },
  "VAC": { icon: "🌱", desc: "Value Added Courses" }
};

// 2. Scan all existing notes in learning_src/content
const noteFiles = fs.readdirSync(contentDir).filter(f => f.endsWith('.md') && !f.startsWith('Semester_') && f !== 'index.md');

const notes = [];
for (const file of noteFiles) {
  const filePath = path.join(contentDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---/);
  
  let title = file.replace(/\.md$/, '').replace(/_/g, ' ');
  let sem = null;
  let subject = null;

  if (fmMatch) {
    const fm = fmMatch[1];
    const titleMatch = fm.match(/^title:\s*["']?(.*?)["']?\s*$/m);
    if (titleMatch) title = titleMatch[1];

    const semMatch = fm.match(/^sem(?:ester)?:\s*["']?(\d+)["']?\s*$/m);
    if (semMatch) sem = parseInt(semMatch[1], 10);

    const subMatch = fm.match(/^subject:\s*["']?(.*?)["']?\s*$/m);
    if (subMatch) subject = subMatch[1];
  }

  // Fallback heuristics based on filename or content if not explicitly tagged
  const fileLower = file.toLowerCase();
  const textLower = text.toLowerCase();

  if (!sem) {
    const semInName = fileLower.match(/sem(?:ester)?_?(\d+)/);
    if (semInName) sem = parseInt(semInName[1], 10);
    else if (textLower.includes('semester 5') || textLower.includes('sem 5')) sem = 5;
    else if (textLower.includes('semester 1') || textLower.includes('sem 1')) sem = 1;
    else if (textLower.includes('semester 2') || textLower.includes('sem 2')) sem = 2;
    else if (textLower.includes('semester 3') || textLower.includes('sem 3')) sem = 3;
    else if (textLower.includes('semester 4') || textLower.includes('sem 4')) sem = 4;
    else if (textLower.includes('semester 6') || textLower.includes('sem 6')) sem = 6;
    else sem = 5; // default fallback for current batch
  }

  if (!subject) {
    if (fileLower.includes('physics') || fileLower.includes('michelson')) subject = 'Physics';
    else if (fileLower.includes('electronics') || fileLower.includes('transistor') || fileLower.includes('junction')) subject = 'Physics'; // or Electronics under Physics
    else if (fileLower.includes('sec')) subject = 'SEC';
    else if (fileLower.includes('chem')) subject = 'Chemistry';
    else if (fileLower.includes('math')) subject = 'Mathematics';
    else if (fileLower.includes('botany')) subject = 'Botany';
    else if (fileLower.includes('zoo')) subject = 'Zoology';
    else if (fileLower.includes('computer')) subject = 'Computer_Science';
    else subject = 'Physics';
  }

  notes.push({
    file: file.replace(/\.md$/, ''),
    title,
    sem,
    subject: subject.replace(/\s+/g, '_')
  });
}

// 3. Generate Semester_1.md through Semester_6.md
for (let semNum = 1; semNum <= 6; semNum++) {
  const semNotes = notes.filter(n => n.sem === semNum);

  let md = `---
title: "Semester ${semNum}"
---

Choose a subject to explore learning notes and concept breakdowns for Semester ${semNum}.

<div style="margin: 1rem 0 1.5rem;">
  <a href="https://harshx091.github.io/Exam_Papers/learning-editor.html" class="btn-add-note">＋ Add Note for Semester ${semNum}</a>
</div>

<div class="sem-grid">
`;

  for (const sub of COMMON_SUBJECTS) {
    const meta = SUBJECT_META[sub] || { icon: "📚", desc: sub.replace(/_/g, ' ') };
    const displayName = sub.replace(/_/g, ' ');
    const matchedNotes = semNotes.filter(n => n.subject.toLowerCase() === sub.toLowerCase());

    if (matchedNotes.length > 0) {
      md += `  <div class="sem-card">
    <div class="sem-card-title">${meta.icon} ${displayName}</div>
    <p class="sem-card-desc">${meta.desc}</p>
    <ul>
${matchedNotes.map(n => `      <li>[[${n.file}|${n.title}]]</li>`).join('\n')}
    </ul>
    <span class="sem-card-badge" style="background: rgba(16, 185, 129, 0.15); color: #059669;">${matchedNotes.length} Note${matchedNotes.length > 1 ? 's' : ''} Available</span>
  </div>\n\n`;
    } else {
      md += `  <div class="sem-card disabled">
    <div class="sem-card-title">${meta.icon} ${displayName}</div>
    <p class="sem-card-desc">${meta.desc}</p>
    <span class="sem-card-badge">No notes yet</span>
  </div>\n\n`;
    }
  }

  md += `</div>

---

[← Back to Learning Hub](index) • [Main Portal & Past Papers](https://harshx091.github.io/Exam_Papers/)
`;

  const targetFile = path.join(contentDir, `Semester_${semNum}.md`);
  fs.writeFileSync(targetFile, md, 'utf8');
  console.log(`Generated Semester_${semNum}.md from COMMON_SUBJECTS`);
}
