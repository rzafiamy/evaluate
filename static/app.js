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

        // Restore Form State
        restoreFormState();

        // Restore last dataset
        const lastDataset = localStorage.getItem("lastDataset");
        if (lastDataset) {
            renderDatasetPreview(JSON.parse(lastDataset));
        }

        // Restore evaluation progress
        const lastEvaluation = localStorage.getItem("evaluationStatus");
        if (lastEvaluation) {
            const evaluations = JSON.parse(lastEvaluation);
            for (const testId in evaluations) {
                updateTestStatus(evaluations[testId]);
            }
        }

        const form = document.getElementById("evaluation-form");

        if (form) {
            console.log("Hello")
            form.addEventListener("change", saveFormState);
        }
    } else if (page === 'results') {
        showProgressBar();
        fetch('/load_results')
            .then(res => res.json())
            .then(files => renderResults(files.files))
            .catch(err => console.error(err))
            .finally(() => hideProgressBar());
    }
}

function saveFormState() {
    const datasetInput = document.querySelector("input[name='dataset']");
    const waitTimeInput = document.querySelector("input[name='wait_time']");
    const modelInput = document.querySelector("select[name='model']");

    const formState = {
        dataset: datasetInput?.files[0]?.name || localStorage.getItem("lastDatasetName") || "",
        wait_time: waitTimeInput.value,
        model: modelInput.value
    };

    localStorage.setItem("formState", JSON.stringify(formState));
}

function restoreFormState() {
    const formState = JSON.parse(localStorage.getItem("formState"));

    if (formState) {
        const waitTimeInput = document.querySelector("input[name='wait_time']");
        const modelInput = document.querySelector("select[name='model']");
        const datasetInput = document.querySelector("input[name='dataset']");
        const datasetLabel = document.querySelector("label[for='dataset']");
        const previewContainer = document.getElementById("preview-container");

        if (waitTimeInput) waitTimeInput.value = formState.wait_time || "2";
        if (modelInput) modelInput.value = formState.model || "";

        const lastDatasetName = localStorage.getItem("lastDatasetName");
        if (lastDatasetName && datasetLabel) {
            datasetLabel.innerHTML = `Dataset (Last used: <strong>${lastDatasetName}</strong>)`;

            // Show a message requiring the user to re-upload
            previewContainer.innerHTML = `
                <p class="text-yellow-500">⚠️ File selection does not persist. Please re-upload <strong>${lastDatasetName}</strong> if needed.</p>
            `;
        }
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
    console.log(update)
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

    // Save progress status to localStorage
    const evaluationData = JSON.parse(localStorage.getItem("evaluationStatus")) || {};
    evaluationData[update.test] = update;
    localStorage.setItem("evaluationStatus", JSON.stringify(evaluationData));
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

    const reader = new FileReader();
    reader.onload = function (e) {
        localStorage.setItem("lastDatasetName", file.name);
    };
    reader.readAsText(file); // Needed to trigger the onload event

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
        localStorage.setItem("lastDataset", JSON.stringify(data)); // Save dataset preview
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
    console.log(data);
    const datasetName = localStorage.getItem("lastDatasetName");
    
    const container = document.getElementById('preview-container');
    let htmlContent = `<h3 class="font-bold mb-2">📋 Test Cases : ${datasetName}</h3><ul class="space-y-3">`;

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

// Function to render selected plot dynamically
// Function to render selected plot dynamically and save to localStorage
function renderSelectedPlot(testData) {
    const plotSelector = document.getElementById("plot-selector");
    const chartContainer = document.getElementById("chart-container");

    if (!plotSelector || !chartContainer) return;

    // Restore last selected plot from localStorage (or default to 'categoryDistribution')
    const lastSelectedPlot = localStorage.getItem("lastSelectedPlot") || "categoryDistribution";
    plotSelector.value = lastSelectedPlot;

    plotSelector.addEventListener("change", function () {
        const selectedPlot = this.value;

        // Save selected plot to localStorage
        localStorage.setItem("lastSelectedPlot", selectedPlot);

        // Initialize chart instance
        const chart = new Graphic("myChart");

        // Render chart based on selection
        switch (selectedPlot) {
            case "categoryDistribution":
                chart.renderCategoryDistribution(testData);
                break;
            case "passFailStackedBar":
                chart.renderPassFailStackedBar(testData);
                break;
            case "successRate":
                chart.renderSuccessRate(testData);
                break;
            case "tokensVsSimilarity":
                chart.renderTokensVsSimilarity(testData);
                break;
            default:
                chart.renderCategoryDistribution(testData);
                break;
        }
    });

    // Auto-render last saved plot
    plotSelector.dispatchEvent(new Event("change"));
}




function renderResults(files) {
    const content = document.getElementById('content');
    content.innerHTML = `<div id="progress-container"><div id="progress-bar"></div></div>`;

    if (files.length === 0) {
        content.innerHTML += `<div class="no-results">No evaluation results found.</div>`;
        return;
    }

    let htmlContent = `<h2 class="results-header">📊 Recent Evaluation Results</h2>`;

    // Sort files by date (newest first)
    files.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Group files by model name (prefix before first underscore "_")
    const groupedFiles = {};
    files.forEach(file => {
        const modelName = file.filename.split("_")[0]; // Extract model prefix
        if (!groupedFiles[modelName]) {
            groupedFiles[modelName] = [];
        }
        groupedFiles[modelName].push(file);
    });

    // Create the select dropdown
    const modelNames = Object.keys(groupedFiles);
    let savedModel = localStorage.getItem("selectedModel") || modelNames[0];
    
    htmlContent += `
        <select id="model-select">
            ${modelNames.map(model => `<option value="${model}" ${model === savedModel ? 'selected' : ''}>${model}</option>`).join('')}
        </select>`;

    htmlContent += `<div class="results-grid" id="model-results"></div><div id="result-detail" class="mt-6"></div>`;
    content.innerHTML += htmlContent;

    // Event listener for model selection
    const modelSelect = document.getElementById('model-select');
    modelSelect.addEventListener('change', (event) => {
        localStorage.setItem("selectedModel", event.target.value);
        displaySelectedModel(event.target.value, groupedFiles);
    });

    // Initial display of the selected model
    displaySelectedModel(savedModel, groupedFiles);
}

function displaySelectedModel(selectedModel, groupedFiles) {
    const modelResults = document.getElementById("model-results");
    modelResults.innerHTML = "";
    
    if (groupedFiles[selectedModel]) {
        let htmlContent = `<div class="model-section">
            <div class="results-grid">`;
        
        groupedFiles[selectedModel].forEach(file => {
            htmlContent += `
                <div class="result-card">
                    <div class="result-icon">📄</div>
                    <div class="result-info">
                        <a onclick="loadResultDetail('${file.filename}')">${file.filename}</a>
                        <div class="result-date">📅 ${relativeDate(file.created_at)}</div>
                    </div>
                </div>`;
        });

        htmlContent += `</div></div>`; // Close the section
        modelResults.innerHTML = htmlContent;
    }
}


function updateVerdict(filename, testId) {
    const newVerdict = document.getElementById(`verdict-${testId}`).value;

    fetch('/update_verdict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            filename: filename,
            test_id: testId,
            new_verdict: newVerdict
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            //alert(`✅ Verdict updated for test ID ${testId}`);
            new AlertDialog('Success', `✅ Verdict updated for test ID ${testId}`).show();

        } else {
            //alert(`❌ Error updating verdict: ${data.error}`);
            new AlertDialog('Error', `❌ Error updating verdict: ${data.error}`).show();
        }

        loadResultDetail(filename);
    })
    .catch(error => {
        console.error("Error updating verdict:", error);
    });
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
    const container = document.getElementById('result-detail');
    if (!container) return;

    let detailHtml = `<h3 class="font-bold mb-2">📋 Evaluation Results: ${filename}</h3>
        <div class="mb-4">
            <label for="plot-selector" class="text-white font-bold">Select Plot Type:</label>
            <select id="plot-selector" class="p-2 bg-gray-800 text-white rounded">
                <option value="categoryDistribution">Category Distribution</option>
                <option value="passFailStackedBar">Pass/Fail per Category</option>
                <option value="successRate">Success Rate</option>
                <option value="tokensVsSimilarity">Tokens vs. Similarity</option>
            </select>
        </div>
        <div id="chart-container" class="mb-6">
            <canvas id="myChart"></canvas>
        </div>
        <ul class="space-y-3">`;

    data.forEach(test => {
        console.log(test)
        const statusClass = test.Success === "✅ Passed" ? "text-green-400" : "text-red-500";
        // convert test.Success to a boolean if it's a string
        if(typeof test.Success !== 'boolean'){
            test.Success = test.Success === "True" || test.Success === "true" ? true : false;
        }

        detailHtml += `
            <li class="mb-2 p-3 bg-blue-900 rounded shadow-lg" id="test-${test.Test}">
                <details class="group">
                    <summary class="cursor-pointer flex justify-between items-center text-white font-semibold">
                        🔹 <strong>Test ${test.Test}:</strong> ${test.Prompt}
                        <span class="status-label ${statusClass}">${test.Success === true ? "✅ Passed" : "❌ Failed"}</span>
                    </summary>
                    <div class="ml-5 mt-2 text-gray-200 detailed-results">
                        <p><strong>Category:</strong> ${test.Category || "N/A"}</p>
                        <p><strong>Expected:</strong> ${test.Expected || "N/A"}</p>
                        <p><strong>Result:</strong> ${test.Response || "Pending..."}</p>
                        <p><strong>Similarity:</strong> ${test.Similarity ? test.Similarity.toFixed(2) : "N/A"}</p>

                        <!-- Verdict Dropdown -->
                        <p><strong>Verdict:</strong>
                            <select id="verdict-${test.Test}" class="p-2 bg-gray-700 text-white rounded"
                                onchange="updateVerdict('${filename}', ${test.Test})">
                                <option value="True" ${test.Success === true ? 'selected' : ''}>✅ Passed</option>
                                <option value="False" ${test.Success === false ? 'selected' : ''}>❌ Failed</option>
                            </select>
                        </p>
                    </div>
                </details>
            </li>`;
    });

    detailHtml += `</ul>`;
    container.innerHTML = detailHtml;

    // Initialize the plot selector and chart rendering
    renderSelectedPlot(data);
}

// ✅ Show Progress Bar

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




class AlertDialog {
    constructor(title, message) {
        this.title = title;
        this.message = message;
        this.dialog = null;
    }

    show() {
        // Remove any existing dialog before creating a new one
        this.remove();

        // Create the modal overlay
        const overlay = document.createElement("div");
        overlay.id = "alert-overlay";
        overlay.classList.add("alert-overlay");

        // Create the modal dialog
        const dialog = document.createElement("div");
        dialog.id = "alert-dialog";
        dialog.classList.add("alert-dialog");

        // Create the title
        const titleEl = document.createElement("h2");
        titleEl.innerText = this.title;
        titleEl.classList.add("alert-title");

        // Create the message
        const messageEl = document.createElement("p");
        messageEl.innerText = this.message;
        messageEl.classList.add("alert-message");

        // Create the close button
        const closeButton = document.createElement("button");
        closeButton.innerText = "OK";
        closeButton.classList.add("alert-button");

        closeButton.addEventListener("click", () => this.remove());

        // Append elements to dialog
        dialog.appendChild(titleEl);
        dialog.appendChild(messageEl);
        dialog.appendChild(closeButton);

        // Append to overlay
        overlay.appendChild(dialog);

        // Append to body
        document.body.appendChild(overlay);

        // Store reference
        this.dialog = overlay;
    }

    remove() {
        const existingDialog = document.getElementById("alert-overlay");
        if (existingDialog) {
            existingDialog.remove();
        }
    }
}
