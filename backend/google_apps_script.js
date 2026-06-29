/**
 * Google Apps Script - Robust Email Forwarder & Drive Attachment Uploader
 * Deploy this script as a Web App:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create a new project or open the existing one.
 * 3. Replace all code with this combined script.
 * 4. Click "Deploy" > "New deployment" (or "Manage deployments" > Edit > "New version").
 * 5. Set Description: "Expense Management Uploader & Forwarder".
 * 6. Set "Execute as": "Me" (your personal Gmail account).
 * 7. Set "Who has access": "Anyone".
 * 8. Click "Deploy" and authorize permissions.
 * 9. Copy the Web App URL and paste it in the backend `.env` file under `GAS_WEB_APP_URL`.
 * 
 * IMPORTANT: If you edited an existing script, you must deploy a "New version"
 * from "Manage deployments" for the changes to take effect on the active URL.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "send_email";
    
    // ACTION: UPLOAD FILE TO GOOGLE DRIVE
    if (action === "upload_file") {
      var folderId = data.folderId;       // Parent folder ID
      var folderName = data.folderName;   // Subfolder name (e.g., June_2026)
      var filename = data.filename;       // Target filename
      var fileBase64 = data.fileBase64;   // File content as base64 string
      var mimeType = data.mimeType || "application/octet-stream";
      
      if (!folderId || !folderName || !filename || !fileBase64) {
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          error: "Missing required parameters for file upload" 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // 1. Get parent folder
      var parentFolder = DriveApp.getFolderById(folderId);
      
      // 2. Get or create subfolder (month-wise)
      var folders = parentFolder.getFoldersByName(folderName);
      var subFolder;
      if (folders.hasNext()) {
        subFolder = folders.next();
      } else {
        subFolder = parentFolder.createFolder(folderName);
      }
      
      // 3. Decode base64 and create file
      var fileBytes = Utilities.base64Decode(fileBase64);
      var blob = Utilities.newBlob(fileBytes, mimeType, filename);
      var file = subFolder.createFile(blob);
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingErr) {
        // Ignore if sharing policy restricts it
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        success: true, 
        fileId: file.getId() 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ACTION: DOWNLOAD FILE FROM GOOGLE DRIVE
    if (action === "download_file") {
      var fileId = data.fileId;
      if (!fileId) {
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          error: "Missing fileId" 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      var base64 = Utilities.base64Encode(blob.getBytes());
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fileBase64: base64,
        mimeType: blob.getContentType()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ACTION: DELETE FILE FROM GOOGLE DRIVE
    if (action === "delete_file") {
      var fileId = data.fileId;
      if (!fileId) {
        return ContentService.createTextOutput(JSON.stringify({ 
          success: false, 
          error: "Missing fileId" 
        })).setMimeType(ContentService.MimeType.JSON);
      }
      try {
        var file = DriveApp.getFileById(fileId);
        file.setTrashed(true);
        return ContentService.createTextOutput(JSON.stringify({
          success: true
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    // ACTION: EMAIL FORWARDER (DEFAULT)
    var to = data.to;
    var subject = data.subject || "Verification Code - Expense Management";
    var body = data.body || "";
    var htmlBody = data.htmlBody || "";

    if (!to) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing recipient email ('to')" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var options = {};
    if (htmlBody) {
      options.htmlBody = htmlBody;
    }

    try {
      GmailApp.sendEmail(to, subject, body, options);
    } catch (err) {
      MailApp.sendEmail(to, subject, body, options);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Dummy function to easily trigger the Google Drive permission authorization popup
function testAuthorize() {
  var root = DriveApp.getRootFolder();
  // Create a temporary test file to force WRITE permissions scope detection
  var file = root.createFile("temp_auth_test.txt", "This is a temporary authorization test file.");
  file.setTrashed(true); // Move it to trash immediately
  Logger.log("Drive authorized successfully with full read & write permissions!");
}
