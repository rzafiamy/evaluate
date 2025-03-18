from abc import ABC, abstractmethod
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

class SimilarityModel(ABC):
    """
    Abstract base class for similarity models.
    """
    @abstractmethod
    def encode(self, text):
        pass
    
    @abstractmethod
    def compute_similarity(self, expected_embedding, response_embedding):
        pass

class SentenceTransformerModel(SimilarityModel):
    """
    A similarity model using SentenceTransformer embeddings.
    """
    def __init__(self, model_name: str):
        """Initialize the SentenceTransformer model."""
        self.model = SentenceTransformer(model_name)
    
    def encode(self, text):
        """Generate embeddings for the input text."""
        return self.model.encode(text)
    
    def compute_similarity(self, response_embedding, expected_embedding):
        """Compute cosine similarity between expected and response embeddings."""
        return cosine_similarity(expected_embedding, response_embedding)[0][0]


class SentenceTransformerBgeModel:
    """
    A similarity model using SentenceTransformer embeddings.
    """
    def __init__(self, model_name: str):
        """Initialize the SentenceTransformer model with a given model name."""
        self.model = SentenceTransformer(model_name)

    def encode(self, texts, normalize=True):
        """Generate normalized embeddings for the input texts."""
        return self.model.encode(texts, normalize_embeddings=normalize)

    def compute_similarity(self, query_embeddings, passage_embeddings):
        """Compute similarity using dot product."""
        return float(query_embeddings @ passage_embeddings.T)  # Matrix multiplication for similarity
