class Graphic {
    constructor(canvasId) {
        this.canvasId = canvasId;
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
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {});

        new Chart(ctx, {
            type: "bar",
            data: {
                labels: Object.keys(categoryCounts),
                datasets: [{
                    label: "Number of Tests",
                    data: Object.values(categoryCounts),
                    backgroundColor: "rgba(54, 162, 235, 0.7)",
                    borderColor: "rgba(54, 162, 235, 1)",
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
            if (!acc[item.category]) acc[item.category] = { passed: 0, failed: 0 };
            if (item.success) acc[item.category].passed += 1;
            else acc[item.category].failed += 1;
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
                        backgroundColor: "rgba(75, 192, 75, 0.7)"
                    },
                    {
                        label: "Failed",
                        data: Object.values(groupedData).map(v => v.failed),
                        backgroundColor: "rgba(255, 99, 132, 0.7)"
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
        const passed = data.filter(item => item.success).length;
        const failed = data.length - passed;

        new Chart(ctx, {
            type: "pie",
            data: {
                labels: ["Passed", "Failed"],
                datasets: [{
                    data: [passed, failed],
                    backgroundColor: ["rgba(75, 192, 192, 0.7)", "rgba(255, 99, 132, 0.7)"]
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
                    backgroundColor: "rgba(54, 162, 235, 0.7)"
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
