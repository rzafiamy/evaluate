# Language Model Evaluation App

## Description
This application evaluates a large language model by executing a set of predefined prompts provided in a YAML dataset. The results are displayed in the console using a pretty table and stored in a log file continuously.

## Setup

1. Clone the repository.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```
4. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```
5. Create a `.env` file in the root directory with your API key and URL:
   ```plaintext
   API_KEY=your_api_key_here
   API_URL=https://api.yourmodel.com/v1/endpoint
   ```

## Usage

Run the evaluation script:

```bash
python manager.py --dataset path/to/your/dataset.yaml --output output.log --wait_time 2
```

- `--dataset`: Path to the YAML dataset file containing prompts.
- `--output`: Path to the file where results will be stored (default is `output.log`).
- `--wait_time`: Time in seconds to wait between each prompt (default is 2 seconds).

## Example Dataset (YAML)
```yaml
- prompt: "Translate 'Hello' to French"
  expected: "Bonjour"
  temperature: 0.5
  max_tokens: 10
  language: "en"
- prompt: "Summarize the following text..."
  expected: "Summary text..."
  temperature: 0.7
  max_tokens: 50
  language: "en"
```