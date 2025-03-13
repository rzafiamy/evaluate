import os
from flask import Flask, request, render_template, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from core.evaluator import Evaluator
from core.dataset_loader import DatasetLoader
from config import Config

UPLOAD_FOLDER = './uploads'
OUTPUT_FOLDER = './output'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
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

    return render_template('index.html')

@app.route('/results')
def results():
    filename_html = request.args.get('filename_html')
    filename_csv = request.args.get('filename_csv')
    return render_template('results.html', filename_html=filename_html, filename_csv=filename_csv)

@app.route('/output/<path:filename>')
def download_file(filename):
    return send_from_directory(OUTPUT_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True)
