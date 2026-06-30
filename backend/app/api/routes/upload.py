import os
import shutil
import logging
import requests
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Response
from fastapi.responses import StreamingResponse, FileResponse
from app.config.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Setup uploads directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "app", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    """Save upload file to Google Drive, with fallbacks to Cloudflare R2 bucket or local disk"""
    # Clean filename
    filename = os.path.basename(file.filename)
    name, ext = os.path.splitext(filename)
    timestamp = os.urandom(4).hex()
    safe_name = f"{name.replace(' ', '_')}_{timestamp}{ext}"
    key = f"{subfolder}/{safe_name}"
    
    # 1. Try Google Drive Upload First
    try:
        from datetime import datetime
        now = datetime.now()
        month_name = now.strftime("%B")
        year_val = now.year
        
        file.file.seek(0)
        file_bytes = file.file.read()
        
        from app.utils.gdrive import upload_file_to_drive
        file_id = upload_file_to_drive(
            file_content=file_bytes,
            filename=safe_name,
            mime_type=file.content_type or "application/octet-stream",
            month_name=month_name,
            year=year_val
        )
        logger.info(f"Successfully uploaded {safe_name} to Google Drive (ID: {file_id})")
        return f"/api/upload/file/gdrive/{file_id}"
    except Exception as drive_err:
        logger.error(f"GDrive: Upload failed in save_uploaded_file, falling back to R2/Local. Error: {str(drive_err)}")

    # 2. R2 Upload path fallback
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
            
    # 3. Local fallback path
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
    if ext not in [".jpg", ".jpeg", ".png", ".pdf", ".heic", ".heif", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JPG, JPEG, PNG, PDF, HEIC, HEIF, and WEBP files are allowed for receipts."
        )
        
    # Validate file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the limit of {settings.MAX_UPLOAD_SIZE / (1024 * 1024):.0f}MB."
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
            import tempfile
            from fastapi.responses import FileResponse
            from app.utils.gdrive import download_file_from_drive
            
            # Setup local cache folder
            cache_dir = os.path.join(tempfile.gettempdir(), "gdrive_cache")
            os.makedirs(cache_dir, exist_ok=True)
            
            cache_path = os.path.join(cache_dir, file_id)
            mime_path = cache_path + ".mime"
            
            # Serve from local cache if it exists to make click-preview super fast
            if os.path.exists(cache_path) and os.path.exists(mime_path):
                try:
                    with open(mime_path, "r", encoding="utf-8") as f:
                        mime_type = f.read().strip()
                    logger.info(f"GDrive Cache: Serving file ID {file_id} from local cache.")
                    return FileResponse(cache_path, media_type=mime_type)
                except Exception as cache_err:
                    logger.warning(f"GDrive Cache: Failed to read cache for ID {file_id}: {str(cache_err)}")
            
            # Otherwise, download from Google Drive (first-time fetch)
            file_bytes, mime_type = download_file_from_drive(file_id)
            
            # Save downloaded file in the local cache folder
            try:
                with open(cache_path, "wb") as f:
                    f.write(file_bytes)
                with open(mime_path, "w", encoding="utf-8") as f:
                    f.write(mime_type)
                logger.info(f"GDrive Cache: Saved file ID {file_id} in local cache.")
            except Exception as cache_write_err:
                logger.warning(f"GDrive Cache: Failed to write cache for ID {file_id}: {str(cache_write_err)}")
                
            return Response(content=file_bytes, media_type=mime_type)
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

@router.get("/debug-expense/{expense_id:path}")
async def debug_expense(expense_id: str):
    try:
        from app.config.database import SessionLocal
        from app.api.routes.expense import get_expense_details
        from app.models.expense import Expense
        from app.models.user import User
        
        db = SessionLocal()
        try:
            # Find the expense
            if expense_id.isdigit():
                expense = db.query(Expense).filter((Expense.id == int(expense_id)) | (Expense.expense_code == expense_id)).first()
            else:
                expense = db.query(Expense).filter(Expense.expense_code == expense_id).first()
                
            if not expense:
                return {"error": "Expense not found"}
                
            # Get the user who submitted it
            user = db.query(User).filter(User.id == expense.user_id).first()
            if not user:
                return {"error": "User not found"}
            
            # Call get_expense_details
            data = await get_expense_details(expense_id=expense_id, db=db, current_user=user)
            return {"success": True, "data": data}
        finally:
            db.close()
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return {"success": False, "error": str(e), "traceback": tb}

