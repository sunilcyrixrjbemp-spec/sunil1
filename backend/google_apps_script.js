/**
 * Google Apps Script - Robust Email Forwarder (Trigger Only)
 * Deploy this script as a Web App:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create a new project or open the existing one.
 * 3. Replace all code with this simple forwarder script.
 * 4. Click "Deploy" > "New deployment" (or "Manage deployments" > Edit > "New version").
 * 5. Set Description: "Expense Management Simple Forwarder".
 * 6. Set "Execute as": "Me".
 * 7. Set "Who has access": "Anyone".
 * 8. Click "Deploy" and authorize the permissions.
 * 9. Copy the Web App URL and paste it in the backend `.env` file under `GAS_WEB_APP_URL`.
 * 
 * IMPORTANT: If you edited an existing script, you must deploy a "New version"
 * from "Manage deployments" for the changes to take effect on the active URL.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
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

    // Try sending with GmailApp first (supports Gmail threads/features),
    // and fallback to MailApp if GmailApp permissions are missing.
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
