from dotenv import load_dotenv
import os

class Config:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv('API_KEY')
        self.api_url = os.getenv('API_URL')

        if not self.api_key or not self.api_url:
            raise ValueError("API_KEY and API_URL must be set in the environment file.")