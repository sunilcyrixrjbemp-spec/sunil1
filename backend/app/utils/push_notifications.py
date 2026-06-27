"""
Firebase Cloud Messaging (FCM) Push Notification Utility
Uses the FCM HTTP v1 API with a Service Account JSON key.

Prerequisites:
  - Place your Firebase Service Account JSON at: backend/firebase-service-account.json
  - Install google-auth: pip install google-auth
  
HOW TO GET Service Account JSON:
  Firebase Console → Project Settings → Service accounts → Generate new private key
"""

import logging
import os
import json
import requests
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Firebase project ID
FCM_PROJECT_ID = os.getenv("FCM_PROJECT_ID", "indrae-740bb")

# Path to service account JSON file
SERVICE_ACCOUNT_PATH = os.getenv(
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    str(Path(__file__).parent.parent.parent / "firebase-service-account.json")
)

# FCM v1 API endpoint
FCM_V1_ENDPOINT = f"https://fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send"

# Cache the access token to avoid requesting a new one every time
_cached_token: Optional[str] = None
_token_expiry: float = 0


def _get_access_token() -> Optional[str]:
    """
    Get a short-lived OAuth2 access token using the Firebase Service Account JSON.
    Caches the token until it expires.
    """
    import time
    global _cached_token, _token_expiry

    # Return cached token if still valid (with 60s buffer)
    if _cached_token and time.time() < (_token_expiry - 60):
        return _cached_token

    # Check if service account file exists
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        logger.warning(
            f"FCM: Service account JSON not found at: {SERVICE_ACCOUNT_PATH}\n"
            "     Download from Firebase Console → Project Settings → Service accounts → Generate new private key\n"
            "     Save as 'firebase-service-account.json' in backend/ folder"
        )
        return None

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleAuthRequest

        # Load credentials from service account JSON
        credentials = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_PATH,
            scopes=["https://www.googleapis.com/auth/firebase.messaging"]
        )

        # Refresh to get access token
        credentials.refresh(GoogleAuthRequest())
        _cached_token = credentials.token
        _token_expiry = credentials.expiry.timestamp() if credentials.expiry else (time.time() + 3600)

        logger.info("FCM: Access token obtained successfully")
        return _cached_token

    except ImportError:
        logger.error(
            "FCM: 'google-auth' package not installed.\n"
            "     Run: pip install google-auth"
        )
        return None
    except Exception as e:
        logger.error(f"FCM: Failed to get access token: {e}")
        return None


def send_push_notification(
    fcm_token: str,
    title: str,
    body: str,
    data: Optional[dict] = None
) -> bool:
    """
    Send a push notification to a specific device via FCM v1 API.
    
    Args:
        fcm_token: The device's FCM registration token
        title: Notification title
        body: Notification body text
        data: Optional extra key-value data payload
    
    Returns:
        True if sent successfully, False otherwise
    """
    if not fcm_token:
        logger.debug("FCM: No FCM token provided. Skipping push notification.")
        return False

    access_token = _get_access_token()
    if not access_token:
        return False

    try:
        # Build FCM v1 message payload
        payload = {
            "message": {
                "token": fcm_token,
                "notification": {
                    "title": title,
                    "body": body
                },
                "webpush": {
                    "notification": {
                        "title": title,
                        "body": body,
                        "icon": "/brand.png",
                        "badge": "/brand.png",
                        "requireInteraction": False
                    },
                    "fcm_options": {
                        "link": "/"
                    }
                },
                "android": {
                    "notification": {
                        "title": title,
                        "body": body,
                        "icon": "brand",
                        "priority": "HIGH",
                        "sound": "default"
                    },
                    "priority": "high"
                },
                "data": {k: str(v) for k, v in (data or {}).items()}
            }
        }

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            FCM_V1_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            logger.info(f"FCM: Push sent successfully to token ...{fcm_token[-10:]}")
            return True
        elif response.status_code == 401:
            # Token expired — clear cache and retry once
            global _cached_token, _token_expiry
            _cached_token = None
            _token_expiry = 0
            logger.warning("FCM: Access token expired. Will refresh on next call.")
            return False
        else:
            logger.error(f"FCM: HTTP error {response.status_code}: {response.text}")
            return False

    except requests.exceptions.Timeout:
        logger.error("FCM: Request timed out")
        return False
    except Exception as e:
        logger.error(f"FCM: Unexpected error: {e}")
        return False


def send_push_to_user_by_name(db, user_name: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    """
    Lookup a user by name and send them a push notification.
    """
    try:
        from app.models.user import User
        user = db.query(User).filter(User.name == user_name).first()
        if user and user.fcm_token:
            return send_push_notification(user.fcm_token, title, body, data)
        return False
    except Exception as e:
        logger.error(f"FCM: Error sending push to user '{user_name}': {e}")
        return False


def send_push_to_user_by_code(db, user_code: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    """
    Lookup a user by user_id/employee code and send them a push notification.
    """
    try:
        from app.models.user import User
        user = db.query(User).filter(User.user_id == user_code).first()
        if user and user.fcm_token:
            return send_push_notification(user.fcm_token, title, body, data)
        return False
    except Exception as e:
        logger.error(f"FCM: Error sending push to code '{user_code}': {e}")
        return False
