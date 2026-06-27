import random
import string
import hashlib
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from jose import jwt
from app.config.settings import settings
from passlib.hash import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password (supports both pbkdf2 and bcrypt)"""
    try:
        if hashed_password.startswith("pbkdf2_sha256$"):
            parts = hashed_password.split("$")
            if len(parts) != 4:
                return False
            iterations = int(parts[1])
            salt = parts[2]
            key_hex = parts[3]
            new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), iterations)
            return new_key.hex() == key_hex
        
        # Default fallback to passlib bcrypt
        return bcrypt.verify(plain_password, hashed_password)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Hash password using PBKDF2 SHA256 (fully pure-python & fast on edge)"""
    salt = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"pbkdf2_sha256$100000${salt}${key.hex()}"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def generate_otp() -> str:
    """Generate a random 6-digit numerical OTP code"""
    return "".join(random.choices(string.digits, k=6))

def hash_otp(otp: str) -> str:
    """Hash the OTP code using SHA-256 for secure DB storage"""
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()

def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    """Verify plain OTP against hashed OTP"""
    return hash_otp(plain_otp) == hashed_otp

def validate_password_strength(password: str) -> Dict[str, Any]:
    """
    Validate password strength:
    - Min 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character
    """
    errors = []
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        errors.append(f"Password must be at least {settings.PASSWORD_MIN_LENGTH} characters long.")
    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")
    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")
    if not re.search(r"[ !@#$%^&*()_+\-=\[\]{};':\",./<>?\\|`~]", password):
        errors.append("Password must contain at least one special character.")
        
    return {
        "is_valid": len(errors) == 0,
        "errors": errors
    }

def check_password_history(password: str, history_hashes: List[str]) -> bool:
    """
    Check if the password matches any of the previously used passwords.
    Returns True if matches (meaning it WAS used before, so it's a violation).
    """
    for hashed in history_hashes:
        if verify_password(password, hashed):
            return True
    return False
