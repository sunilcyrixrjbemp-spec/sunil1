import io
import os
import json
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)

# Main Google Drive Folder ID (can be overridden by environment variable)
DRIVE_PARENT_FOLDER_ID = os.getenv("GDRIVE_FOLDER_ID", "1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu")
# Resolve absolute path to firebase-service-account.json
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SERVICE_ACCOUNT_PATH = os.path.join(BASE_DIR, "firebase-service-account.json")
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    """Initializes Google Drive service using Firebase Service Account credentials."""
    errors = []
    try:
        if os.path.exists(SERVICE_ACCOUNT_PATH):
            try:
                creds = service_account.Credentials.from_service_account_file(
                    SERVICE_ACCOUNT_PATH, 
                    scopes=SCOPES
                )
                return build('drive', 'v3', credentials=creds, cache_discovery=False)
            except Exception as e:
                errors.append(f"File load error: {str(e)}")
        else:
            errors.append(f"Path '{SERVICE_ACCOUNT_PATH}' does not exist.")
            
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            info = None
            try:
                info = json.loads(service_account_json)
                if info and "private_key" in info:
                    info["private_key"] = info["private_key"].replace('\\n', '\n').replace('\\', '')
            except Exception as json_err:
                errors.append(f"Standard JSON parse failed: {str(json_err)}")
                # Regex fallback parser
                import re
                try:
                    parsed_info = {}
                    normalized = service_account_json.replace('\r\n', '\n').replace('\r', '\n')
                    
                    # Extract private key (supports multiline)
                    pk_match = re.search(r'"private_key":\s*"([^"]+)"', normalized, re.DOTALL)
                    if pk_match:
                        # Clean up escaped backslashes and newlines, and remove all remaining backslashes to ensure valid PEM format
                        pk_val = pk_match.group(1).replace('\\n', '\n').replace('\\', '')
                        parsed_info["private_key"] = pk_val
                        
                    # Extract other string fields
                    fields = ["type", "project_id", "private_key_id", "client_email", "client_id", "auth_uri", "token_uri", "auth_provider_x509_cert_url", "client_x509_cert_url", "universe_domain"]
                    for field in fields:
                        match = re.search(rf'"{field}":\s*"([^"]+)"', normalized)
                        if match:
                            parsed_info[field] = match.group(1)
                            
                    if "private_key" in parsed_info and "client_email" in parsed_info:
                        info = parsed_info
                    else:
                        errors.append(f"Regex parser failed: missing key/email. Found: {list(parsed_info.keys())}")
                except Exception as regex_err:
                    errors.append(f"Regex parser exception: {str(regex_err)}")
            
            if info:
                creds = service_account.Credentials.from_service_account_info(
                    info, 
                    scopes=SCOPES
                )
                return build('drive', 'v3', credentials=creds, cache_discovery=False)
        else:
            errors.append("Env var 'FIREBASE_SERVICE_ACCOUNT_JSON' is not set.")
            
        raise Exception(f"GDrive init failures: {'; '.join(errors)}")
    except Exception as e:
        logger.error(f"GDrive: Failed to initialize Google Drive service client: {str(e)}")
        raise e

def get_or_create_subfolder(service, parent_id: str, folder_name: str) -> str:
    """Finds or creates a subfolder by name inside a parent folder on Google Drive."""
    try:
        # Search for folder with this name inside parent
        query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and '{parent_id}' in parents and trashed = false"
        response = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = response.get('files', [])
        if files:
            return files[0]['id']
        
        # Not found, create it
        folder_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_id]
        }
        folder = service.files().create(body=folder_metadata, fields='id').execute()
        return folder.get('id')
    except Exception as e:
        logger.error(f"GDrive: Error checking/creating folder '{folder_name}': {str(e)}")
        raise e

def upload_file_to_drive(file_content: bytes, filename: str, mime_type: str, month_name: str, year: int) -> str:
    """Uploads file content to Google Drive (prioritizing Google Apps Script Web App, falling back to direct API)."""
    import base64
    import requests
    from app.config.settings import settings
    
    # 1. Try using Google Apps Script Web App first (bypasses Service Account 0-byte quota limit)
    if settings.GAS_WEB_APP_URL:
        try:
            folder_name = f"{month_name}_{year}".replace(" ", "_")
            file_b64 = base64.b64encode(file_content).decode("utf-8")
            
            payload = {
                "action": "upload_file",
                "folderId": DRIVE_PARENT_FOLDER_ID,
                "folderName": folder_name,
                "filename": filename,
                "fileBase64": file_b64,
                "mimeType": mime_type
            }
            
            response = requests.post(settings.GAS_WEB_APP_URL, json=payload, timeout=45)
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    logger.info(f"GDrive: Uploaded file via GAS Web App proxy: {filename} (ID: {result.get('fileId')})")
                    return result.get("fileId")
                else:
                    logger.error(f"GDrive: GAS Web App returned failure: {result.get('error')}")
            else:
                logger.error(f"GDrive: GAS Web App returned status {response.status_code}: {response.text}")
        except Exception as gas_err:
            logger.error(f"GDrive: Failed to upload via GAS Web App: {str(gas_err)}")
            
    # 2. Fallback to direct Service Account client
    logger.info("GDrive: Falling back to direct service account upload client...")
    service = get_drive_service()
    if not service:
        raise Exception("GDrive: Service client is not active.")
    
    folder_name = f"{month_name}_{year}".replace(" ", "_")
    folder_id = get_or_create_subfolder(service, DRIVE_PARENT_FOLDER_ID, folder_name)
    
    file_metadata = {
        'name': filename,
        'parents': [folder_id]
    }
    media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

def upload_profile_pic_to_drive(file_content: bytes, filename: str, mime_type: str) -> str:
    """Uploads profile picture to Google Drive 'Profile_Pictures' subfolder (prioritizing GAS, falling back to direct API)."""
    import base64
    import requests
    from app.config.settings import settings
    
    # 1. Try using Google Apps Script Web App first (bypasses Service Account 0-byte quota limit)
    if settings.GAS_WEB_APP_URL:
        try:
            file_b64 = base64.b64encode(file_content).decode("utf-8")
            payload = {
                "action": "upload_file",
                "folderId": DRIVE_PARENT_FOLDER_ID,
                "folderName": "Profile_Pictures",
                "filename": filename,
                "fileBase64": file_b64,
                "mimeType": mime_type
            }
            response = requests.post(settings.GAS_WEB_APP_URL, json=payload, timeout=45)
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    logger.info(f"GDrive: Uploaded profile pic via GAS Web App proxy: {filename} (ID: {result.get('fileId')})")
                    return result.get("fileId")
                else:
                    logger.error(f"GDrive: GAS Web App profile pic upload returned failure: {result.get('error')}")
            else:
                logger.error(f"GDrive: GAS Web App profile pic upload returned status {response.status_code}: {response.text}")
        except Exception as gas_err:
            logger.error(f"GDrive: Failed to upload profile pic via GAS Web App: {str(gas_err)}")
            
    # 2. Fallback to direct Service Account client
    logger.info("GDrive: Falling back to direct service account upload client for profile pic...")
    service = get_drive_service()
    if not service:
        raise Exception("GDrive: Service client is not active.")
        
    folder_id = get_or_create_subfolder(service, DRIVE_PARENT_FOLDER_ID, "Profile_Pictures")
    file_metadata = {
        'name': filename,
        'parents': [folder_id]
    }
    media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

def download_file_from_drive(file_id: str) -> tuple[bytes, str]:
    """Downloads a file's raw content and MIME type from Google Drive (prioritizing direct API, falling back to GAS)."""
    import base64
    import requests
    from app.config.settings import settings
    
    # 1. Try direct Service Account API first
    try:
        service = get_drive_service()
        if service:
            # Get metadata for MIME Type
            metadata = service.files().get(fileId=file_id, fields='mimeType').execute()
            mime_type = metadata.get('mimeType', 'application/octet-stream')
            
            # Download content
            request = service.files().get_media(fileId=file_id)
            file_stream = io.BytesIO()
            downloader = MediaIoBaseDownload(file_stream, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            return file_stream.getvalue(), mime_type
    except Exception as api_err:
        logger.warning(f"GDrive: Direct API download failed or client init failed for ID {file_id}. Falling back to GAS. Error: {str(api_err)}")
            
    # 2. Fallback to Google Apps Script Web App
    if settings.GAS_WEB_APP_URL:
        try:
            logger.info(f"GDrive: Falling back to GAS Web App to download file ID {file_id}")
            payload = {
                "action": "download_file",
                "fileId": file_id
            }
            response = requests.post(settings.GAS_WEB_APP_URL, json=payload, timeout=45)
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    file_b64 = result.get("fileBase64")
                    mime_type = result.get("mimeType", "application/octet-stream")
                    file_bytes = base64.b64decode(file_b64)
                    return file_bytes, mime_type
                else:
                    raise Exception(f"GAS returned error: {result.get('error')}")
            else:
                raise Exception(f"GAS returned status code {response.status_code}")
        except Exception as gas_err:
            logger.error(f"GDrive: GAS Web App download failed: {str(gas_err)}")
            raise Exception(f"GDrive download failed. Direct: Service client failed. GAS: {str(gas_err)}")
            
    raise Exception("GDrive: Service client is not active/failed and GAS_WEB_APP_URL is not configured.")

def delete_file_from_drive(file_id: str) -> bool:
    """Deletes a file from Google Drive (marking as trashed), prioritizing GAS, falling back to direct API."""
    import requests
    from app.config.settings import settings
    
    # 1. Try using Google Apps Script Web App first
    if settings.GAS_WEB_APP_URL:
        try:
            payload = {
                "action": "delete_file",
                "fileId": file_id
            }
            response = requests.post(settings.GAS_WEB_APP_URL, json=payload, timeout=20)
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    logger.info(f"GDrive: Deleted old file via GAS Web App proxy (ID: {file_id})")
                    return True
                else:
                    logger.error(f"GDrive: GAS Web App file deletion returned failure: {result.get('error')}")
            else:
                logger.error(f"GDrive: GAS Web App file deletion returned status {response.status_code}: {response.text}")
        except Exception as gas_err:
            logger.error(f"GDrive: Failed to delete file via GAS Web App: {str(gas_err)}")
            
    # 2. Fallback to direct Service Account client
    logger.info("GDrive: Falling back to direct service account client for deletion...")
    service = get_drive_service()
    if not service:
        logger.warning("GDrive: Service client is not active. Cannot delete old file.")
        return False
        
    try:
        service.files().delete(fileId=file_id).execute()
        logger.info(f"GDrive: Deleted old file via direct API (ID: {file_id})")
        return True
    except Exception as err:
        logger.error(f"GDrive: Failed to delete file via direct API: {str(err)}")
        return False

