import requests
import time
import random
import string
import uuid
import csv
from prettytable import PrettyTable
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from jinja2 import Environment, FileSystemLoader
import os

previous_random = set()

class Evaluator:
    def __init__(self, config, dataset, output_folder):
        self.config = config
        self.dataset = dataset
        self.output_folder = output_folder
        self.model = SentenceTransformer(self.config.similarity_model)  # Load a pre-trained embedding model
        self.results = []  # To store results for HTML and CSV report generation

    def evaluate_prompt(self, prompt, options):
        headers = {
            'Content-Type': 'application/json'
        }

        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'

        data = {'prompt': prompt, **options}

        try:
            response = requests.post(self.config.api_url, json=data, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None
        except ValueError as e:
            print(f"JSON decode error: {e}")
            print("Full response text:")
            print(response.text)
            return None

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

    def generate_unique_random_string(self,existing_set, length=10):
        while True:
            random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=length))
            if random_string not in existing_set:
                existing_set.add(random_string)
                return random_string

    def run(self, wait_time, csv_file='report.csv', html_file='report.html', template_path='templates/result.tpl'):
        table = PrettyTable(['Test', 'Prompt', 'Category', 'Expected', 'Response', 'Similarity', 'Success'])

        for entry in self.dataset:
            test = entry['test']
            prompt = entry['prompt']
            category = entry['category']
            expected = entry['expected']
            temperature = entry['temperature']
            max_tokens = entry['max_tokens']
            language = entry['language']

            # check model
            if not self.config.options['model']:
                raise ValueError("Model must be set in the environment file.")
            
            # Evaluate the prompt
            response = self.evaluate_prompt(prompt, {
                'model': self.config.options['model'],
                'temperature': temperature,
                'max_tokens': max_tokens,
                'stream': False
            })

            response = self.format_response(self.config.provider, response)

            # Extract the response text
            response_text = response['choices'][0]['text']
            
            # Compute semantic similarity
            similarity = self.compute_similarity(expected, response_text)
            success = similarity >= float(self.config.similarity_threshold)

            # Display the result in the console
            table.add_row([test, prompt, category, expected[:10], response_text[:10], f"{similarity:.2f}", success])
            print(table)

            # Save the result in results list
            self.results.append([test, prompt, category, expected, response_text, f"{similarity:.2f}", success])

            # Wait before the next prompt
            time.sleep(wait_time)
        
        # Generate CSV and HTML reports
        self.generate_csv_report(os.path.join(self.output_folder, csv_file))
        self.generate_html_report(template_path, os.path.join(self.output_folder, html_file))

    def format_response(self, provider, response):
        """
        Format the response to match OpenAI's API response structure.

        :param provider: str, either "openai" or "ollama"
        :param response: dict, the original response from the provider
        :return: dict, formatted response in OpenAI format
        """
        if provider == "openai":
            return response  # Assume OpenAI response is already in the correct format

        elif provider == "ollama":
            return {
                "id": "cmpl-" + response.get("model", "unknown"),
                "object": "text_completion",
                "created": response.get("created_at", ""),
                "model": response.get("model", ""),
                "choices": [
                    {
                        "text": response.get("response", ""),
                        "index": 0,
                        "finish_reason": "stop" if response.get("done", False) else "incomplete"
                    }
                ],
                "usage": {
                    "prompt_tokens": response.get("prompt_eval_count", 0),
                    "completion_tokens": response.get("eval_count", 0),
                    "total_tokens": response.get("prompt_eval_count", 0) + response.get("eval_count", 0)
                }
            }
        
        else:
            raise ValueError("Unsupported provider. Use 'openai' or 'ollama'.")