import requests
import time
import random
import string
import uuid
import csv
from prettytable import PrettyTable
from .similarity import SentenceTransformerBgeModel, SentenceTransformerModel
from jinja2 import Environment, FileSystemLoader
import os

previous_random = set()

class Evaluator:
    def __init__(self, config, dataset, output_folder):
        self.config = config
        self.dataset = dataset
        self.output_folder = output_folder
        
        if self.config.similarity_type == 'BAAI':
            self.model = SentenceTransformerBgeModel(self.config.similarity_model)
        else:
            self.model = SentenceTransformerModel(self.config.similarity_model)

        self.results = []  # To store results for HTML and CSV report generation

    def evaluate_prompt(self, provider, prompt, model, options=None):
        headers = {'Content-Type': 'application/json'}
        data = {}
        
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
        
        if provider == "openai":
            data = {
                'model': model,
                'messages': [{'role': 'user', 'content': prompt}],
                'stream': False
            }
            if options:
                data.update(options)  # Add additional OpenAI-specific options
        
        elif provider == "ollama":
            data = {
                'prompt': prompt,
                'model': model,
                'stream': False,
                'options': options if options else {}  # Ensure options is properly embedded
            }
        
        else:
            print(f"Unsupported provider: {provider}")
            return None
        
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
        """
        Compute similarity using a pre-trained SentenceTransformer model.

        - Ensures inputs are lists (batch format)
        - Handles potential empty or None inputs
        """
        if not expected or not response_text:
            print("Warning: One of the inputs to compute_similarity is empty.")
            return 0.0  # Return a minimal similarity score

        # Ensure expected and response_text are non-empty lists
        expected = [expected] if isinstance(expected, str) else expected
        response_text = [response_text] if isinstance(response_text, str) else response_text

        try:
            expected_embedding = self.model.encode(expected)
            response_embedding = self.model.encode(response_text)

            return self.model.compute_similarity(expected_embedding, response_embedding)
        except IndexError as e:
            print(f"IndexError in sentence_transformers: {e}")
            return 0.0  # Fallback similarity score in case of failure


    def generate_csv_report(self, csv_file):
        """Generate a CSV report from the results using tab as the separator, ensuring multiline fields are properly quoted."""
        with open(csv_file, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file, delimiter='\t', quoting=csv.QUOTE_ALL, quotechar='"', escapechar='\\')
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
            response = self.evaluate_prompt(self.config.provider, prompt, self.config.options['model'],  {
                'temperature': temperature,
                'max_tokens': max_tokens
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
            if response.get("choices") and len(response["choices"]) > 0:
                if not response["choices"][0].get("text") and response["choices"][0]["message"] and response["choices"][0]["message"].get("content"):
                    response["choices"][0]["text"] = response["choices"][0]["message"]["content"]        
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