async function loadPage(page) {
    const content = document.getElementById('content');
    content.innerHTML = `<div id="progress-container"><div id="progress-bar"></div></div>`;

    if (page === 'evaluate') {
        showProgressBar(); // Show progress while loading models

        // Fetch available models from the API
        const models = await fetchModels();

        // Construct the model selection dropdown
        let modelOptions = models.map(model => `<option value="${model.id}">${model.id}</option>`).join('');

        content.innerHTML += `
            <h2>🚀 Evaluate LLM</h2>
            <div class="evaluate-form">
                <form id="evaluation-form" enctype="multipart/form-data">
                    <label for="dataset">Dataset (yaml file):</label>
                    <input type="file" name="dataset" required onchange="previewDataset(event)">
                    <label for="wait_time">Wait Time (seconds):</label>
                    <input type="number" name="wait_time" placeholder="Wait Time (seconds)" value="2">
                    <label for="model">Model:</label>
                    <select name="model" required>
                        <option value="">Select a Model</option>
                        ${modelOptions}
                    </select>
                    <button type="submit">Evaluate</button>
                </form>
            </div>
            <div id="preview-container" class="mt-4"></div>
            <div id="evaluation-progress" class="progress-box"></div>
        `;

        hideProgressBar(); // Hide progress after models load

        // Attach event listener for real-time progress updates
        document.getElementById("evaluation-form").addEventListener("submit", startEvaluation);
    } else if (page === 'results') {
        showProgressBar();
        fetch('/load_results')
            .then(res => res.json())
            .then(files => renderResults(files.files))
            .catch(err => console.error(err))
            .finally(() => hideProgressBar());
    }
}

async function startEvaluation(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const progressLog = document.getElementById("evaluation-progress");
    progressLog.innerHTML = "<h3>Progress:</h3><ul id='progress-log'></ul>";

    showProgressBar();

    const response = await fetch("/evaluate", {
        method: "POST",
        body: formData,
    });

    if (!response.ok || !response.body) {
        hideProgressBar();
        progressLog.insertAdjacentHTML("beforeend", "<p class='text-red-500'>❌ Evaluation failed.</p>");
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    async function readStream() {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process only complete messages (`\n\n` is SSE separator)
            let parts = buffer.split("\n\n");
            buffer = parts.pop();  // Keep the incomplete part in buffer

            for (let part of parts) {
                if (part.startsWith("data: ")) {
                    const rawMessage = part.replace("data: ", "").trim();

                    try {
                        let message = JSON.parse(rawMessage);
                        if (typeof message === "string") {
                            message = JSON.parse(message);
                        }
                        updateTestStatus(message);
                    } catch (error) {
                        console.error("Error parsing JSON:", error);
                    }
                }
            }
        }
    }

    await readStream();

    hideProgressBar();
    progressLog.insertAdjacentHTML("beforeend", `<p class="evaluation-status">✅ Evaluation Completed!</p>`);
}

function updateTestStatus(update) {
    const testElement = document.getElementById(`test-${update.test}`);

    if (!testElement) {
        console.warn(`Test element not found for test-${update.test}`);
        return;
    }

    const statusSpan = testElement.querySelector(".status-label");

    if (update.status === "running") {
        statusSpan.innerHTML = "🔄 Running...";
        statusSpan.style.color = "orange";
    } 
    else if (update.status === "completed") {
        if (statusSpan) {
            statusSpan.innerHTML = update.success ? "✅ Passed" : "❌ Failed";
            statusSpan.style.color = update.success ? "green" : "red";
        }

        // Inject all details into the collapsible section
        let detailsContainer = testElement.querySelector(".group div");
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <p><strong>Prompt:</strong> ${update.prompt}</p>
                <p><strong>Category:</strong> ${update.category}</p>
                <p><strong>Expected:</strong> ${update.expected}</p>
                <p><strong>Result:</strong> ${update.result}</p>
                <p><strong>Temperature:</strong> ${update.temperature}</p>
                <p><strong>Max Tokens:</strong> ${update.max_tokens}</p>
                <p><strong>Language:</strong> ${update.language}</p>
                <p><strong>Similarity:</strong> ${update.similarity ? update.similarity.toFixed(2) : "N/A"}</p>
            `;
        }
    } 
    else if (update.status === "error") {
        statusSpan.innerHTML = "❌ Error";
        statusSpan.style.color = "red";

        // Append error details
        let detailsContainer = testElement.querySelector(".group div");
        if (detailsContainer) {
            detailsContainer.innerHTML = `<p class="text-red-500">❌ ${update.message}</p>`;
        }
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
    let htmlContent = '<h3 class="font-bold mb-2">📋 Test Cases Preview:</h3><ul class="space-y-3">';

    data.forEach(test => {
        htmlContent += `
            <li class="mb-2 p-3 bg-blue-900 rounded shadow-lg" id="test-${test.test}">
                <details class="group">
                    <summary class="cursor-pointer flex justify-between items-center text-white font-semibold">
                        🔹 <strong>Test ${test.test}:</strong> ${test.prompt}
                        <span class="status-label">⏳ Not Started</span>
                    </summary>
                    <div class="ml-5 mt-2 text-gray-200 detailed-results">
                        <p><strong>Expected:</strong> ${test.expected || "N/A"}</p>
                        <p><strong>Result:</strong> ${test.result || "Pending..."}</p>
                        <p><strong>Similarity:</strong> ${test.similarity || "N/A"}</p>
                    </div>
                </details>
            </li>`;
    });

    htmlContent += '</ul>';
    container.innerHTML = htmlContent;
}



function renderResults(files) {
    const content = document.getElementById('content');
    content.innerHTML = `<div id="progress-container"><div id="progress-bar"></div></div>`

    if (files.length === 0) {
        content.innerHTML += `
            <div class="no-results">No evaluation results found.</div>`;
        return;
    }

    let htmlContent = `<h2 class="results-header">📊 Recent Evaluation Results</h2>
                       <div class="results-grid">`;

    // Ensure files are sorted by date (descending, newest first)
    files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    files.forEach(file => {
        htmlContent += `
            <div class="result-card">
                <div class="result-icon">📄</div>
                <div class="result-info">
                    <a onclick="loadResultDetail('${file.filename}')">${file.filename}</a>
                    <div class="result-date">📅 ${relativeDate(file.created_at)}</div>
                </div>
            </div>`;
    });    

    htmlContent += `</div>`;
    htmlContent += `<div id="result-detail" class="mt-6"></div>`;
    content.innerHTML += htmlContent;
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
    let detailHtml = `<h3 class="tab-title">📝 Details for: ${filename}</h3>`;
    detailHtml += `<div class="table-container">
        <table class="result-table">
            <thead>
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
            <td>${row.Test}</td>
            <td>${row.Prompt}</td>
            <td>${row.Category}</td>
            <td>${row.Expected}</td>
            <td>${row.Response}</td>
            <td>${row.Similarity}</td>
            <td class=${row.Success}>${row.Success}</td>
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

// ✅ Hide Progress Bar
function hideProgressBar() {
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = '100%';
    setTimeout(() => {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
    }, 500);
}

function relativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    const intervals = [
        { label: "year", seconds: 31536000 },
        { label: "month", seconds: 2592000 },
        { label: "day", seconds: 86400 },
        { label: "hour", seconds: 3600 },
        { label: "minute", seconds: 60 },
        { label: "second", seconds: 1 }
    ];

    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
        }
    }
    return "Just now";
}
