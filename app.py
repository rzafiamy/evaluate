import os
import yaml
from flask import Flask, request, render_template, redirect, url_for, send_from_directory, jsonify
from werkzeug.utils import secure_filename
from core.evaluator import Evaluator
from core.dataset_loader import DatasetLoader
from config import Config
import pandas as pd
import re

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
        evaluator = Evaluator(config, [], OUTPUT_FOLDER)
        models = evaluator.get_models()  # Fetch available models
        return jsonify(models["data"])
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve models: {str(e)}"}), 500

@app.route('/evaluate', methods=['POST'])
def evaluate():
    dataset_file = request.files['dataset']
    wait_time = int(request.form.get('wait_time', 2))
    model = request.form.get('model')  # Get the selected model

    if dataset_file:
        # Sanitize model name
        safe_model_name = sanitize_filename(model)

        filename = secure_filename(dataset_file.filename)
        dataset_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        dataset_file.save(dataset_path)

        loader = DatasetLoader(dataset_path)
        dataset = loader.load()
        config = Config()

        evaluator = Evaluator(config, dataset, OUTPUT_FOLDER)
        
        filebase = os.path.splitext(filename)[0]
        csv_file = f"{safe_model_name}_{filebase}.csv"
        html_file = f"{safe_model_name}_{filebase}.html"

        evaluator.run(wait_time, csv_file=csv_file, html_file=html_file,model=model)

        return redirect(url_for('results', filename_html=html_file, filename_csv=csv_file))

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
    preview = [{
        'test': item.get('test'),
        'prompt': item.get('prompt'),
        'expected': item.get('expected'),
        'category': item.get('category'),
        'language': item.get('language')
    } for item in dataset]

    return jsonify(preview)

@app.route('/load_results', methods=['GET'])
def load_results():
    files = [f for f in os.listdir(OUTPUT_FOLDER) if f.endswith('.csv')]
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

if __name__ == '__main__':
    app.run(debug=True)