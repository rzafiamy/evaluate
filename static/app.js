async function loadPage(page) {
    const content = document.getElementById('content');
    content.innerHTML = `<div id="progress-container"><div id="progress-bar"></div></div>`;

    if (page === 'evaluate') {
       // Fetch available models from the API
       const models = await fetchModels();

       // Construct the model selection dropdown
       let modelOptions = models.map(model => `<option value="${model.id}">${model.id}</option>`).join('');

       content.innerHTML += `
           <h2>Evaluate LLM</h2>
           <div class="evaluate-form">
            <form action="/evaluate" method="POST" enctype="multipart/form-data">
                <input type="file" name="dataset" required onchange="previewDataset(event)">
                <input type="number" name="wait_time" placeholder="Wait Time (seconds)" value="2">
                <select name="model" required>
                    <option value="">Select a Model</option>
                    ${modelOptions}
                </select>
                <button type="submit">Evaluate</button>
            </form>
           </div>
           <div id="preview-container" class="mt-4"></div>
       `;
    } else if (page === 'results') {
        fetch('/load_results')
            showProgressBar();
            fetch('/load_results')
                .then(res => res.json())
                .then(files => renderResults(files.files))
                .catch(err => console.error(err))
                .finally(() => hideProgressBar());
    }
}


async function fetchModels() {
    try {
        showProgressBar();
        const response = await fetch('/models');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error fetching models:', error);
        return [];
    } finally {
        hideProgressBar();
    }
}



async function previewDataset(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('No file selected.');
        return;
    }

    const formData = new FormData();
    formData.append("dataset", file);

    try {
        showProgressBar();
        const response = await fetch("/load_dataset", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error loading dataset: ${response.statusText}`);
        }

        const data = await response.json();
        renderDatasetPreview(data);
    } catch (error) {
        document.getElementById('preview-container').innerHTML = 
            `<p class="text-red-500">Failed to load YAML file!</p>`;
        console.error("Error fetching dataset:", error);
    } finally {
        hideProgressBar();
    }
}



function renderDatasetPreview(data) {
    const container = document.getElementById('preview-container');
    let htmlContent = '<h3 class="font-bold mb-2">📋 Test Cases Preview:</h3><ul>';
    data.forEach(test => {
        htmlContent += `<li class="mb-2 p-3 bg-blue-900 rounded">
                            🔹 <strong>Test ${test.test}:</strong> ${test.prompt}
                        </li>`;
    });
    htmlContent += '</ul>';
    container.innerHTML = htmlContent;
}


function renderResults(files) {
    const content = document.getElementById('content');
    if (files.length === 0) {
        content.innerHTML += `
            <div class="no-results">No evaluation results found.</div>`;
        return;
    }

    let htmlContent = `<h2 class="results-header">📊 Recent Evaluation Results</h2>
                       <div class="results-grid">`;

    files.forEach(file => {
        htmlContent += `
            <div class="result-card">
                <div class="result-icon">📄</div>
                <div class="result-info">
                    <a onclick="loadResultDetail('${file}')">${file}</a>
                </div>
            </div>`;
    });

    htmlContent += `</div>`;
    htmlContent += `<div id="result-detail" class="mt-6"></div>`;
    document.getElementById('content').innerHTML += htmlContent;
}


async function loadResultDetail(filename) {
    try {
        showProgressBar();
        const response = await fetch(`/result_content/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        renderResultDetail(data, filename);
    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
        hideProgressBar();
    }
}



function renderResultDetail(data, filename) {
    let detailHtml = `<h3 class="text-lg font-semibold mb-2">📝 Details for: ${filename}</h3>`;
    detailHtml += `<div class="overflow-auto rounded-lg shadow-lg">
        <table class="min-w-full bg-gray-800 text-white">
            <thead class="bg-indigo-700">
                <tr>
                    <th class="py-2 px-3">Test</th>
                    <th class="py-2 px-4">Prompt</th>
                    <th>Category</th>
                    <th>Expected</th>
                    <th>Response</th>
                    <th>Similarity</th>
                    <th>Success</th>
                </tr>
            </thead>
            <tbody>`;

    data.forEach(row => {
        detailHtml += `<tr class="border-b border-gray-700 hover:bg-gray-700 transition">
            <td class="py-2 px-3">${row.Test}</td>
            <td class="px-3">${row.Prompt}</td>
            <td class="px-2">${row.Category}</td>
            <td class="px-2">${row.Expected}</td>
            <td class="px-2">${row.Response}</td>
            <td class="px-2">${row.Similarity}</td>
            <td class="px-2">${row.Success}</td>
        </tr>`;
    });

    detailHtml += `</tbody></table></div>`;

    document.getElementById('result-detail').innerHTML = detailHtml;
}

function showProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';

    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) {
            clearInterval(interval); // Stop increasing artificially
        } else {
            width += 10;
            progressBar.style.width = width + '%';
        }
    }, 300);
}

function hideProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '100%';
    setTimeout(() => {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
    }, 500);
}
