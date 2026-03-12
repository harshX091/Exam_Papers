const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase limit to 50MB for PDF uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Health check
app.get('/', (req, res) => res.send('Upload Proxy is running!'));

app.post('/upload', async (req, res) => {
    const { targetPath, branchName, commitMsg, base64Data, prBody } = req.body;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = 'harshX091/Exam_Papers';

    if (!GITHUB_TOKEN) {
        return res.status(500).json({ message: 'Server Configuration Error: GITHUB_TOKEN is missing.' });
    }

    const ghHeaders = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };

    try {
        // A. Get main branch SHA
        const refRes = await axios.get(
            `https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`,
            { headers: ghHeaders }
        );
        const mainSha = refRes.data.object.sha;

        // B. Create new branch
        await axios.post(
            `https://api.github.com/repos/${GITHUB_REPO}/git/refs`,
            { ref: `refs/heads/${branchName}`, sha: mainSha },
            { headers: ghHeaders }
        );

        // C. Commit file
        await axios.put(
            `https://api.github.com/repos/${GITHUB_REPO}/contents/${targetPath}`,
            { message: commitMsg, content: base64Data, branch: branchName },
            { headers: ghHeaders }
        );

        // D. Create Pull Request
        const prRes = await axios.post(
            `https://api.github.com/repos/${GITHUB_REPO}/pulls`,
            { title: commitMsg, body: prBody, head: branchName, base: 'main' },
            { headers: ghHeaders }
        );

        res.json({ success: true, prUrl: prRes.data.html_url });

    } catch (error) {
        console.error('GitHub API Error:', error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || error.message
        });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
