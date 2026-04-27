const fs = require('fs');
const path = require('path');

const pdfRoot = path.join(__dirname, '..', 'pdfs');

/**
 * Sanitize a single path segment (file or folder name):
 *  1. Replace any character that's not alphanumeric, underscore, hyphen, or dot → `_`
 *  2. Collapse consecutive underscores into one
 *  3. Strip leading/trailing underscores
 *
 * Examples:
 *   "Major  1 - Unit_1"           → "Major_1_-_Unit_1"
 *   "Major 1 - Unit 1 (Thermodynamics)" → "Major_1_-_Unit_1_Thermodynamics"
 *   "Unit 1"                      → "Unit_1"
 *   "B.Sc._Sem_4_..Electro_chemistry.pdf" → unchanged (already safe)
 */
function sanitizeName(name) {
    const ext = name.match(/(\.[a-zA-Z0-9]+)$/)?.[1] || '';
    const base = ext ? name.slice(0, -ext.length) : name;
    const sanitized = base
        .replace(/[^a-zA-Z0-9_\-]/g, '_')    // replace unsafe chars with _
        .replace(/_+/g, '_')                   // collapse consecutive underscores
        .replace(/^_+|_+$/g, '');              // strip leading/trailing underscores
    // If sanitization wiped out the whole name (e.g. pure non-ASCII), keep original
    if (!sanitized) return name;
    return sanitized + ext;
}

/**
 * Collect all directories under root, sorted deepest-first.
 * We must rename children before parents so paths stay valid.
 */
function collectDirs(dir) {
    const result = [];
    function walk(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const e of entries) {
            if (e.isDirectory()) {
                const full = path.join(current, e.name);
                walk(full);          // recurse first (depth-first)
                result.push(full);   // push after children → deepest first
            }
        }
    }
    walk(dir);
    return result;
}

let renamedCount = 0;

// ── Step 1: Rename directories (deepest first) ───────────────────────────────
console.log('=== Sanitizing directory names ===');
if (!fs.existsSync(pdfRoot)) {
    console.error('PDF root not found:', pdfRoot);
    process.exit(1);
}

const dirs = collectDirs(pdfRoot);
for (const fullPath of dirs) {
    const parent = path.dirname(fullPath);
    const oldName = path.basename(fullPath);
    const newName = sanitizeName(oldName);

    if (oldName !== newName) {
        const newPath = path.join(parent, newName);
        console.log(`  DIR  "${oldName}"  →  "${newName}"`);
        fs.renameSync(fullPath, newPath);
        renamedCount++;
    }
}

// ── Step 2: Rename PDF files ──────────────────────────────────────────────────
console.log('\n=== Sanitizing file names ===');
function walkFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const fullPath = path.join(dir, e.name);
        if (e.isDirectory()) {
            walkFiles(fullPath);
        } else if (e.isFile() && /\.pdf$/i.test(e.name)) {
            const newName = sanitizeName(e.name);
            if (e.name !== newName) {
                const newPath = path.join(dir, newName);
                console.log(`  FILE "${e.name}"  →  "${newName}"`);
                fs.renameSync(fullPath, newPath);
                renamedCount++;
            }
        }
    }
}
walkFiles(pdfRoot);

// ── Done ──────────────────────────────────────────────────────────────────────
console.log(`\nDone. ${renamedCount} item(s) renamed.`);
if (renamedCount > 0) {
    console.log('\nNext: run  node scripts/generateData.js  to update JSON data files.');
}
