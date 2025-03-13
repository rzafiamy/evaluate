import os
import yaml
from flask import Flask, request, render_template, redirect, url_for, send_from_directory, jsonify
from werkzeug.utils import secure_filename
from core.evaluator import Evaluator
from core.dataset_loader import DatasetLoader
from config import Config
import pandas as pd

UPLOAD_FOLDER = './uploads'
OUTPUT_FOLDER = './output'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/', methods=['GET', 'POST'])
def index():
    return render_template('index.html')

@app.route('/evaluate', methods=['POST'])
def evaluate():
    dataset_file = request.files['dataset']
    wait_time = int(request.form.get('wait_time', 2))

    if dataset_file:
        filename = secure_filename(dataset_file.filename)
        dataset_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        dataset_file.save(dataset_path)

        loader = DatasetLoader(dataset_path)
        dataset = loader.load()
        config = Config()

        evaluator = Evaluator(config, dataset, OUTPUT_FOLDER)
        
        filebase = os.path.splitext(filename)[0]
        csv_file = f"{filebase}.csv"
        html_file = f"{filebase}.html"

        evaluator.run(wait_time, csv_file=csv_file, html_file=html_file)

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