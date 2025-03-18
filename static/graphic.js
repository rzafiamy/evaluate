class Graphic {
    constructor(canvasId) {
        this.canvasId = canvasId;
    }

    // Fetch CSS Root Variables
    getCSSVariable(variable) {
        return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    }

    // Helper function to clear previous chart before rendering
    clearCanvas() {
        const canvas = document.getElementById(this.canvasId);
        if (canvas) {
            canvas.remove();
        }
        const parent = document.getElementById("chart-container");
        const newCanvas = document.createElement("canvas");
        newCanvas.id = this.canvasId;
        parent.appendChild(newCanvas);
    }

    // 📊 Bar Chart - Test Category Distribution
    renderCategoryDistribution(data) {
        this.clearCanvas();
        
        const ctx = document.getElementById(this.canvasId).getContext("2d");
        const categoryCounts = data.reduce((acc, item) => {
            acc[item.Category] = (acc[item.Category] || 0) + 1;
            return acc;
        }, {});

        new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(categoryCounts),
                datasets: [{
                    label: "Number of Tests",
                    data: Object.values(categoryCounts),
                    backgroundColor: this.getCSSVariable("--secondary-blue"),
                    borderColor: this.getCSSVariable("--secondary-blue-border"),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: "Distribution of Test Categories", font: { size: 16 } }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // 📊 Stacked Bar Chart - Success vs. Failure per Category
    renderPassFailStackedBar(data) {
        this.clearCanvas();

        const ctx = document.getElementById(this.canvasId).getContext("2d");
        const groupedData = data.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.Category] = { passed: 0, failed: 0 };
            if (item.Success) acc[item.Category].passed += 1;
            else acc[item.Category].failed += 1;
            return acc;
        }, {});

        new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(groupedData),
                datasets: [
                    {
                        label: "Passed",
                        data: Object.values(groupedData).map(v => v.passed),
                        backgroundColor: this.getCSSVariable("--success-green")
                    },
                    {
                        label: "Failed",
                        data: Object.values(groupedData).map(v => v.failed),
                        backgroundColor: this.getCSSVariable("--fail-red")
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: "Test Results (Passed vs. Failed) per Category", font: { size: 16 } }
                },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 📊 Pie Chart - Success Rate
    renderSuccessRate(data) {
        this.clearCanvas();

        const ctx = document.getElementById(this.canvasId).getContext("2d");
        const passed = data.filter(item => item.Success).length;
        const failed = data.length - passed;

        new Chart(ctx, {
            type: "pie",
            data: {
                labels: ["Passed", "Failed"],
                datasets: [{
                    data: [passed, failed],
                    backgroundColor: [
                        this.getCSSVariable("--success-green"),
                        this.getCSSVariable("--fail-red")
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: "Overall Test Success Rate", font: { size: 16 } }
                }
            }
        });
    }

    // 📊 Scatter Plot - Max Tokens vs. Similarity Score
    renderTokensVsSimilarity(data) {
        this.clearCanvas();

        const ctx = document.getElementById(this.canvasId).getContext("2d");
        const scatterData = data.map(item => ({
            x: item.max_tokens || 0,
            y: item.similarity || 0
        }));

        new Chart(ctx, {
            type: "scatter",
            data: {
                datasets: [{
                    label: "Tokens vs. Similarity",
                    data: scatterData,
                    backgroundColor: this.getCSSVariable("--secondary-blue")
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: "Tokens Used vs. Similarity Score", font: { size: 16 } }
                },
                scales: {
                    x: { type: "linear", position: "bottom", title: { display: true, text: "Max Tokens" } },
                    y: { title: { display: true, text: "Similarity Score" } }
                }
            }
        });
    }
}
