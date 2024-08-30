import yaml

class DatasetLoader:
    def __init__(self, dataset_path):
        self.dataset_path = dataset_path

    def load(self):
        with open(self.dataset_path, 'r') as file:
            data = yaml.safe_load(file)
            self._validate(data)
            return data

    def _validate(self, data):
        required_keys = {'prompt', 'category','expected', 'temperature', 'max_tokens', 'language'}
        for entry in data:
            if not required_keys.issubset(entry):
                missing = required_keys - entry.keys()
                raise ValueError(f"Missing keys in dataset entry: {missing}")