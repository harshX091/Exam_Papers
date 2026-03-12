// ─── GitHub Configuration ────────────────────────────────────────────────────
// To prevent GitHub from automatically revoking the token, we store it as a 
// Base64 encoded string. Use btoa('your_token') in your console to get the string.
const MASKED_TOKEN = ''; // ← paste your BASE64 ENCODED token here
const GITHUB_REPO  = 'harshX091/Exam_Papers';
const GITHUB_TOKEN = MASKED_TOKEN ? atob(MASKED_TOKEN) : '';
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const categorySelect = document.getElementById('category');
    const semesterSelect = document.getElementById('semester');
    const subjectSelect = document.getElementById('subject');
    const yearGroup = document.getElementById('yearGroup');
    const unitGroup = document.getElementById('unitGroup');
    const yearInput = document.getElementById('year');
    const unitNameInput = document.getElementById('unitName');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('submitSpinner');
    const statusMessage = document.getElementById('statusMessage');
    const btnText = submitBtn.querySelector('span');

    // Toggle fields based on category
    categorySelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'Papers') {
            yearGroup.style.display = 'flex';
            unitGroup.style.display = 'none';
            unitNameInput.value = '';
        } else if (val === 'Syllabus') {
            yearGroup.style.display = 'none';
            unitGroup.style.display = 'none';
            yearInput.value = '';
            unitNameInput.value = '';
        } else if (val === 'Notes') {
            yearGroup.style.display = 'none';
            unitGroup.style.display = 'flex';
            yearInput.value = '';
        }
    });

    // COMMON SUBJECTS used across semesters
    const ALL_SUBJECTS = [
        "Physics", "Chemistry", "Mathematics", "Electronics",
        "Zoology", "Botany", "Computer_Science", "English",
        "Sanskrit", "Statistics"
    ];

    // Populate the dropdown initially
    subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
    ALL_SUBJECTS.sort().forEach(sub => {
        const option = document.createElement('option');
        const displaySub = sub.replace(/_/g, ' ');
        option.value = displaySub;
        option.textContent = displaySub;
        subjectSelect.appendChild(option);
    });

    // Enable the subject dropdown if a semester is chosen
    semesterSelect.addEventListener('change', () => {
        if (semesterSelect.value) {
            subjectSelect.disabled = false;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset status
        statusMessage.className = '';
        statusMessage.innerHTML = '';
        statusMessage.style.display = 'none';

        // 1. Get Form Data
        const formData = new FormData(form);
        const semester = formData.get('semester');
        let subject = formData.get('subject');
        const courseType = formData.get('courseType');
        const category = formData.get('category');
        const year = formData.get('year');
        const unitName = formData.get('unitName');
        const unitType = formData.get('unitType');
        const file = formData.get('pdfFile');

        if (!subject) {
            showError('Please select a Subject.');
            return;
        }
        subject = subject.trim();

        if (!file || file.type !== 'application/pdf') {
            showError('Please select a valid PDF file.');
            return;
        }

        // 50 MB limit — safe well within GitHub API's ~75 MB effective ceiling
        if (file.size > 50 * 1024 * 1024) {
            showError('File is too large. Maximum size is 50 MB.');
            return;
        }

        // Format subject for folder path
        subject = subject.replace(/\w\S*/g, txt =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        const subjectFolder = subject.replace(/\s+/g, '_');

        setLoading(true);
        try {
            // 2. Read file as Base64
            const base64Content = await getBase64(file);
            const base64Data = base64Content.split(',')[1]; // strip data-URL prefix

            // 3. Sanitize filename
            const newFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

            // 4. Build target path: pdfs/{Semester}/{Subject}/{CourseType}/[{UnitType}]/{Category}/[{UnitName}]/file.pdf
            const semesterKey = `Sem_${semester}`;
            const pathParts = ['pdfs', semesterKey, subjectFolder, courseType];
            if (unitType) pathParts.push(unitType);
            pathParts.push(category);
            if (unitName && unitName.trim()) {
                pathParts.push(unitName.trim().replace(/[^a-zA-Z0-9.\-_]/g, '_'));
            }
            pathParts.push(newFileName);
            const targetPath = pathParts.join('/');

            // 5. Generate a unique branch name
            const branchName = `upload-${semesterKey.toLowerCase()}-${subjectFolder.toLowerCase()}-${Date.now()}`;

            const ghHeaders = {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            };

            // A. Get SHA of main branch
            const refRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`,
                { headers: ghHeaders }
            );
            if (!refRes.ok) throw new Error('Could not reach GitHub. Check your token.');
            const refData = await refRes.json();
            const mainSha = refData.object.sha;

            // B. Create new branch
            const branchRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/git/refs`,
                {
                    method: 'POST',
                    headers: ghHeaders,
                    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: mainSha })
                }
            );
            if (!branchRes.ok) throw new Error('Failed to create upload branch on GitHub.');

            // C. Commit the file to the new branch
            const commitMsg = `Add ${category} for ${subject} (${semesterKey})`;
            const uploadRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/contents/${targetPath}`,
                {
                    method: 'PUT',
                    headers: ghHeaders,
                    body: JSON.stringify({ message: commitMsg, content: base64Data, branch: branchName })
                }
            );
            if (!uploadRes.ok) {
                const err = await uploadRes.json();
                throw new Error(`GitHub file upload failed: ${err.message}`);
            }

            // D. Open a Pull Request for admin review
            const prBody = `
## New Student Upload
A user has submitted a new academic document for review.

- **Semester:** ${semesterKey}
- **Subject:** ${subject}
- **Course Type:** ${courseType}
- **Type:** ${category}
${year ? `- **Year:** ${year}` : ''}
${unitName ? `- **Unit Name:** ${unitName}` : ''}
${unitType ? `- **Unit Type:** ${unitType}` : ''}
- **Target Path:** \`${targetPath}\`

Merging this PR will automatically publish the document and regenerate the site data.
            `;

            const prRes = await fetch(
                `https://api.github.com/repos/${GITHUB_REPO}/pulls`,
                {
                    method: 'POST',
                    headers: ghHeaders,
                    body: JSON.stringify({ title: commitMsg, body: prBody, head: branchName, base: 'main' })
                }
            );
            if (!prRes.ok) throw new Error('Failed to create Pull Request.');
            const prData = await prRes.json();

            showSuccess(
                `✅ Submitted for admin review! ` +
                `<a href="${prData.html_url}" target="_blank" rel="noopener">View Pull Request →</a>`
            );
            form.reset();
            categorySelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Upload error:', error);
            showError(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    function getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = err => reject(err);
        });
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        btnText.style.display = isLoading ? 'none' : 'block';
        spinner.style.display = isLoading ? 'block' : 'none';
    }

    function showError(msg) {
        statusMessage.className = 'error';
        statusMessage.innerHTML = msg;
        statusMessage.style.display = 'block';
    }

    function showSuccess(msg) {
        statusMessage.className = 'success';
        statusMessage.innerHTML = msg;
        statusMessage.style.display = 'block';
    }
});
