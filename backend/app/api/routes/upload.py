import os
import shutil
from fastapi import APIRouter, File, UploadFile, HTTPException, status

router = APIRouter()

# Setup uploads directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "app", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    """Save upload file to local disk and return absolute web url"""
    try:
        # Create folder structure if not exists
        target_dir = os.path.join(UPLOAD_DIR, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        
        # Clean filename to avoid directory traversal
        filename = os.path.basename(file.filename)
        # Ensure unique name to avoid overwrites
        name, ext = os.path.splitext(filename)
        timestamp = os.urandom(4).hex()
        safe_name = f"{name}_{timestamp}{ext}"
        
        file_path = os.path.join(target_dir, safe_name)
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return f"/static/uploads/{subfolder}/{safe_name}"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    """Upload receipts/images for reimbursement proof"""
    # Verify file extension is image
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
