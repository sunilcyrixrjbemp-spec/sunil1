import os
from pydantic_settings import BaseSettings
from typing import Optional, List

# Pre-load Render Secret Files into os.environ so pydantic_settings can read them.
# Render stores Secret Files at /etc/secrets/<FILENAME>
_SECRET_DIRS = ["/etc/secrets", "/app"]
_KV_KEYS = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_DATABASE_ID",
    "CLOUDFLARE_KV_NAMESPACE_ID",
    "FORCE_LOCAL_DB",
    "SECRET_KEY",
]
for _key in _KV_KEYS:
    if not os.environ.get(_key):
        for _secret_dir in _SECRET_DIRS:
            _path = os.path.join(_secret_dir, _key)
            if os.path.exists(_path):
                try:
                    with open(_path, "r") as _f:
                        os.environ[_key] = _f.read().strip()
                    break
                except Exception:
                    pass

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./test.db"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 Days in minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 365     # 1 Year in days
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    API_TITLE: str = "Field Operations API"
    API_VERSION: str = "1.0.0"
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 2 * 1024 * 1024
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "pdf"]
    EMAIL_FROM: str = "noreply@fieldops.com"
    SMTP_SERVER: Optional[str] = None
    SMTP_PORT: Optional[int] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    PAGE_SIZE: int = 20
    
    # New Login Security Settings
    GAS_WEB_APP_URL: str = "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec"
    GAS_WEB_APP_URL_2: str = "https://script.google.com/macros/s/AKfycbwxh5LQLCGtwGflfF7V5HKyL7viFNlAkAbsgz5xEDQo8Eg_f1kw47EjxrzSAC891sm1/exec"
    MAX_FAILED_ATTEMPTS: int = 5
    OTP_EXPIRE_MINUTES: int = 10
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_HISTORY_COUNT: int = 5

    # Cloudflare D1 & R2 Integration Settings
    CLOUDFLARE_ACCOUNT_ID: str = "befbd2e0ff580a1d0d0865f011002053"
    CLOUDFLARE_DATABASE_ID: str = "34e085d8-c078-4f2f-b240-9bf8f4cf9301"
    CLOUDFLARE_API_TOKEN: str = ""
    CLOUDFLARE_R2_BUCKET_NAME: str = "fieldops-uploads"
    CLOUDFLARE_KV_NAMESPACE_ID: str = ""
    FORCE_LOCAL_DB: bool = False

    # Firebase Cloud Messaging (Push Notifications)
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "./firebase-service-account.json"
    FCM_PROJECT_ID: str = "indrae-740bb"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
