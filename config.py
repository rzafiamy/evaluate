from dotenv import load_dotenv
import os
import json

class Config:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('API_KEY')
        self.api_url = os.getenv('API_URL')
        self.options = self._load_options(os.getenv('LLM_OPTIONS'))

        if not self.api_key or not self.api_url:
            raise ValueError("API_KEY and API_URL must be set in the environment file.")

    def _load_options(self, options_str):
        try:
            return json.loads(options_str)
        except json.JSONDecodeError:
            raise ValueError("OPTIONS in .env file must be a valid JSON string.")