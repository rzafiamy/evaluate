from dotenv import load_dotenv
import os
import json

class Config:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('API_KEY')
        self.api_url = os.getenv('API_URL')
        self.provider = os.getenv('PROVIDER')
        self.similarity_type = os.getenv('SIMILARITY_TYPE') if os.getenv('SIMILARITY_TYPE') else "MINILM"
        self.similarity_model = os.getenv('SIMILARITY_MODEL') if os.getenv('SIMILARITY_MODEL') else "all-mpnet-base-v2"
        self.similarity_threshold = os.getenv('SIMILARITY_THRESHOLD') if os.getenv('SIMILARITY_THRESHOLD') else 0.30
        
        self.options = self._load_options(os.getenv('LLM_OPTIONS'))

        self.SYSTEM_PROMPT = "You are an AI assistant. Please respond to the user's question directly without extra comments."

        if not self.api_url:
            raise ValueError("API_URL must be set in the environment file.")

    def _load_options(self, options_str):
        try:
            return json.loads(options_str)
        except json.JSONDecodeError:
            raise ValueError("OPTIONS in .env file must be a valid JSON string.")