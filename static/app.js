function loadPage(page) {
    const content = document.getElementById('content');
    if (page === 'evaluate') {
        content.innerHTML = `
            <h2>Evaluate LLM</h2>
            <form action="/evaluate" method="POST" enctype="multipart/form-data">
                <input type="file" name="dataset" required onchange="previewDataset(event)">
                <input type="number" name="wait_time" placeholder="Wait Time (seconds)" value="2">
                <button type="submit">Evaluate</button>
            </form>
            <div id="preview-container" class="mt-4"></div>
            `;
    } else if (page === 'results') {
        fetch('/load_results')
            .then(res => res.json())
            .then(files => renderResults(files.files))
            .catch(err => console.error(err));
    }
}


function previewDataset(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('No file selected.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const yamlContent = e.target.result;
        try {
            const data = jsyaml.load(yamlContent);
            renderDatasetPreview(data);
        } catch (error) {
            document.getElementById('preview-container').innerHTML = `<p class="text-red-500">Invalid YAML file!</p>`;
            console.error("YAML Parsing error:", error);
        }
    };
    reader.readAsText(file);
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
        content.innerHTML = `
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
    document.getElementById('content').innerHTML = htmlContent;
}


async function loadResultDetail(filename) {
    fetch(`/result_content/${filename}`) // Use the Flask API endpoint
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json(); // Parse JSON response
        })
        .then(data => {
            renderResultDetail(data, filename); // Pass parsed JSON data
        })
        .catch(err => console.error('Error loading data:', err));
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