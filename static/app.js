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
    document.getElementById("evaluation-progress").innerHTML = "<h3>Progress:</h3><ul id='progress-log'></ul>";

    showProgressBar();

    const response = await fetch("/evaluate", {
        method: "POST",
        body: formData,
    });

    if (!response.ok || !response.body) {
        hideProgressBar();
        document.getElementById("evaluation-progress").innerHTML += "<p class='text-red-500'>❌ Evaluation failed.</p>";
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

                    let message = JSON.parse(rawMessage);
                    if (typeof message === "string") {
                        message = JSON.parse(message);
                        console.log("Final parsed message:", message);
                    }

                    updateTestStatus(message);
                }
            }
        }
    }

    await readStream();

    hideProgressBar();
    document.getElementById("evaluation-progress").innerHTML += "<p>✅ Evaluation Completed!</p>";
}

function updateTestStatus(update) {
    const progressLog = document.getElementById("progress-log");
    console.log(progressLog)
    if (update.status === "running") {
        progressLog.innerHTML += `<li>🔄 ${update.message}</li>`;

        const testElement = document.getElementById(`test-${update.test}`);
        console.log(testElement)
        if (testElement) {
            testElement.querySelector(".status-label").innerHTML = "🔄 Running...";
        }
    } else if (update.status === "completed") {
        progressLog.innerHTML += `<li>✅ ${update.message}</li>`;

        const testElement = document.getElementById(`test-${update.test}`);
        if (testElement) {
            const statusSpan = testElement.querySelector(".status-label");
            if (statusSpan) {
                if (update.success) {
                    statusSpan.innerHTML = "✅ Passed";
                    statusSpan.style.color = "green";
                } else {
                    statusSpan.innerHTML = "❌ Failed";
                    statusSpan.style.color = "red";
                }
            }
        }
    } else if (update.status === "error") {
        progressLog.innerHTML += `<li class="text-red-500">❌ ${update.message}</li>`;
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
        htmlContent += `<li class="mb-2 p-3 bg-blue-900 rounded" id="test-${test.test}">
                            🔹 <strong>Test ${test.test}:</strong> ${test.prompt}
                            <span class="status-label">⏳ Not Started</span>
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
