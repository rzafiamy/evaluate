import requests
import time
import csv
from prettytable import PrettyTable
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from jinja2 import Environment, FileSystemLoader
import os

class Evaluator:
    def __init__(self, config, dataset, output_folder):
        self.config = config
        self.dataset = dataset
        self.output_folder = output_folder
        self.model = SentenceTransformer('all-MiniLM-L6-v2')  # Load a pre-trained embedding model
        self.results = []  # To store results for HTML and CSV report generation

    def evaluate_prompt(self, prompt, options):
        headers = {
            'Authorization': f'{self.config.api_key}',
            'Content-Type': 'application/json'
        }

        data = {'prompt': prompt, **options}

        response = requests.post(self.config.api_url, json=data, headers=headers)
        return response.json()

    def compute_similarity(self, expected, response_text):
        # Convert texts to embeddings
        expected_embedding = self.model.encode([expected])
        response_embedding = self.model.encode([response_text])

        # Compute cosine similarity
        similarity = cosine_similarity(expected_embedding, response_embedding)[0][0]
        return similarity

    def generate_csv_report(self, csv_file):
        """Generate a CSV report from the results."""
        with open(csv_file, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['Test', 'Prompt', 'Category', 'Expected', 'Response', 'Similarity', 'Success'])
            for result in self.results:
                writer.writerow(result)

    def generate_html_report(self, template_path, html_file):
        """Generate an HTML report using a template file."""
        env = Environment(loader=FileSystemLoader('.'))
        template = env.get_template(template_path)
        html_content = template.render(results=self.results)
        with open(html_file, 'w', encoding='utf-8') as file:
            file.write(html_content)

    def run(self, wait_time, similarity_threshold=0.75, csv_file='report.csv', html_file='report.html', template_path='templates/result.tpl'):
        table = PrettyTable(['Test', 'Prompt', 'Category', 'Expected', 'Response', 'Similarity', 'Success'])

        for entry in self.dataset:
            test = entry['test']
            prompt = entry['prompt']
            category = entry['category']
            expected = entry['expected']
            temperature = entry['temperature']
            max_tokens = entry['max_tokens']
            language = entry['language']

            # If there are predefined options in environment variables, use them
            extra_options = {}
            if self.config.options:
                extra_options = self.config.options

            # Evaluate the prompt
            response = self.evaluate_prompt(prompt, {
                'temperature': temperature,
                'category': category,
                'max_tokens': max_tokens,
                'language': language,
                **extra_options
            })

            # Extract the response text
            response_text = response['choices'][0]['message']['content']
            
            # Compute semantic similarity
            similarity = self.compute_similarity(expected, response_text)
            success = similarity >= similarity_threshold

            # Display the result in the console
            table.add_row([test, prompt, category, expected[:50], response_text[:50], f"{similarity:.2f}", success])
            print(table)

            # Save the result in results list
            self.results.append([test, prompt, category, expected, response_text, f"{similarity:.2f}", success])

            # Wait before the next prompt
            time.sleep(wait_time)
        
        # Generate CSV and HTML reports
        self.generate_csv_report(os.path.join(self.output_folder, csv_file))
        self.generate_html_report(template_path, os.path.join(self.output_folder, html_file))
