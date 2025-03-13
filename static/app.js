function loadPage(page) {
    const content = document.getElementById('content');
    if (page === 'evaluate') {
        content.innerHTML = `
            <h2>Evaluate LLM</h2>
            <form action="/evaluate" method="POST" enctype="multipart/form-data">
                <input type="file" name="dataset" required>
                <input type="number" name="wait_time" placeholder="Wait Time (seconds)" value="2">
                <button type="submit">Evaluate</button>
            </form>`;
    } else if (page === 'results') {
        content.innerHTML = `
            <h2>Recent Results</h2>
            <p>Your results will appear here after evaluation.</p>`;
    }
}
