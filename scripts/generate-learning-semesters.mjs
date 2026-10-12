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
const generalSubjectsMatch = subjectsCode.match(/const\s+GENERAL_SUBJECTS\s*=\s*\[([\s\S]*?)\];/);

let COMMON_SUBJECTS = [
  "Physics", "Chemistry", "Mathematics", "Zoology",
  "Botany", "Computer_Science", "English_AEC",
  "SEC", "IKS", "VAC"
];

let GENERAL_SUBJECTS = [
  "English_AEC", "SEC", "IKS", "VAC"
];

if (commonSubjectsMatch) {
  try { COMMON_SUBJECTS = eval(`[${commonSubjectsMatch[1]}]`); } catch (e) {}
}
if (generalSubjectsMatch) {
  try { GENERAL_SUBJECTS = eval(`[${generalSubjectsMatch[1]}]`); } catch (e) {}
}

const COURSE_TYPES = ["Major", "Minor", "Multi"];

// Subject display metadata
const SUBJECT_META = {
  "Physics": { icon: "⚛️", desc: "Core Physics, Optics & Electronics" },
  "Chemistry": { icon: "🧪", desc: "Chemical Sciences & Analysis" },
  "Mathematics": { icon: "📐", desc: "Pure & Applied Mathematics" },
  "Zoology": { icon: "🦁", desc: "Animal Biology & Physiology" },
  "Botany": { icon: "🌿", desc: "Plant Biology & Ecology" },
  "Computer_Science": { icon: "💻", desc: "Programming, DSA & Systems" },
  "English_AEC": { icon: "📖", desc: "Ability Enhancement Course (AEC)" },
  "SEC": { icon: "🛠️", desc: "Skill Enhancement Course (SEC)" },
  "IKS": { icon: "🏛️", desc: "Indian Knowledge Systems" },
  "VAC": { icon: "🌱", desc: "Value Added Course (VAC)" }
};

const CT_META = {
  "Major": { icon: "📌", desc: "Core major specialization modules, theory & derivations" },
  "Minor": { icon: "🔬", desc: "Minor discipline concepts, fundamentals & applications" },
  "Multi": { icon: "🌐", desc: "Multidisciplinary course units & integrated topics" }
};

// 2. Scan all note files in learning_src/content (excluding auto-generated Semester_*.md and index.md)
const allFiles = fs.readdirSync(contentDir);
const noteFiles = allFiles.filter(f => f.endsWith('.md') && !f.startsWith('Semester_') && f !== 'index.md');

const notes = [];
for (const file of noteFiles) {
  const filePath = path.join(contentDir, file);
  const text = fs.readFileSync(filePath, 'utf8');
  const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---/);
  
  let title = file.replace(/\.md$/, '').replace(/_/g, ' ');
  let sem = null;
  let subject = null;
  let courseType = null;
  let unit = null;

  if (fmMatch) {
    const fm = fmMatch[1];
    const titleMatch = fm.match(/^title:\s*["']?(.*?)["']?\s*$/m);
    if (titleMatch) title = titleMatch[1];

    const semMatch = fm.match(/^sem(?:ester)?:\s*["']?(\d+)["']?\s*$/m);
    if (semMatch) sem = parseInt(semMatch[1], 10);

    const subMatch = fm.match(/^subject:\s*["']?(.*?)["']?\s*$/m);
    if (subMatch) subject = subMatch[1];

    const ctMatch = fm.match(/^(?:coursetype|course_type|type):\s*["']?(.*?)["']?\s*$/m);
    if (ctMatch) courseType = ctMatch[1];

    const unitMatch = fm.match(/^unit:\s*["']?(\d+)["']?\s*$/m);
    if (unitMatch) unit = parseInt(unitMatch[1], 10);
  }

  // Fallback heuristics based on filename or text content
  const fileLower = file.toLowerCase();
  const textLower = text.toLowerCase();

  if (!sem) {
    const semInName = fileLower.match(/sem(?:ester)?_?(\d+)/);
    if (semInName) sem = parseInt(semInName[1], 10);
    else if (textLower.includes('semester 5') || textLower.includes('sem 5')) sem = 5;
    else if (textLower.includes('semester 2') || textLower.includes('sem 2')) sem = 2;
    else if (textLower.includes('semester 1') || textLower.includes('sem 1')) sem = 1;
    else if (textLower.includes('semester 3') || textLower.includes('sem 3')) sem = 3;
    else if (textLower.includes('semester 4') || textLower.includes('sem 4')) sem = 4;
    else if (textLower.includes('semester 6') || textLower.includes('sem 6')) sem = 6;
    else sem = 5;
  }

  if (!subject) {
    if (fileLower.includes('physics') || fileLower.includes('michelson')) subject = 'Physics';
    else if (fileLower.includes('electronics') || fileLower.includes('transistor') || fileLower.includes('junction')) subject = 'Physics';
    else if (fileLower.includes('sec')) subject = 'SEC';
    else if (fileLower.includes('chem')) subject = 'Chemistry';
    else if (fileLower.includes('math')) subject = 'Mathematics';
    else if (fileLower.includes('botany')) subject = 'Botany';
    else if (fileLower.includes('zoo')) subject = 'Zoology';
    else if (fileLower.includes('computer')) subject = 'Computer_Science';
    else subject = 'Physics';
  }

  if (!courseType && !GENERAL_SUBJECTS.includes(subject)) {
    if (fileLower.includes('major')) courseType = 'Major';
    else if (fileLower.includes('minor') || fileLower.includes('electronics') || fileLower.includes('transistor') || fileLower.includes('junction')) courseType = 'Minor';
    else if (fileLower.includes('multi')) courseType = 'Multi';
    else if (fileLower.includes('michelson')) courseType = 'Major';
    else courseType = 'Major';
  }

  if (!unit) {
    const unitMatch = fileLower.match(/unit_?(\d+)/) || textLower.match(/unit\s*(\d+)/);
    if (unitMatch) unit = parseInt(unitMatch[1], 10);
    else unit = 1; // default to Unit 1
  }

  notes.push({
    file: file.replace(/\.md$/, ''),
    title,
    sem,
    subject: subject.replace(/\s+/g, '_'),
    courseType: courseType ? courseType.trim() : null,
    unit
  });
}

console.log(`Indexed ${notes.length} notes across semesters.`);

// Helper function to build Unit Cards section
function renderUnitsSection(matchedNotes, addNoteUrl) {
  let md = '';
  const maxUnitInNotes = matchedNotes.reduce((max, n) => Math.max(max, n.unit || 0), 0);
  const totalUnits = Math.max(4, maxUnitInNotes);

  for (let u = 1; u <= totalUnits; u++) {
    const uNotes = matchedNotes.filter(n => n.unit === u);
    md += `<div class="unit-card">\n`;
    md += `  <div class="unit-title">🔹 Unit ${u}</div>\n`;
    if (uNotes.length > 0) {
      md += `  <ul>\n`;
      uNotes.forEach(n => {
        md += `    <li><a href="${n.file}">${n.title}</a></li>\n`;
      });
      md += `  </ul>\n`;
    } else {
      md += `  <p class="unit-empty">No notes uploaded yet for Unit ${u}. Be the first to contribute!</p>\n`;
    }
    md += `</div>\n\n`;
  }

  const noUnitNotes = matchedNotes.filter(n => !n.unit);
  if (noUnitNotes.length > 0) {
    md += `<div class="unit-card">\n`;
    md += `  <div class="unit-title">🔹 Additional Topics & Foundation Notes</div>\n`;
    md += `  <ul>\n`;
    noUnitNotes.forEach(n => {
      md += `    <li><a href="${n.file}">${n.title}</a></li>\n`;
    });
    md += `  </ul>\n`;
    md += `</div>\n\n`;
  }

  return md;
}

let generatedCount = 0;

// 3. Generate Level 1: Semester_1.md to Semester_6.md
for (let sem = 1; sem <= 6; sem++) {
  const semNotes = notes.filter(n => n.sem === sem);

  let md = `---
title: "Semester ${sem}"
---

<a href="index" class="back-nav">⬅ Back to Learning Hub Home</a>

<div style="margin: 0.5rem 0 1.5rem;">
  <a href="https://harshx091.github.io/Exam_Papers/learning-editor.html?sem=${sem}" class="btn-add-note">＋ Add Note for Semester ${sem}</a>
</div>

Choose a subject to explore learning notes and concept breakdowns for Semester ${sem}:

<div class="sem-grid">
`;

  for (const sub of COMMON_SUBJECTS) {
    const meta = SUBJECT_META[sub] || { icon: "📚", desc: sub.replace(/_/g, ' ') };
    const displayName = sub.replace(/_/g, ' ');
    const isGeneral = GENERAL_SUBJECTS.includes(sub);
    const subNotes = semNotes.filter(n => n.subject.toLowerCase() === sub.toLowerCase());
    const count = subNotes.length;

    md += `  <a href="Semester_${sem}_${sub}" class="sem-card">
    <div class="sem-card-title">${meta.icon} ${displayName}</div>
    <p class="sem-card-desc">${isGeneral ? 'Direct unit modules & study notes' : 'Select course type (Major, Minor, Multi)'}</p>
    <span class="sem-card-badge"${count > 0 ? ' style="background: rgba(16, 185, 129, 0.15); color: #059669;"' : ''}>${count > 0 ? `${count} Note${count > 1 ? 's' : ''} Available` : 'Explore'}</span>
  </a>
`;
  }

  md += `</div>

---

[← Back to Learning Hub](index) • [Main Portal & Past Papers](https://harshx091.github.io/Exam_Papers/)
`;

  fs.writeFileSync(path.join(contentDir, `Semester_${sem}.md`), md, 'utf8');
  generatedCount++;

  // 4. Generate Level 2 & 3 for each subject in this semester
  for (const sub of COMMON_SUBJECTS) {
    const meta = SUBJECT_META[sub] || { icon: "📚", desc: sub.replace(/_/g, ' ') };
    const displayName = sub.replace(/_/g, ' ');
    const isGeneral = GENERAL_SUBJECTS.includes(sub);
    const subNotes = semNotes.filter(n => n.subject.toLowerCase() === sub.toLowerCase());

    if (!isGeneral) {
      // 4A. CORE SUBJECT PAGE: Semester_X_[Subject].md (displays Major, Minor, Multi cards)
      let coreSubMd = `---
title: "${displayName} (Semester ${sem})"
---

<a href="Semester_${sem}" class="back-nav">⬅ Back to Semester ${sem} Subjects</a>

<div style="margin: 0.5rem 0 1.5rem;">
  <a href="https://harshx091.github.io/Exam_Papers/learning-editor.html?sem=${sem}&subject=${sub}" class="btn-add-note">＋ Add Note for ${displayName}</a>
</div>

Choose a course type for **${displayName}** in Semester ${sem} to explore unit-wise study notes:

<div class="sem-grid">
`;

      for (const ct of COURSE_TYPES) {
        const ctMeta = CT_META[ct] || { icon: "📌", desc: `${ct} modules and concepts` };
        const ctNotes = subNotes.filter(n => (n.courseType || '').toLowerCase() === ct.toLowerCase());
        const count = ctNotes.length;

        coreSubMd += `  <a href="Semester_${sem}_${sub}_${ct}" class="sem-card">
    <div class="sem-card-title">${ctMeta.icon} ${ct}</div>
    <p class="sem-card-desc">${ctMeta.desc}</p>
    <span class="sem-card-badge"${count > 0 ? ' style="background: rgba(16, 185, 129, 0.15); color: #059669;"' : ''}>${count > 0 ? `${count} Note${count > 1 ? 's' : ''} Available` : 'Explore Units'}</span>
  </a>
`;
      }

      coreSubMd += `</div>

---

[← Back to Semester ${sem} Subjects](Semester_${sem}) • [Learning Hub Home](index)
`;

      fs.writeFileSync(path.join(contentDir, `Semester_${sem}_${sub}.md`), coreSubMd, 'utf8');
      generatedCount++;

      // 4B. CORE COURSE TYPE PAGE: Semester_X_[Subject]_[CourseType].md (displays Units directly)
      for (const ct of COURSE_TYPES) {
        const ctNotes = subNotes.filter(n => (n.courseType || '').toLowerCase() === ct.toLowerCase());
        const addUrl = `https://harshx091.github.io/Exam_Papers/learning-editor.html?sem=${sem}&subject=${sub}&coursetype=${ct}`;

        let ctPageMd = `---
title: "${displayName} — ${ct} (Semester ${sem})"
---

<a href="Semester_${sem}_${sub}" class="back-nav">⬅ Back to ${displayName} Course Types</a>

<div style="margin: 0.5rem 0 1.5rem;">
  <a href="${addUrl}" class="btn-add-note">＋ Add Note for ${displayName} ${ct}</a>
</div>

Unit-wise concept notes, formula breakdowns, and interactive study material for **${displayName} (${ct})**:

${renderUnitsSection(ctNotes, addUrl)}
---

[← Back to ${displayName} Course Types](Semester_${sem}_${sub}) • [Semester ${sem} Subjects](Semester_${sem}) • [Learning Hub Home](index)
`;

        fs.writeFileSync(path.join(contentDir, `Semester_${sem}_${sub}_${ct}.md`), ctPageMd, 'utf8');
        generatedCount++;
      }

    } else {
      // 4C. GENERAL SUBJECT PAGE: Semester_X_[Subject].md (displays Units directly, skipping course type)
      const addUrl = `https://harshx091.github.io/Exam_Papers/learning-editor.html?sem=${sem}&subject=${sub}`;

      let genSubMd = `---
title: "${displayName} (Semester ${sem})"
---

<a href="Semester_${sem}" class="back-nav">⬅ Back to Semester ${sem} Subjects</a>

<div style="margin: 0.5rem 0 1.5rem;">
  <a href="${addUrl}" class="btn-add-note">＋ Add Note for ${displayName}</a>
</div>

Unit-wise study material and practical guides for **${displayName}** (Semester ${sem}):

${renderUnitsSection(subNotes, addUrl)}
---

[← Back to Semester ${sem} Subjects](Semester_${sem}) • [Learning Hub Home](index)
`;

      fs.writeFileSync(path.join(contentDir, `Semester_${sem}_${sub}.md`), genSubMd, 'utf8');
      generatedCount++;
    }
  }
}

console.log(`Successfully generated ${generatedCount} pages for tap-through navigation!`);
