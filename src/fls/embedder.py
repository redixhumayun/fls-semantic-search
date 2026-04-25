from typing import cast

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"


class Embedder:
    """CLIP-based text and image embedder.

    Loads the model once on construction and reuses it for all embed calls.
    Embeddings are L2-normalised so dot product equals cosine similarity.
    """

    def __init__(self) -> None:
        print(f"Loading {CLIP_MODEL_NAME} (first run downloads ~350 MB)...")
        self._model = cast(CLIPModel, CLIPModel.from_pretrained(CLIP_MODEL_NAME))
        self._processor = cast(CLIPProcessor, CLIPProcessor.from_pretrained(CLIP_MODEL_NAME))
        self._model.eval()

    def embed_text(self, text: str) -> list[float]:
        """Return a normalised 512-d embedding for the given text string.

        Args:
            text: Input text to embed.

        Returns:
            List of 512 floats.
        """
        inputs = self._processor(text=[text], return_tensors="pt", padding=True)
        with torch.no_grad():
            # transformers 5.x returns BaseModelOutputWithPooling; pooler_output is the projected embedding
            features = self._model.get_text_features(**inputs).pooler_output
            features = features / features.norm(dim=-1, keepdim=True)
        return features[0].tolist()

    def embed_image(self, image: Image.Image) -> list[float]:
        """Return a normalised 512-d embedding for the given PIL image.

        Args:
            image: Input image to embed.

        Returns:
            List of 512 floats.
        """
        inputs = self._processor(images=image, return_tensors="pt")
        with torch.no_grad():
            features = self._model.get_image_features(**inputs).pooler_output
            features = features / features.norm(dim=-1, keepdim=True)
        return features[0].tolist()
