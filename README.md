# 🎯 Evaluate

**Evaluate** is a Python application designed to evaluate large language models (LLMs) 🌐 through API requests based on a YAML dataset 📄. The application generates CSV and HTML reports 📊 to summarize the results. It leverages the `all-MiniLM-L6-v2` similarity model 🧠 to determine the acceptability of responses, ensuring accurate and relevant outputs. The tool is highly configurable, with API settings and other parameters securely stored 🔒 in a `.env` file to maintain privacy.

## ✨ Features

- **YAML Dataset**: Uses a simple YAML dataset to feed prompts to the LLM via API requests 📥.
- **Similarity Check**: Employs embbeding models like `all-MiniLM-L6-v2` model series to evaluate the similarity of responses to ensure they meet the expected criteria ✅. You can use other embedding models as needed based on your requirements.
- **Reports**: Generates both CSV and HTML reports 📝 to summarize the results of the evaluation.
- **PrettyTable Output**: Displays individual test results in the terminal using PrettyTable for a clear and organized view 📋.
- **Configurable**: All API configurations and extra parameters are set in a `.env` file to keep them secure and private 🔐.
- **Synthetic Datasets**: Simple datasets can be generated using tools like OpenAI to create synthetic data for evaluation purposes 🧪.
- **Dataset Splitting**: It's recommended to split datasets to ensure the best results and performance during evaluations 🧩.

## 📋 Requirements

- Python 3.7+
- [Transformers](https://huggingface.co/transformers/) 🤗
- [Sentence-Transformers](https://www.sbert.net/) 🔍
- [PrettyTable](https://pypi.org/project/prettytable/) 📊
- [PyYAML](https://pyyaml.org/) 📄
- [dotenv](https://pypi.org/project/python-dotenv/) 🔒

## 🔍 Similarity Models

Here is a list of open-source similarity models commonly used for text embeddings and semantic search:

| Model Name       | Description | Architecture | Usage |
|-----------------|-------------|-------------|-------|
| **all-MiniLM-L6-v2** | Compact transformer model optimized for semantic similarity and sentence embeddings | MiniLM | `sentence-transformers/all-MiniLM-L6-v2` |
| **bge-base-en** | BAAI General Embedding model for English with strong retrieval performance | BERT | `BAAI/bge-base-en` |
| **bge-large-en** | A larger version of `bge-base-en` for improved accuracy in retrieval tasks | BERT | `BAAI/bge-large-en` |
| **multi-qa-MiniLM-L6-cos-v1** | Optimized for question-answer retrieval, producing sentence embeddings | MiniLM | `sentence-transformers/multi-qa-MiniLM-L6-cos-v1` |
| **GTR-T5-base** | A retrieval-focused model using Google's T5 architecture | T5 | `sentence-transformers/gtr-t5-base` |
| **e5-base-v2** | An embedding model optimized for retrieval and ranking | BERT | `intfloat/e5-base-v2` |
| **mxbai-embed-large-v1** | A highly performant multilingual embedding model | Transformer | `mxbai/mxbai-embed-large-v1` |
| **paraphrase-MiniLM-L6-v2** | A paraphrase-focused model ideal for sentence similarity tasks | MiniLM | `sentence-transformers/paraphrase-MiniLM-L


## 🚀 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/rzafiamy/evaluate.git
   cd evaluate
   ```

2. Install the required packages:

   ```bash
   pip install -r requirements.txt
   ```

3. Set up your `.env` file with the necessary API configurations and other parameters:

   ```bash
   cp env.example .env
   ```

   Edit the `.env` file with your API keys 🔑 and other necessary settings.

4. Edit the environment file

   ```bash
      PROVIDER="ollama"
      API_KEY=""
      API_URL=http://localhost:11434/api/generate

      # You can use "$random" to set up random value

      LLM_OPTIONS={"model": "llama3.2:latest"}

      SIMILAIRITY_THRESHOLD="0.30"

      # Source: https://www.sbert.net/docs/sentence_transformer/pretrained_models.html#semantic-search-models
      # SIMILARITY_TYPE="BAAI"
      # SIMILARITY_MODEL="BAAI/bge-small-en-v1.5"

      SIMILARITY_TYPE="MINILM"
      SIMILARITY_MODEL="all-MiniLM-L12-v2"
   ```
   
## 🛠️ Usage

To use the `evaluate` tool, you can run the `manager.py` script with the appropriate arguments.

### Command-line Arguments

- `--dataset`: **(Required)** Path to the YAML dataset file 📄.
- `--output`: **(Optional)** Folder to save the output files 📁. Default is `output`.
- `--wait_time`: **(Optional)** Wait time between each prompt in seconds ⏳. Default is `2` seconds.

### Example

```bash
python manager.py --dataset path/to/your/dataset.yaml --output path/to/output/folder --wait_time 2
```

This command will evaluate the LLM using the provided dataset, saving the results to the specified output folder, and waiting for 2 seconds between each prompt.

## 🧪 Example Datasets

Here are some example datasets you can use:

```yaml
- prompt: "Translate 'Good morning' to Spanish."
  test: 1
  category: "translation"
  expected: "Buenos días"
  temperature: 0.3
  max_tokens: 10
  language: "en"

- prompt: "Summarize the key points of the Declaration of Independence."
  test: 2
  category: "summarization"
  expected: "The Declaration of Independence asserts the right to self-government and lists grievances against the British Crown."
  temperature: 0.5
  max_tokens: 50
  language: "en"
```

You can easily generate more complex synthetic datasets using tools like OpenAI's GPT models 🧠.

## 📂 Output

After running the evaluation, you'll find the results saved in the specified output folder as both CSV and HTML reports 📝. The individual test results will also be displayed on the screen in a table format using PrettyTable 🗒️.

![Preview](preview.png)


The accuracy of the verdict depends on the similarity model chosen and the threshold value specified in the configuration file. These two factors significantly influence whether the verdict is correct or not.

## 💡 Best Practices

- **Dataset Splitting**: Always split your dataset into training and testing subsets to ensure that your model is evaluated on data it hasn't seen before 🔄.
- **Synthetic Data**: Utilize synthetic datasets generated by models like GPT to test a wide range of scenarios 🌐.

## 📜 License

This project is licensed under the MIT License 📄. See the [LICENSE](LICENSE) file for more details.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes 🛠️.

## 📬 Contact

For any questions or suggestions, please open an issue on the GitHub repository or contact me directly at [rzafiamy@yahoo.fr](mailto:rzafiamy@yahoo.fr) ✉️.