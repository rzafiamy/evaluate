import os
import yaml
from flask import Flask, request, render_template, redirect, url_for, send_from_directory, jsonify, stream_with_context, Response
from werkzeug.utils import secure_filename
from core.evaluator import Evaluator
from core.dataset_loader import DatasetLoader
from config import Config
import pandas as pd
import re
import json
import time
import sys

UPLOAD_FOLDER = './uploads'
OUTPUT_FOLDER = './output'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def sanitize_filename(name):
    """Remove non-ASCII characters and special symbols from model name."""
    name = name.lower()  # Convert to lowercase
    name = re.sub(r'[^a-z0-9_-]', '', name)  # Keep only letters, numbers, `_`, and `-`
    return name

@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')

@app.route('/load_dataset', methods=['POST'])
def load_dataset():
    """Load a YAML dataset file and return its JSON representation."""
    if 'dataset' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    dataset_file = request.files['dataset']

    if dataset_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Secure the filename
    filename = secure_filename(dataset_file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    dataset_file.save(file_path)

    try:
        # Read and parse YAML file
        with open(file_path, 'r', encoding='utf-8') as file:
            dataset_content = yaml.safe_load(file)

        #tests = dataset_content['tests']
        
        return jsonify(dataset_content)  # Return JSON format

    except yaml.YAMLError as e:
        return jsonify({"error": f"Invalid YAML format: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Error processing file: {str(e)}"}), 500

@app.route('/models', methods=['GET'])
def get_models():
    """API endpoint to return a list of available models."""
    try:
        config = Config()
        evaluator = Evaluator(config, "", [], OUTPUT_FOLDER)
        models = evaluator.get_models()  # Fetch available models
        return jsonify(models["data"])
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve models: {str(e)}"}), 500

@app.route('/evaluate', methods=['POST'])
def evaluate():
    dataset_file = request.files.get('dataset')
    wait_time = int(request.form.get('wait_time', 2))
    model = request.form.get('model')

    if not model:
        return "Error: Model not selected", 400

    if not dataset_file:
        return "Error: No dataset uploaded", 400

    safe_model_name = sanitize_filename(model)
    filename = secure_filename(dataset_file.filename)
    dataset_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    dataset_file.save(dataset_path)

    loader = DatasetLoader(dataset_path)
    dataset = loader.load()
    tests = dataset["tests"]
    system = dataset["system_prompt"]

    config = Config()

    evaluator = Evaluator(config, system, tests, OUTPUT_FOLDER)

    filebase = os.path.splitext(filename)[0]
    csv_file = f"{safe_model_name}_{filebase}.csv"
    html_file = f"{safe_model_name}_{filebase}.html"

    def generate():
        """Generator function to stream responses in real-time."""
        yield f"data: {json.dumps({'status': 'started', 'message': 'Evaluation started'})}\n\n"
        sys.stdout.flush()  # Force flush output

        for progress in evaluator.run_stream(wait_time, csv_file=csv_file, html_file=html_file, model=model):
            yield f"data: {json.dumps(progress)}\n\n"
            sys.stdout.flush()  # Force flush output
            time.sleep(0.1)  # Give time for updates

        yield f"data: {json.dumps({'status': 'completed', 'message': 'Evaluation complete!'})}\n\n"
        sys.stdout.flush()  # Ensure final flush

    return Response(stream_with_context(generate()), content_type='text/event-stream')

@app.route('/results')
def results():
    filename_html = request.args.get('filename_html')
    filename_csv = request.args.get('filename_csv')
    return render_template('results.html', filename_html=filename_html, filename_csv=filename_csv)

@app.route('/output/<path:filename>')
def download_file(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)

@app.route('/preview_dataset', methods=['POST'])
def preview_dataset():
    dataset_yaml = request.data.decode('utf-8')
    dataset = yaml.safe_load(dataset_yaml)
    tests = dataset["tests"]
    system = dataset["system_prompt"]

    preview = [{
        'test': item.get('test'),
        'prompt': item.get('prompt'),
        'expected': item.get('expected'),
        'category': item.get('category'),
        'language': item.get('language')
    } for item in tests]

    return jsonify(preview)

@app.route('/load_results', methods=['GET'])
def load_results():
    files = [
        {
            "filename": f,
            "created_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getctime(os.path.join(OUTPUT_FOLDER, f))))
        }
        for f in os.listdir(OUTPUT_FOLDER) if f.endswith('.csv')
    ]

    # Sort files by creation date (newest first)
    files.sort(key=lambda x: x["created_at"], reverse=True)

    return jsonify(files=files)

@app.route('/result_content/<path:filename>')
def result_content(filename):
    import pandas as pd
    filepath = os.path.join(OUTPUT_FOLDER, filename)
    if os.path.exists(filepath := os.path.abspath(filepath)):
        df = pd.read_csv(filepath, sep='\t')  # Specify tab as the separator
        return jsonify(df.to_dict(orient='records'))
    else:
        return jsonify({'error': 'File not found'}), 404


@app.route('/update_verdict', methods=['POST'])
def update_verdict():
    """
    Update the verdict of a specific test in the results CSV file.
    Expects JSON payload with:
    - filename: The CSV file name
    - test_id: The test ID to update
    - new_verdict: The updated verdict
    """
    try:
        data = request.get_json()

        filename = data.get('filename')
        test_id = data.get('test_id')
        new_verdict = data.get('new_verdict')

        if not filename or not test_id or new_verdict is None:
            return jsonify({'error': 'Missing filename, test_id, or new_verdict'}), 400

        filepath = os.path.join(OUTPUT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({'error': 'CSV file not found'}), 404

        # Load the CSV file
        df = pd.read_csv(filepath, sep='\t')

        # Ensure the test ID exists
        if 'Test' not in df.columns:
            return jsonify({'error': 'Invalid CSV format: missing "test" column'}), 500

        # Find the test entry
        test_index = df[df['Test'] == test_id].index
        if test_index.empty:
            return jsonify({'error': 'Test ID not found'}), 404

        # Update the verdict
        df.at[test_index[0], 'Success'] = new_verdict

        # Save back to the CSV file
        df.to_csv(filepath, sep='\t', index=False)

        return jsonify({'success': True, 'message': f'Verdict updated for test ID {test_id}'})

    except Exception as e:
        return jsonify({'error': f'Failed to update verdict: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True)