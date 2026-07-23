/**
 ==============================================================================
 ONE-TIME MIGRATION SCRIPT: CONVERT EXISTING PDF ATTACHMENTS TO JPG
 ==============================================================================
 Purpose:
 1. Scans existing attachments / Drive files for PDF format (.pdf).
 2. Converts PDF files into high-resolution JPG images.
 3. Updates database file_url entries to the newly created JPG file URLs.
 4. Includes dryRun mode (default: true) for safety.
 
 Usage:
 - Run `runDryRunMigration()` to inspect and verify PDF files without making changes.
 - Run `runActualMigration()` to perform actual PDF-to-JPG conversion & DB URL updates.
 ==============================================================================
 */

function runDryRunMigration() {
  migratePdfToJpg(true);
}

function runActualMigration() {
  migratePdfToJpg(false);
}

/**
 * Main migration function.
 * @param {boolean} dryRun - If true, only scans & logs without altering files or DB.
 */
function migratePdfToJpg(dryRun) {
  if (dryRun === undefined || dryRun === null) {
    dryRun = true;
  }

  Logger.log("=================================================");
  Logger.log("PDF TO JPG MIGRATION SCRIPT STARTED (DryRun: " + dryRun + ")");
  Logger.log("=================================================");

  var parentFolderId = "1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu";
  var parentFolder = DriveApp.getFolderById(parentFolderId);

  var pdfFilesFound = [];
  var successfulConversions = [];
  var failedConversions = [];

  // 1. Scan Parent Folder & Subfolders for PDF files
  scanFolderForPdfs(parentFolder, pdfFilesFound);

  Logger.log("Total PDF files identified for migration: " + pdfFilesFound.length);

  if (pdfFilesFound.length === 0) {
    Logger.log("No PDF attachments found. Migration not required.");
    return;
  }

  // Log all found PDF files
  for (var i = 0; i < pdfFilesFound.length; i++) {
    var pdf = pdfFilesFound[i];
    Logger.log("[" + (i + 1) + "/" + pdfFilesFound.length + "] Found PDF: " + pdf.name + " (ID: " + pdf.id + ")");
  }

  if (dryRun) {
    Logger.log("=================================================");
    Logger.log("DRY-RUN COMPLETED SUCCESSFULY.");
    Logger.log("No files were converted or modified in dry-run mode.");
    Logger.log("Run `runActualMigration()` to convert these " + pdfFilesFound.length + " files.");
    Logger.log("=================================================");
    return;
  }

  // 2. Perform Conversion in Actual Mode
  for (var k = 0; k < pdfFilesFound.length; k++) {
    var pdfItem = pdfFilesFound[k];
    try {
      Logger.log("Converting [" + (k + 1) + "/" + pdfFilesFound.length + "]: " + pdfItem.name + "...");
      
      var file = DriveApp.getFileById(pdfItem.id);
      var blob = file.getBlob();
      
      // Convert PDF Blob to JPG image
      var newJpgName = pdfItem.name.replace(/\.pdf$/i, ".jpg");
      if (!newJpgName.toLowerCase().endsWith(".jpg")) {
        newJpgName += ".jpg";
      }

      // Convert using Drive Blob image conversion
      var jpgBlob = blob.getAs("image/jpeg").setName(newJpgName);
      var folder = pdfItem.parentFolder || parentFolder;
      var newFile = folder.createFile(jpgBlob);

      var newFileId = newFile.getId();
      var oldUrl = "/api/upload/file/gdrive/" + pdfItem.id;
      var newUrl = "/api/upload/file/gdrive/" + newFileId;

      successfulConversions.push({
        oldId: pdfItem.id,
        newId: newFileId,
        oldUrl: oldUrl,
        newUrl: newUrl,
        filename: newJpgName
      });

      Logger.log("✓ Successfully converted: " + pdfItem.name + " -> " + newJpgName + " (New ID: " + newFileId + ")");
    } catch (err) {
      Logger.log("❌ Failed to convert PDF (ID: " + pdfItem.id + ", Name: " + pdfItem.name + "): " + err.toString());
      failedConversions.push({
        id: pdfItem.id,
        name: pdfItem.name,
        error: err.toString()
      });
    }
  }

  // 3. Update D1 database expense_attachments table file_url entries for converted files
  if (successfulConversions.length > 0) {
    Logger.log("Updating D1 database expense_attachments table file_url entries...");
    var accountId = "befbd2e0ff580a1d0d0865f011002053";
    var databaseId = "34e085d8-c078-4f2f-b240-9bf8f4cf9301";
    var token = PropertiesService.getScriptProperties().getProperty("CF_API_TOKEN") || "cfk_API_TOKEN_PLACEHOLDER";
    var d1Url = "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/d1/database/" + databaseId + "/query";

    for (var c = 0; c < successfulConversions.length; c++) {
      var item = successfulConversions[c];
      try {
        // ITEM 2 FIX: Use exact match '=' on full file_url to prevent accidental partial-match updates
        var payload = {
          sql: "UPDATE expense_attachments SET file_url = ? WHERE file_url = ?",
          params: [item.newUrl, item.oldUrl]
        };
        var options = {
          method: "post",
          contentType: "application/json",
          headers: {
            "X-Auth-Key": token,
            "X-Auth-Email": "Sunil.cyrixrjbemp@gmail.com"
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };
        var resp = UrlFetchApp.fetch(d1Url, options);
        var respText = resp.getContentText();
        var resJson = null;
        try { resJson = JSON.parse(respText); } catch (pErr) {}

        // ITEM 3 FIX: Re-classify DB update failures into failedConversions for accurate logging
        if (resp.getResponseCode() === 200 && resJson && resJson.success) {
          Logger.log("✓ D1 DB updated successfully for file ID " + item.oldId + " -> " + item.newId);
        } else {
          var errDetail = "HTTP " + resp.getResponseCode() + ": " + respText;
          Logger.log("❌ D1 DB update failed for file ID " + item.oldId + ": " + errDetail);
          failedConversions.push({
            id: item.oldId,
            name: item.filename,
            error: "Drive conversion succeeded, but DB URL update failed: " + errDetail
          });
          item.dbFailed = true;
        }
      } catch (dbErr) {
        Logger.log("❌ D1 DB update exception for file ID " + item.oldId + ": " + dbErr.toString());
        failedConversions.push({
          id: item.oldId,
          name: item.filename,
          error: "Drive conversion succeeded, but DB URL update threw error: " + dbErr.toString()
        });
        item.dbFailed = true;
      }
    }

    // Filter out items where DB update failed so final report is 100% accurate
    successfulConversions = successfulConversions.filter(function(x) {
      return !x.dbFailed;
    });
  }

  // 3. Final Summary & Error Report
  Logger.log("=================================================");
  Logger.log("MIGRATION COMPLETED.");
  Logger.log("Total PDFs Found          : " + pdfFilesFound.length);
  Logger.log("Successful Conversions    : " + successfulConversions.length);
  Logger.log("Failed Conversions        : " + failedConversions.length);

  if (failedConversions.length > 0) {
    Logger.log("--- FAILED CONVERSIONS LIST ---");
    for (var f = 0; f < failedConversions.length; f++) {
      var fail = failedConversions[f];
      Logger.log("FAIL #" + (f + 1) + " | File: " + fail.name + " | ID: " + fail.id + " | Error: " + fail.error);
    }
  }
  Logger.log("=================================================");
}

/**
 * Helper to recursively scan folders for PDF files.
 */
function scanFolderForPdfs(folder, resultsList) {
  var files = folder.getFilesByType(MimeType.PDF);
  while (files.hasNext()) {
    var f = files.next();
    resultsList.push({
      id: f.getId(),
      name: f.getName(),
      parentFolder: folder
    });
  }

  var subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    scanFolderForPdfs(subfolders.next(), resultsList);
  }
}
