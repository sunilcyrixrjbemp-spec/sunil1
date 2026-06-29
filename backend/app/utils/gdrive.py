import io
import os
import json
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

logger = logging.getLogger(__name__)

# Main Google Drive Folder ID
DRIVE_PARENT_FOLDER_ID = "1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu"
SERVICE_ACCOUNT_PATH = "firebase-service-account.json"
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']

def get_drive_service():
    """Initializes Google Drive service using Firebase Service Account credentials."""
    try:
        if os.path.exists(SERVICE_ACCOUNT_PATH):
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_PATH, 
                scopes=SCOPES
            )
        else:
            service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            if service_account_json:
                info = json.loads(service_account_json)
                creds = service_account.Credentials.from_service_account_info(
                    info, 
                    scopes=SCOPES
                )
            else:
                logger.error("GDrive: No service account credentials found.")
                return None
        return build('drive', 'v3', credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.error(f"GDrive: Failed to initialize Google Drive service client: {str(e)}")
        return None

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
    """Uploads file content to the corresponding month folder on Google Drive and returns the file ID."""
    service = get_drive_service()
    if not service:
        raise Exception("GDrive: Service client is not active.")
    
    # 1. Ensure target folder name (e.g. June_2026) exists inside the parent folder
    folder_name = f"{month_name}_{year}".replace(" ", "_")
    folder_id = get_or_create_subfolder(service, DRIVE_PARENT_FOLDER_ID, folder_name)
    
    # 2. Upload file
    file_metadata = {
        'name': filename,
        'parents': [folder_id]
    }
    media = MediaIoBaseUpload(io.BytesIO(file_content), mimetype=mime_type, resumable=True)
    file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
    return file.get('id')

def download_file_from_drive(file_id: str) -> tuple[bytes, str]:
    """Downloads a file's raw content and MIME type from Google Drive."""
    service = get_drive_service()
    if not service:
        raise Exception("GDrive: Service client is not active.")
    
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
