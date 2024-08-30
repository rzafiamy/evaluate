import argparse
import time
from core.evaluator import Evaluator
from config import Config
from core.dataset_loader import DatasetLoader
import os

def main():
    # Parsing command-line arguments
    parser = argparse.ArgumentParser(description="Evaluate a large language model with predefined prompts.")
    parser.add_argument("--dataset", required=True, help="Path to the YAML dataset file.")
    parser.add_argument("--output", default="output", help="Folder to save the output files.")
    parser.add_argument("--wait_time", type=int, default=2, help="Wait time between each prompt in seconds.")
    args = parser.parse_args()

    # Load configuration
    config = Config()

    # Load dataset
    loader = DatasetLoader(args.dataset)
    dataset = loader.load()

    # check if the output folder exists
    if not os.path.exists(args.output):
        print(f"Folder {args.output} does not exist !" )
        exit(1)
    
    # Create an evaluator instance
    evaluator = Evaluator(config, dataset, args.output)

    # Execute evaluation
    evaluator.run(args.wait_time)

if __name__ == "__main__":
    main()
