document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('uploadForm');
    const categorySelect = document.getElementById('category');
    const yearGroup = document.getElementById('yearGroup');
    const unitGroup = document.getElementById('unitGroup');
    const yearInput = document.getElementById('year');
    const unitInput = document.getElementById('unit');
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
            unitInput.value = '';
        } else if (val === 'Syllabus') {
            yearGroup.style.display = 'none';
            unitGroup.style.display = 'none';
            yearInput.value = '';
            unitInput.value = '';
        } else if (val === 'Notes') {
            yearGroup.style.display = 'none';
            unitGroup.style.display = 'flex';
            yearInput.value = '';
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
        let subject = formData.get('subject').trim();
        const category = formData.get('category');
        const year = formData.get('year');
        const unit = formData.get('unit');
        const file = formData.get('pdfFile');

        // Basic validation
        if (!file || file.type !== 'application/pdf') {
            showError('Please select a valid PDF file.');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            showError('File is too large. Maximum size is 10MB.');
            return;
        }

        // Format Subject (Title Case, replace spaces with underscores for folder structure)
        subject = subject.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        const subjectFolder = subject.replace(/\s+/g, '_');

        // 2. Read File as Base64
        setLoading(true);
        try {
            const base64Content = await getBase64(file);
            // Remove the Data URL prefix (e.g., "data:application/pdf;base64,")
            const base64Data = base64Content.split(',')[1];

            const originalFilename = file.name;

            // 3. Prepare Payload for Serverless Function
            const payload = {
                semester: `Sem_${semester}`,
                subjectTitle: subject,
                subjectFolder: subjectFolder,
                category: category,
                year: year ? parseInt(year, 10) : null,
                unit: unit ? parseInt(unit, 10) : null,
                fileName: originalFilename,
                fileContent: base64Data
            };

            // 4. Send to Serverless API
            // Note: Update this URL to the actual deployed endpoint
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                showSuccess('Success! Your paper has been submitted for admin approval.');
                form.reset();
                categorySelect.dispatchEvent(new Event('change')); // Reset UI state
            } else {
                throw new Error(result.error || 'Failed to submit file.');
            }

        } catch (error) {
            console.error('Upload error:', error);
            showError(`Error: ${error.message} (Is the backend running?)`);
        } finally {
            setLoading(false);
        }
    });

    function getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
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
