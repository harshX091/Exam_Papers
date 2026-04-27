// REPLACE THIS with your actual Cloudflare Worker URL after deploying.
// Example: https://exam-pdf-proxy.your-subdomain.workers.dev
const WORKER_URL = 'https://pdf-upload.harshthakor091.workers.dev';
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const categorySelect = document.getElementById('category');
    const semesterSelect = document.getElementById('semester');
    const subjectSelect = document.getElementById('subject');
    const courseCodeInput = document.getElementById('courseCode');
    const courseTypeSelect = document.getElementById('courseType');
    const courseTypeGroup = document.getElementById('courseTypeGroup');
    const yearGroup = document.getElementById('yearGroup');
    const examTypeGroup = document.getElementById('examTypeGroup');
    const unitGroup = document.getElementById('unitGroup');
    const yearInput = document.getElementById('year');
    const unitNameInput = document.getElementById('unitName');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('submitSpinner');
    const statusMessage = document.getElementById('statusMessage');
    const filenamePreview = document.getElementById('filenamePreview');
    const previewText = document.getElementById('previewText');
    const btnText = submitBtn.querySelector('span');

    // Toggle fields based on category
    categorySelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'Papers') {
            yearGroup.style.display = 'flex';
            examTypeGroup.style.display = 'flex';
            unitGroup.style.display = 'none';
            unitNameInput.value = '';
        } else if (val === 'Syllabus') {
            yearGroup.style.display = 'none';
            examTypeGroup.style.display = 'none';
            unitGroup.style.display = 'none';
            yearInput.value = '';
            unitNameInput.value = '';
        } else if (val === 'Notes') {
            yearGroup.style.display = 'none';
            examTypeGroup.style.display = 'none';
            unitGroup.style.display = 'flex';
            yearInput.value = '';
        }
    });

    // COMMON SUBJECTS is now loaded from scripts/subjects.js

    // Populate the dropdown initially
    subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
    COMMON_SUBJECTS.sort().forEach(sub => {
        const option = document.createElement('option');
        const displaySub = sub.replace(/_/g, ' ');
        option.value = displaySub;
        option.textContent = displaySub;
        subjectSelect.appendChild(option);
    });

    const coreSubjectSelect = document.getElementById('coreSubject');
    const coreSubjectGroup = document.getElementById('coreSubjectGroup');
    if (coreSubjectSelect) {
        // Populate coreSubject dropdown with non-general subjects
        const NON_GENERAL_SUBJECTS = typeof GENERAL_SUBJECTS !== 'undefined'
            ? COMMON_SUBJECTS.filter(s => !GENERAL_SUBJECTS.includes(s))
            : COMMON_SUBJECTS;

        NON_GENERAL_SUBJECTS.sort().forEach(sub => {
            const option = document.createElement('option');
            const displaySub = sub.replace(/_/g, ' ');
            option.value = displaySub;
            option.textContent = displaySub;
            coreSubjectSelect.appendChild(option);
        });
    }

    // Enable the subject dropdown if a semester is chosen
    semesterSelect.addEventListener('change', () => {
        if (semesterSelect.value) {
            subjectSelect.disabled = false;
        }
    });

    // Hide Course Type for general subjects and show Core Subject instead
    subjectSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const generalSubjectsDisplay = typeof GENERAL_SUBJECTS !== 'undefined'
            ? GENERAL_SUBJECTS.map(s => s.replace(/_/g, ' '))
            : ['English AEC', 'SEC', 'IKS', 'VAC'];

        if (generalSubjectsDisplay.includes(val)) {
            courseTypeGroup.style.display = 'none';
            courseTypeSelect.value = 'General';
            courseTypeSelect.removeAttribute('required');

            if (coreSubjectGroup) {
                if (val === 'English AEC') {
                    coreSubjectGroup.style.display = 'none';
                    coreSubjectSelect.removeAttribute('required');
                    coreSubjectSelect.value = '';
                } else {
                    coreSubjectGroup.style.display = 'flex';
                    coreSubjectSelect.setAttribute('required', 'required');
                }
            }
        } else {
            courseTypeGroup.style.display = 'flex';
            courseTypeSelect.setAttribute('required', 'required');
            if (courseTypeSelect.value === 'General') {
                courseTypeSelect.value = '';
            }

            if (coreSubjectGroup) {
                coreSubjectGroup.style.display = 'none';
                coreSubjectSelect.removeAttribute('required');
                coreSubjectSelect.value = '';
            }
        }
    });

    // ── Dynamic Filename Generation ──
    function generateSemanticFilename() {
        const subject = subjectSelect.value || '';
        const coreSubject = coreSubjectSelect ? coreSubjectSelect.value : '';
        const courseCode = courseCodeInput.value.trim().toUpperCase();
        const category = categorySelect.value;
        const examType = document.getElementById('examType').value;
        const year = document.getElementById('year').value;
        const unitName = document.getElementById('unitName').value.trim();

        if (!subject || !courseCode) return '';

        if (category === 'Notes') {
            const fileInput = document.getElementById('pdfFile');
            if (fileInput && fileInput.files.length > 0) {
                return fileInput.files[0].name.replace(/[^a-zA-Z0-9.\-_ ]/g, '').replace(/\s+/g, ' ');
            }
            return '[Original_File_Name].pdf';
        }

        let parts = [];
        // Convert internal underscores to spaces for the filename
        parts.push(subject.replace(/_/g, ' '));

        // Add core subject if it is visible and selected
        if (coreSubjectGroup && coreSubjectGroup.style.display !== 'none' && coreSubject) {
            parts.push(coreSubject.replace(/_/g, ' '));
        }

        parts.push(courseCode);

        if (category === 'Papers') {
            if (examType) parts.push(examType);
            if (year) parts.push(year);
        } else if (category === 'Syllabus') {
            parts.push('Syllabus');
        }

        // Use underscores instead of spaces for better web compatibility
        return parts.join('_').replace(/[^a-zA-Z0-9.\-_]/g, '').replace(/[\s_]+/g, '_') + '.pdf';
    }

    function updatePreview() {
        const fn = generateSemanticFilename();
        if (fn) {
            filenamePreview.style.display = 'block';
            previewText.textContent = fn;
        } else {
            filenamePreview.style.display = 'none';
        }
    }

    // Attach listeners to update live preview
    const previewInputs = [categorySelect, subjectSelect, courseCodeInput, document.getElementById('examType'), document.getElementById('year'), document.getElementById('unitName'), document.getElementById('pdfFile')];
    if (coreSubjectSelect) previewInputs.push(coreSubjectSelect);

    previewInputs.forEach(el => {
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', updatePreview);
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
        const coreSubject = formData.get('coreSubject');
        const category = formData.get('category');
        const examType = formData.get('examType');
        const year = formData.get('year');
        const unitName = formData.get('unitName');
        const unitType = formData.get('unitType');
        const file = formData.get('pdfFile');
        const subjectTitle = subject.trim();

        let courseCodeVal = formData.get('courseCode');
        if (courseCodeVal) {
            courseCodeVal = courseCodeVal.trim().toUpperCase();
            if (!/^\d{3}A?$/.test(courseCodeVal)) {
                showError('Course code must be exactly a 3-digit number, optionally followed by the letter "A" (e.g., 101 or 101A).');
                return;
            }
        }

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
            // 2. Sanitize filename using dynamic naming logic
            const newFileName = generateSemanticFilename();

            // Determine the final course type to use in the path
            const generalSubjectsDisplay = typeof GENERAL_SUBJECTS !== 'undefined'
                ? GENERAL_SUBJECTS.map(s => s.replace(/_/g, ' '))
                : ['English AEC', 'SEC', 'IKS', 'VAC'];

            let finalCourseType = courseType;
            if (generalSubjectsDisplay.includes(subjectTitle)) {
                // If it's a general subject, use the selected Core Subject (e.g. Physics) as the CourseType folder
                // Fallback to "General" if coreSubject is empty for some reason
                finalCourseType = coreSubject ? coreSubject.replace(/\s+/g, '_') : 'General';
            }

            // 3. Build target path: pdfs/{Semester}/{Subject}/{CourseType}/[{UnitType}]/{Category}/[{UnitName}]/file.pdf
            // Sanitize every path segment to avoid spaces/special chars that break URLs.
            function sanitizeSegment(s) {
                return String(s)
                    .replace(/[^a-zA-Z0-9_.\-]/g, '_')  // unsafe chars → _
                    .replace(/_+/g, '_')                  // collapse multiples
                    .replace(/^_+|_+$/g, '');             // strip leading/trailing _
            }

            const semesterKey = `Sem_${semester}`;
            const pathParts = [
                'pdfs',
                semesterKey,
                sanitizeSegment(subjectFolder),
                sanitizeSegment(finalCourseType)
            ];
            if (unitType) pathParts.push(sanitizeSegment(unitType));
            pathParts.push(sanitizeSegment(category));
            if (category === 'Papers' && examType) {
                pathParts.push(sanitizeSegment(examType));
            }
            if (unitName && unitName.trim()) {
                pathParts.push(sanitizeSegment(unitName.trim()));
            }
            pathParts.push(newFileName);
            const targetPath = pathParts.join('/');

            // 4. Generate metadata
            const branchName = `upload-${semesterKey.toLowerCase()}-${subjectFolder.toLowerCase()}-${Date.now()}`;
            const commitMsg = `Add ${category} for ${subject} (${semesterKey})`;
            const prBody = `
## New Student Upload
A user has submitted a new academic document for review.

- **Semester:** ${semesterKey}
- **Subject:** ${subjectTitle}
- **Course Type:** ${finalCourseType} ${coreSubject ? '(Core Subject)' : ''}
- **Type:** ${category} ${category === 'Papers' && examType ? `(${examType})` : ''}
${year ? `- **Year:** ${year}` : ''}
${unitName ? `- **Unit Name:** ${unitName}` : ''}
${unitType ? `- **Unit Type:** ${unitType}` : ''}
- **Target Path:** \`${targetPath}\`

Merging this PR will automatically publish the document and regenerate the site data.
            `;

            // 5. Create FormData for raw binary upload
            const payload = new FormData();

            // Pre-read the file into memory. This prevents the "Failed to fetch" error
            // on mobile devices when selecting a virtual file directly from Google Drive.
            let safeFile = file;
            try {
                const arrayBuffer = await file.arrayBuffer();
                safeFile = new File([arrayBuffer], newFileName, { type: file.type });
            } catch (readError) {
                throw new Error("Could not read the file. If you are selecting directly from Google Drive, please download the PDF to your device first before uploading.");
            }

            payload.append('file', safeFile);
            payload.append('targetPath', targetPath);
            payload.append('branchName', branchName);
            payload.append('commitMsg', commitMsg);
            payload.append('prBody', prBody);

            // 6. Send to PROXY Server
            console.log("Sending upload request to proxy...");
            const response = await fetch(`${WORKER_URL}`, {
                method: 'POST',
                // Exclude Content-Type header so the browser sets the correct multipart boundary
                body: payload
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Proxy Error (${response.status})`);
            }

            const data = await response.json();

            showSuccess(
                `✅ PDF submitted successfully! It will be live on the site in a few minutes.`
            );
            form.reset();
            categorySelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Final upload error details:', error);
            showError(`Error:${error.message}<br><small>If this persists, check your Cloudflare Worker logs.</small>`);
        } finally {
            setLoading(false);
        }
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

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
