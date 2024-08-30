import yaml
import requests
import time
from prettytable import PrettyTable

class Evaluator:
    def __init__(self, api_key, api_url, dataset_path, output_file):
        self.api_key = api_key
        self.api_url = api_url
        self.dataset_path = dataset_path
        self.output_file = output_file

    def load_dataset(self):
        with open(self.dataset_path, 'r') as file:
            return yaml.safe_load(file)

    def save_result(self, result):
        with open(self.output_file, 'a') as file:
            file.write(result + '\n')

    def evaluate_prompt(self, prompt, temperature, max_tokens, language):
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }
        data = {
            'prompt': prompt,
            'temperature': temperature,
            'max_tokens': max_tokens,
            'language': language
        }
        response = requests.post(self.api_url, json=data, headers=headers)
        return response.json()

    def run(self, wait_time):
        dataset = self.load_dataset()
        table = PrettyTable(['Prompt', 'Expected', 'Response', 'Success'])

        for entry in dataset:
            prompt = entry['prompt']
            expected = entry['expected']
            temperature = entry['temperature']
            max_tokens = entry['max_tokens']
            language = entry['language']

            # Evaluate the prompt
            response = self.evaluate_prompt(prompt, temperature, max_tokens, language)
            response_text = response.get('choices', [{}])[0].get('text', '').strip()

            # Check if the response matches the expected output
            success = response_text == expected

            # Display the result in the console
            table.add_row([prompt, expected, response_text, success])
            print(table)

            # Save the result to a file
            self.save_result(f'Prompt: {prompt}, Expected: {expected}, Response: {response_text}, Success: {success}')

            # Wait before the next prompt
            time.sleep(wait_time)
