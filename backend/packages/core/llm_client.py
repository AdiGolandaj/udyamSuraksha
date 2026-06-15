"""
LLM (Large Language Model) Client

Centralized LLM API client supporting Google Generative AI (Gemini) and OpenAI.
Handles API key management, model selection, and retry logic.
"""
import logging
from typing import Optional
from abc import ABC, abstractmethod

from packages.core.config import settings
from packages.core.logger import setup_logger

logger = setup_logger(__name__)


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using the LLM."""
        pass

    @abstractmethod
    def generate_sync(self, prompt: str, **kwargs) -> str:
        """Generate text using the LLM (synchronous)."""
        pass


class GoogleGeminiClient(LLMClient):
    """Google Generative AI (Gemini) client."""

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            self.client = genai.GenerativeModel(model_name)
            logger.info(f"✓ Google Generative AI initialized ({model_name})")
        except Exception as e:
            logger.error(f"Failed to initialize Google Generative AI: {e}")
            self.client = None

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using Google Gemini (async wrapper)."""
        return self.generate_sync(prompt, **kwargs)

    def generate_sync(self, prompt: str, **kwargs) -> str:
        """Generate text using Google Gemini (synchronous)."""
        if not self.client:
            raise RuntimeError("Google Generative AI client not initialized")
        
        try:
            response = self.client.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error generating content with Gemini: {e}")
            raise


class OpenAIClient(LLMClient):
    """OpenAI GPT client."""

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=api_key)
            logger.info(f"✓ OpenAI initialized ({model_name})")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI: {e}")
            self.client = None

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text using OpenAI (async wrapper)."""
        return self.generate_sync(prompt, **kwargs)

    def generate_sync(self, prompt: str, **kwargs) -> str:
        """Generate text using OpenAI (synchronous)."""
        if not self.client:
            raise RuntimeError("OpenAI client not initialized")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                **kwargs
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating content with OpenAI: {e}")
            raise


def get_llm_client() -> Optional[LLMClient]:
    """Factory function to instantiate the appropriate LLM client."""
    provider = settings.LLM_PROVIDER.lower()

    if provider == "google":
        if not settings.GOOGLE_API_KEY:
            logger.warning("GOOGLE_API_KEY not set; Gemini integration unavailable")
            return None
        return GoogleGeminiClient(settings.GOOGLE_API_KEY, settings.GOOGLE_MODEL_NAME)

    elif provider == "openai":
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not set; OpenAI integration unavailable")
            return None
        return OpenAIClient(settings.OPENAI_API_KEY, settings.OPENAI_MODEL_NAME)

    else:
        logger.error(f"Unknown LLM provider: {provider}")
        return None


# Global LLM client instance
llm_client = get_llm_client()


# Legacy interface for backward compatibility
async def call_llm(prompt: str) -> str:
    """Legacy async LLM call — delegates to global llm_client."""
    if llm_client:
        return await llm_client.generate(prompt)
    else:
        raise RuntimeError("LLM client not initialized")
