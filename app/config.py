from functools import lru_cache
from os import getenv

from dotenv import load_dotenv

load_dotenv()


class Settings:
    database_url: str = getenv("DATABASE_URL", "sqlite:///./reddit_tracker.db")
    serper_api_key: str = getenv("SERPER_API_KEY", "")
    default_brand: str = getenv("DEFAULT_BRAND", "Example Brand")
    alert_webhook_url: str = getenv("ALERT_WEBHOOK_URL", "")
    alert_secret: str = getenv("ALERT_SECRET", "change-this-secret")


@lru_cache
def get_settings() -> Settings:
    return Settings()
