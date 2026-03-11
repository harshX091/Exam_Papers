// Vercel Serverless Function
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '15mb', // Need higher limit for large PDFs encoded in base64
        },
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            semester,     // e.g. "Sem_4"
            subjectTitle, // e.g. "Physics"
            subjectFolder,// e.g. "Physics" (underscored)
            courseType,   // "Major", "Minor", "Multi", etc.
            category,     // "Papers", "Syllabus", "Notes"
            year,         // 2026 or null
            unitName,     // e.g. "Mechanics"
            unitType,     // "SEC" or "IKS"
            fileName,     // "original_file.pdf"
            fileContent   // Base64 string
        } = req.body;

        if (!semester || !subjectFolder || !courseType || !category || !fileName || !fileContent) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_REPO = process.env.GITHUB_REPO; // e.g. "username/Exam_Papers"

        if (!GITHUB_TOKEN || !GITHUB_REPO) {
            console.error("Missing GitHub configuration.");
            return res.status(500).json({ error: 'Server misconfiguration: Missing GitHub credentials.' });
        }

        // 1. Generate a secure, standardized file name based on the original name
        let newFileName = fileName;

        // Remove spaces and sanitize (keeping standard characters)
        newFileName = newFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

        // 2. Construct the Git Path
        // New Nested Path: pdfs/{Semester}/{Subject}/{CourseType}/[{UnitType}]/{Category}/[{UnitName}]/filename.pdf
        const pathParts = [
            'pdfs',
            semester,
            subjectFolder,
            courseType
        ];

        if (unitType) pathParts.push(unitType);
        pathParts.push(category);
        
        // Only append unitName folder if it's Notes or Syllabus that specified a Unit Name explicitly
        if (unitName) {
             // Sanitize unitName for folder usage
             const safeUnitName = unitName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
             pathParts.push(safeUnitName);
        }
        
        pathParts.push(newFileName);
        const targetPath = pathParts.join('/');

        // Generate dynamic branch name
        const timestamp = Date.now();
        const branchName = `upload-${semester.toLowerCase()}-${subjectFolder.toLowerCase()}-${timestamp}`;

        // --- GitHub API Interactions --- //

        const headers = {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        };

        // A. Get the SHA of the main branch
        const refRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`, { headers });
        if (!refRes.ok) throw new Error('Failed to fetch main branch ref');
        const refData = await refRes.json();
        const mainSha = refData.object.sha;

        // B. Create a new branch
        const createBranchRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ref: `refs/heads/${branchName}`,
                sha: mainSha
            })
        });
        if (!createBranchRes.ok) throw new Error('Failed to create branch');

        // C. Upload the file to the new branch
        const commitMessage = `Add ${category} for ${subjectTitle} (${semester})`;
        const uploadRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${targetPath}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                content: fileContent,
                branch: branchName
            })
        });
        if (!uploadRes.ok) {
            const errData = await uploadRes.json();
            throw new Error(`Failed to upload file to GitHub: ${errData.message}`);
        }

        // D. Create a Pull Request
        const prBody = `
## New Student Upload
A user has submitted a new academic document for review.

- **Semester:** ${semester}
- **Subject:** ${subjectTitle}
- **Course Type:** ${courseType}
- **Type:** ${category}
${year ? `- **Year:** ${year}` : ''}
${unitName ? `- **Unit Name:** ${unitName}` : ''}
${unitType ? `- **Unit Type:** ${unitType}` : ''}
- **Target Path:** \`${targetPath}\`

Please review the attached PDF file. Merging this PR will automatically publish the document.
        `;

        const prRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/pulls`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                title: commitMessage,
                body: prBody,
                head: branchName,
                base: 'main'
            })
        });

        if (!prRes.ok) throw new Error('Failed to create pull request');

        const prData = await prRes.json();

        return res.status(200).json({
            success: true,
            message: 'Pull request created successfully.',
            pr_url: prData.html_url
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
