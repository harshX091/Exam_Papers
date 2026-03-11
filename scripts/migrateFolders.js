const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pdfRoot = path.join(__dirname, '..', 'pdfs');

// Copy dir recursively
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    // Copy all files and folders
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function secureRename(oldPath, newPath) {
    if (oldPath === newPath) return;
    
    // Create new parent directory string if needed
    const parent = path.dirname(newPath);
    if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
    }
    
    console.log(`Moving: ${path.relative(pdfRoot, oldPath)} -> ${path.relative(pdfRoot, newPath)}`);
    try {
        // Fall back to robust copy + delete due to Windows locking EPERM on open directory handles
        const stats = fs.statSync(oldPath);
        if (stats.isDirectory()) {
            copyDir(oldPath, newPath);
            fs.rmSync(oldPath, { recursive: true, force: true });
        } else {
            fs.copyFileSync(oldPath, newPath);
            fs.unlinkSync(oldPath);
        }
        
        // Ensure git tracks delete + add
        try { execSync(`git add "${newPath}"`, { stdio: 'ignore' }); } catch(e){}
        try { execSync(`git rm -r "${oldPath}"`, { stdio: 'ignore' }); } catch(e){}
    } catch (e) {
        console.log(`Error moving ${oldPath}: ${e.message}`);
    }
}

function processSubject(semStr, subFolderFullPath) {
   const subDirs = fs.readdirSync(subFolderFullPath, { withFileTypes: true });

   for (const d of subDirs) {
       const itemPath = path.join(subFolderFullPath, d.name);

       if (d.isDirectory()) {
           const dirName = d.name;

           // 1. Is it exactly a Course Type like "Major_1" or "Minor_1"?
           if (/^Major/i.test(dirName) && dirName !== "Major") {
               const modifier = dirName.replace(/^Major_?/i, 'Major '); // e.g., Major_1 -> Major 1
               const units = fs.readdirSync(itemPath, { withFileTypes: true });
               for (const u of units) {
                   const uPath = path.join(itemPath, u.name);
                   if (u.isDirectory()) {
                       const newPath = path.join(subFolderFullPath, "Major", "Notes", `${modifier} - ${u.name}`);
                       secureRename(uPath, newPath);
                   } else if (u.name.toLowerCase().endsWith('.pdf')) {
                       const newPath = path.join(subFolderFullPath, "Major", "Notes", "General", u.name);
                       secureRename(uPath, newPath);
                   }
               }
           } 
           else if (/^Minor/i.test(dirName) && dirName !== "Minor") {
               const modifier = dirName.replace(/^Minor_?/i, 'Minor ');
               const units = fs.readdirSync(itemPath, { withFileTypes: true });
               for (const u of units) {
                   const uPath = path.join(itemPath, u.name);
                   if (u.isDirectory()) {
                       const newPath = path.join(subFolderFullPath, "Minor", "Notes", `${modifier} - ${u.name}`);
                       secureRename(uPath, newPath);
                   } else if (u.name.toLowerCase().endsWith('.pdf')) {
                       const newPath = path.join(subFolderFullPath, "Minor", "Notes", "General", u.name);
                       secureRename(uPath, newPath);
                   }
               }
           }
           else if (/^Multi/i.test(dirName) && dirName !== "Multi") {
               const modifier = dirName.replace(/^Multi_?/i, 'Multi ');
               const units = fs.readdirSync(itemPath, { withFileTypes: true });
               for (const u of units) {
                   const uPath = path.join(itemPath, u.name);
                   if (u.isDirectory()) {
                       const newPath = path.join(subFolderFullPath, "Multi", "Notes", `${modifier} - ${u.name}`);
                       secureRename(uPath, newPath);
                   } else if (u.name.toLowerCase().endsWith('.pdf')) {
                       const newPath = path.join(subFolderFullPath, "Multi", "Notes", "General", u.name);
                       secureRename(uPath, newPath);
                   }
               }
           }
           // 2. Is it standalone "Papers"?
           else if (dirName.toLowerCase() === 'papers') {
               const newPath = path.join(subFolderFullPath, "Major", "Papers");
               secureRename(itemPath, newPath);
           }
           // 3. Is it standalone "Syllabus"?
           else if (dirName.toLowerCase() === 'syllabus') {
               const newPath = path.join(subFolderFullPath, "Major", "Syllabus");
               secureRename(itemPath, newPath);
           }
       } else if (d.name.toLowerCase().endsWith('.pdf')) {
           // standalone pdf at subject root? Default to Major/Notes/General
           const newPath = path.join(subFolderFullPath, "Major", "Notes", "General", d.name);
           secureRename(itemPath, newPath);
       }
   }
}

try {
    const sems = fs.readdirSync(pdfRoot, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const semDir of sems) {
         const oldSemName = semDir.name;
         // Match SemX (e.g., Sem1)
         const m = oldSemName.match(/^Sem(\d+)$/i);
         let activeSemPath = path.join(pdfRoot, oldSemName);

         if (m) {
             const newSemName = `Sem_${m[1]}`;
             const newSemPath = path.join(pdfRoot, newSemName);
             secureRename(activeSemPath, newSemPath);
             activeSemPath = newSemPath; // Working off the newly renamed dir
         }
         
         // Now process all subjects inside that Semester
         if (fs.existsSync(activeSemPath)) {
             const subjects = fs.readdirSync(activeSemPath, { withFileTypes: true }).filter(d => d.isDirectory());
             for (const subj of subjects) {
                 processSubject(path.basename(activeSemPath), path.join(activeSemPath, subj.name));
             }
         }
    }
    
    // Final cleanup of empty directories recursively (PowerShell friendly)
    try {
        execSync('powershell "Get-ChildItem -Recurse -Directory | Where-Object { @(Get-ChildItem $_.FullName).Count -eq 0 } | Remove-Item"', { cwd: __dirname + '/../pdfs' });
    } catch(e) {}
    console.log("Migration complete!");
} catch (err) {
    console.error("Migration error:", err);
}
