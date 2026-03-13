// REPLACE THIS with your actual Cloudflare Worker URL after deploying.
// Example: https://exam-pdf-proxy.your-subdomain.workers.dev
const WORKER_URL = 'https://pdf-upload.harshthakor091.workers.dev';
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

        if (WORKER_URL.includes('REPLACE_WITH_YOUR')) {
            showError('<strong>Setup Required:</strong> Please update the <code>WORKER_URL</code> in <code>scripts/upload.js</code> after deploying to Cloudflare.');
            return;
        }

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

            // 5. Generate metadata
            const branchName = `upload-${semesterKey.toLowerCase()}-${subjectFolder.toLowerCase()}-${Date.now()}`;
            const commitMsg = `Add ${category} for ${subject} (${semesterKey})`;
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

            // 6. Send to PROXY Server
            console.log("Sending upload request to proxy...");
            const response = await fetch(`${WORKER_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPath,
                    branchName,
                    commitMsg,
                    base64Data,
                    prBody
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Proxy Error (${response.status})`);
            }

            const data = await response.json();

            showSuccess(
                `✅ Submitted for admin review! Your material will be available soon.`
            );
            form.reset();
            categorySelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Final upload error details:', error);
            showError(`Error: ${error.message}<br><small>If this persists, check your Cloudflare Worker logs.</small>`);
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
