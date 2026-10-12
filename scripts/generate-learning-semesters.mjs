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

// Subject display meta
const SUBJECT_META = {
  "Physics": { icon: "⚛️", desc: "Core Physics & Optics" },
  "Chemistry": { icon: "🧪", desc: "Chemical Sciences" },
  "Mathematics": { icon: "📐", desc: "Pure & Applied Mathematics" },
  "Zoology": { icon: "🦁", desc: "Animal Biology & Physiology" },
  "Botany": { icon: "🌿", desc: "Plant Biology & Ecology" },
  "Computer_Science": { icon: "💻", desc: "Programming & Systems" },
  "English_AEC": { icon: "📖", desc: "Ability Enhancement (AEC)" },
  "SEC": { icon: "🛠️", desc: "Skill Enhancement Course" },
  "IKS": { icon: "🏛️", desc: "Indian Knowledge Systems" },
  "VAC": { icon: "🌱", desc: "Value Added Course" }
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
    else if (textLower.includes('semester 1') || textLower.includes('sem 1')) sem = 1;
    else if (textLower.includes('semester 2') || textLower.includes('sem 2')) sem = 2;
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
    else courseType = 'Major'; // default to Major
  }

  if (!unit) {
    const unitMatch = fileLower.match(/unit_?(\d+)/) || textLower.match(/unit\s*(\d+)/);
    if (unitMatch) unit = parseInt(unitMatch[1], 10);
  }

  notes.push({
    file: file.replace(/\.md$/, ''),
    title,
    sem,
    subject: subject.replace(/\s+/g, '_'),
    courseType,
    unit
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
    const isGeneral = GENERAL_SUBJECTS.includes(sub);
    const subNotes = semNotes.filter(n => n.subject.toLowerCase() === sub.toLowerCase());

    md += `  <div class="sem-card${subNotes.length === 0 ? ' disabled' : ''}">
    <div class="sem-card-title">${meta.icon} ${displayName}</div>
    <p class="sem-card-desc">${meta.desc}</p>
`;

    if (!isGeneral) {
      // Subjects WITH Major, Minor, Multi course types
      for (const ct of COURSE_TYPES) {
        const ctNotes = subNotes.filter(n => (n.courseType || '').toLowerCase() === ct.toLowerCase());
        md += `    <div class="course-type-section">
      <div class="course-type-header">📌 ${ct}</div>
`;
        if (ctNotes.length > 0) {
          // Group notes by Unit if unit exists
          const withUnit = ctNotes.filter(n => n.unit);
          const withoutUnit = ctNotes.filter(n => !n.unit);

          if (withUnit.length > 0) {
            // Group by unit number
            const unitsMap = {};
            withUnit.forEach(n => {
              unitsMap[n.unit] = unitsMap[n.unit] || [];
              unitsMap[n.unit].push(n);
            });
            for (const u of Object.keys(unitsMap).sort()) {
              md += `      <div class="unit-header">🔹 Unit ${u}</div>\n      <ul>\n`;
              unitsMap[u].forEach(n => {
                md += `        <li>[[${n.file}|${n.title}]]</li>\n`;
              });
              md += `      </ul>\n`;
            }
          }

          if (withoutUnit.length > 0) {
            md += `      <ul>\n`;
            withoutUnit.forEach(n => {
              md += `        <li>[[${n.file}|${n.title}]]</li>\n`;
            });
            md += `      </ul>\n`;
          }
        } else {
          md += `      <p style="margin:0.2rem 0 0.4rem;font-size:0.8rem;color:var(--darkgray);opacity:0.8;">No notes yet</p>\n`;
        }
        md += `    </div>\n`;
      }
    } else {
      // General subjects WITHOUT Major/Minor/Multi -> Direct Unit breakdown
      const unitsMap = {};
      const withoutUnit = [];

      subNotes.forEach(n => {
        if (n.unit) {
          unitsMap[n.unit] = unitsMap[n.unit] || [];
          unitsMap[n.unit].push(n);
        } else {
          withoutUnit.push(n);
        }
      });

      const unitKeys = Object.keys(unitsMap).sort();
      if (unitKeys.length > 0 || withoutUnit.length > 0) {
        for (const u of unitKeys) {
          md += `    <div class="unit-section">
      <div class="unit-header">🔹 Unit ${u}</div>
      <ul>
${unitsMap[u].map(n => `        <li>[[${n.file}|${n.title}]]</li>`).join('\n')}
      </ul>
    </div>\n`;
        }
        if (withoutUnit.length > 0) {
          md += `    <div class="unit-section">
      <ul>
${withoutUnit.map(n => `        <li>[[${n.file}|${n.title}]]</li>`).join('\n')}
      </ul>
    </div>\n`;
        }
      } else {
        md += `    <div class="unit-section">
      <p style="margin:0.2rem 0;font-size:0.82rem;color:var(--darkgray);opacity:0.8;">Direct Unit Structure (No notes yet)</p>
    </div>\n`;
      }
    }

    if (subNotes.length > 0) {
      md += `    <span class="sem-card-badge" style="background: rgba(16, 185, 129, 0.15); color: #059669;">${subNotes.length} Note${subNotes.length > 1 ? 's' : ''} Available</span>\n`;
    } else {
      md += `    <span class="sem-card-badge">No notes yet</span>\n`;
    }

    md += `  </div>\n\n`;
  }

  md += `</div>

---

[← Back to Learning Hub](index) • [Main Portal & Past Papers](https://harshx091.github.io/Exam_Papers/)
`;

  const targetFile = path.join(contentDir, `Semester_${semNum}.md`);
  fs.writeFileSync(targetFile, md, 'utf8');
}

console.log("Successfully generated Semester 1-6 with Major/Minor/Multi and Units structure!");
