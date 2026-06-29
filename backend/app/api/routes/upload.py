import os
import shutil
import logging
import requests
from fastapi import APIRouter, File, UploadFile, HTTPException, status
from fastapi.responses import StreamingResponse, FileResponse
from app.config.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Setup uploads directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "app", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    """Save upload file to Cloudflare R2 bucket or local disk fallback and return local proxy path"""
    # Clean filename
    filename = os.path.basename(file.filename)
    name, ext = os.path.splitext(filename)
    timestamp = os.urandom(4).hex()
    safe_name = f"{name.replace(' ', '_')}_{timestamp}{ext}"
    key = f"{subfolder}/{safe_name}"
    
    # R2 Upload path
    if settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ACCOUNT_ID and settings.CLOUDFLARE_R2_BUCKET_NAME:
        try:
            # Read file content
            file.file.seek(0)
            file_content = file.file.read()
            url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/{settings.CLOUDFLARE_R2_BUCKET_NAME}/objects/{key}"
            headers = {
                "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
                "Content-Type": file.content_type or "application/octet-stream"
            }
            response = requests.put(url, headers=headers, data=file_content, timeout=30)
            if response.status_code == 200:
                logger.info(f"Successfully uploaded {key} to Cloudflare R2 bucket: {settings.CLOUDFLARE_R2_BUCKET_NAME}")
                return f"/api/upload/file/{key}"
            else:
                logger.error(f"R2 Upload API returned status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Failed to upload {key} to R2: {str(e)}")
            
    # Local fallback path
    try:
        target_dir = os.path.join(UPLOAD_DIR, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, safe_name)
        file.file.seek(0)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return f"/api/upload/file/{key}"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file locally: {str(e)}"
        )

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    """Upload receipts/images for reimbursement proof"""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".pdf"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, PNG, GIF images or PDF documents are allowed for receipts."
        )
    url = save_uploaded_file(file, "images")
    return {"filename": file.filename, "url": url}

@router.post("/document")
async def upload_document(file: UploadFile = File(...)):
    """Upload documents"""
    url = save_uploaded_file(file, "documents")
    return {"filename": file.filename, "url": url}

@router.get("/file/{filename:path}")
async def serve_file(filename: str):
    """Proxy route to serve files either from Google Drive, Cloudflare R2 bucket, or local storage fallback."""
    # 0. Fetch from Google Drive if path starts with gdrive/
    if filename.startswith("gdrive/"):
        file_id = filename.replace("gdrive/", "")
        try:
            import io
            from app.utils.gdrive import download_file_from_drive
            file_bytes, mime_type = download_file_from_drive(file_id)
            return StreamingResponse(io.BytesIO(file_bytes), media_type=mime_type)
        except Exception as e:
            logger.error(f"GDrive: Failed to download/serve file ID {file_id}: {str(e)}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"File not found in Google Drive: {str(e)}")

    clean_filename = os.path.basename(filename)
    subfolder = os.path.dirname(filename)
    
    # 1. Fetch from R2
    if settings.CLOUDFLARE_API_TOKEN and settings.CLOUDFLARE_ACCOUNT_ID and settings.CLOUDFLARE_R2_BUCKET_NAME:
        url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/r2/buckets/{settings.CLOUDFLARE_R2_BUCKET_NAME}/objects/{filename}"
        headers = {
            "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}"
        }
        try:
            response = requests.get(url, headers=headers, stream=True, timeout=15)
            if response.status_code == 200:
                content_type = response.headers.get("Content-Type", "application/octet-stream")
                return StreamingResponse(response.iter_content(chunk_size=8192), media_type=content_type)
            logger.warning(f"File {filename} not found in R2. Falling back to local search.")
        except Exception as e:
            logger.error(f"Error fetching file {filename} from R2: {str(e)}")

    # 2. Local fallback
    local_path = os.path.join(UPLOAD_DIR, subfolder, clean_filename)
    if os.path.exists(local_path):
        return FileResponse(local_path)
        
    fallback_path = os.path.join(UPLOAD_DIR, clean_filename)
    if os.path.exists(fallback_path):
        return FileResponse(fallback_path)
        
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
