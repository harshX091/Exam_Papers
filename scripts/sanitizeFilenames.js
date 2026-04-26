const fs = require('fs');
const path = require('path');

const pdfRoot = path.join(__dirname, '..', 'pdfs');

function walk(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            walk(fullPath);
        } else if (file.isFile() && /\.pdf$/i.test(file.name)) {
            if (file.name.includes(' ')) {
                const newName = file.name.replace(/\s+/g, '_');
                const newPath = path.join(dir, newName);
                console.log(`Renaming: "${file.name}" -> "${newName}"`);
                fs.renameSync(fullPath, newPath);
            }
        }
    }
}

console.log('Starting filename sanitization...');
if (fs.existsSync(pdfRoot)) {
    walk(pdfRoot);
    console.log('Sanitization complete.');
} else {
    console.error('PDF root not found:', pdfRoot);
}
