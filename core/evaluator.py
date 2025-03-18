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
import json
import numpy as np  # Ensure NumPy is imported

previous_random = set()

class Evaluator:
    def __init__(self, config, system, dataset, output_folder):
        self.system = system
        self.config = config
        self.dataset = dataset
        self.output_folder = output_folder
        
        if self.config.similarity_type == 'BAAI':
            self.model = SentenceTransformerBgeModel(self.config.similarity_model)
        else:
            self.model = SentenceTransformerModel(self.config.similarity_model)

        self.results = []  # To store results for HTML and CSV report generation

    def get_models(self):
        """Fetch the list of available models from the API endpoint."""
        headers = {'Content-Type': 'application/json'}
        
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'

        try:
            response = requests.get(f"{self.config.api_url}/v1/models", headers=headers)
            response.raise_for_status()  # Raise an error for non-200 responses
            
            models = response.json()
            
            if isinstance(models, dict) and 'models' in models:
                return models['models']  # Ensure we're returning only the list
            
            return models  # Fallback if API structure differs
        
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None
        except ValueError as e:
            print(f"JSON decode error: {e}")
            print("Full response text:")
            print(response.text)
            return None

    def evaluate_prompt(self, provider, prompt, model, options=None):
        headers = {'Content-Type': 'application/json'}
        data = {}
        
        if self.config.api_key:
            headers['Authorization'] = f'Bearer {self.config.api_key}'
        
        if provider == "openai":
            system = self.system+'\n\n'+self.config.SYSTEM_PROMPT if self.system else self.config.SYSTEM_PROMPT

            data = {
                'model': model,
                'messages': [{'role':'system', 'content': system},{'role': 'user', 'content': prompt}],
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
            response = requests.post(f"{self.config.api_url}/v1/chat/completions", json=data, headers=headers)
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

    def compute_similarity(self, context, expected, response_text):
        """
        Compute similarity using a pre-trained SentenceTransformer model.

        - Ensures inputs are lists (batch format)
        - Handles potential empty or None inputs
        """
        if not context and not expected or not response_text:
            print("Warning: One of the inputs to compute_similarity is empty.")
            return 0.0  # Return a minimal similarity score

        # Tested to add context but it is not good for similarity
        # expected = context+'\n'+expected
        # response_text = context+'\n'+response_text

        # Ensure expected and response_text are non-empty lists
        expected = [expected] if isinstance(expected, str) else expected
        response_text = [response_text] if isinstance(response_text, str) else response_text

        try:
            expected_embedding = self.model.encode(expected)
            response_embedding = self.model.encode(response_text)

            return self.model.compute_similarity(response_embedding, expected_embedding)
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

    def run_stream(self, wait_time, csv_file='report.csv', html_file='report.html', 
        template_path='templates/result.tpl', model=None):
        """Runs evaluation in streaming mode, yielding real-time updates."""
        total_tests = len(self.dataset)

        for index, entry in enumerate(self.dataset, start=1):
            # Extract test metadata
            test_id = entry.get('test', f"Unknown-{index}")
            prompt = entry.get('prompt', '')
            category = entry.get('category', 'N/A')
            expected = entry.get('expected', '')
            temperature = entry.get('temperature', 0.7)
            max_tokens = entry.get('max_tokens', 256)
            language = entry.get('language', 'en')

            m = model if model is not None else self.config.options.get('model')

            if not m:
                yield json.dumps({
                    "status": "error", 
                    "test": test_id, 
                    "message": "Model must be set in the environment file."
                })
                return

            yield json.dumps({
                "status": "running",
                "test": test_id,
                "message": f"Test {index}/{total_tests} is running...",
                "prompt": prompt,
                "category": category,
                "expected": expected,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "result": "N/A",
                "language": language
            })

            try:
                # Simulate model evaluation delay
                time.sleep(wait_time)

                # Evaluate the prompt
                response = self.evaluate_prompt(self.config.provider, prompt, m,  {
                    'temperature': temperature,
                    'max_tokens': max_tokens
                })

                response = self.format_response(self.config.provider, response)

                # Extract the response text
                response_text = response['choices'][0]['text']

                # Compute semantic similarity
                similarity = self.compute_similarity(prompt, expected, response_text)

                # ✅ Convert numpy.float32 to standard Python float
                similarity = float(similarity)

                success = similarity >= float(self.config.similarity_threshold)

                # Store result for final report
                self.results.append([
                    test_id, prompt, category, expected, response_text, f"{similarity:.2f}", success
                ])

                yield json.dumps({
                    "status": "completed",
                    "test": test_id,
                    "message": f"Test {index}/{total_tests} completed",
                    "prompt": prompt,
                    "category": category,
                    "expected": expected,
                    "result": response_text,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "language": language,
                    "similarity": similarity,
                    "success": success
                })

            except Exception as e:
                error_message = f"Error in test {test_id}: {str(e)}"
                print(error_message)  # Log for debugging
                yield json.dumps({
                    "status": "error",
                    "test": test_id,
                    "message": error_message,
                    "prompt": prompt,
                    "category": category,
                    "expected": expected,
                    "temperature": temperature,
                    "result": "N/A",
                    "max_tokens": max_tokens,
                    "language": language
                })

        # Generate final reports
        self.generate_csv_report(os.path.join(self.output_folder, csv_file))
        self.generate_html_report(template_path, os.path.join(self.output_folder, html_file))

        yield json.dumps({"status": "completed", "message": "Evaluation finished!"})

    def run(self, wait_time, csv_file='report.csv', html_file='report.html', template_path='templates/result.tpl', model=None):
        table = PrettyTable(['Test', 'Prompt', 'Category', 'Expected', 'Response', 'Similarity', 'Success'])

        for entry in self.dataset:
            test = entry['test']
            prompt = entry['prompt']
            category = entry['category']
            expected = entry['expected']
            temperature = entry['temperature']
            max_tokens = entry['max_tokens']
            language = entry['language']
            
            m = model if model is not None else self.config.options['model']

            # check model
            if not m:
                raise ValueError("Model must be set in the environment file.")
            
            # Evaluate the prompt
            response = self.evaluate_prompt(self.config.provider, prompt, m,  {
                'temperature': temperature,
                'max_tokens': max_tokens
            })

            response = self.format_response(self.config.provider, response)

            # Extract the response text
            response_text = response['choices'][0]['text']
            
            # Compute semantic similarity
            similarity = self.compute_similarity(prompt, expected, response_text)
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