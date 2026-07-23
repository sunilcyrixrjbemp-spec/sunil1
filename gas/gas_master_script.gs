/**
 ==============================================================================
 FIELD OPERATIONS & RJBEMP REPORT SYSTEM — HARDENED GOOGLE APPS SCRIPT (GAS)
 ==============================================================================
 Production-Grade, Future-Proof Master Script for:
 1. OTP Email Delivery with Quota Safeguards & Correlation Tracking
 2. Google Drive File Storage Proxy (Upload & Download)
 3. RJBEMP Monthly PDF Report Generation across 4 Zones / 21 Districts

 REQUIRED SCRIPT PROPERTIES (Configure in Apps Script -> Project Settings -> Script Properties):
 - ADMIN_EMAIL             : Email address for critical system alerts (e.g., admin@company.com)
 - PARENT_FOLDER_ID        : Google Drive Parent Folder ID for uploads (default: 1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu)
 - SPREADSHEET_ID          : Google Spreadsheet ID for logging and report data
 - MIN_MAIL_QUOTA_ALERT    : Minimum daily mail quota threshold to trigger warning (default: 20)
 ==============================================================================
 */

// ─── CONFIGURATION & PROPERTY HELPERS ────────────────────────────────────────

function getScriptProp(key, fallbackValue) {
  try {
    var props = PropertiesService.getScriptProperties();
    var val = props.getProperty(key);
    return (val !== null && val !== undefined && val !== '') ? val : fallbackValue;
  } catch (e) {
    console.error("Failed to read ScriptProperty " + key + ": " + e.toString());
    return fallbackValue;
  }
}

var CONFIG = {
  ADMIN_EMAIL: getScriptProp("ADMIN_EMAIL", "Sunil.cyrixrjbemp@gmail.com"),
  PARENT_FOLDER_ID: getScriptProp("PARENT_FOLDER_ID", "1oiX3ZTlnMQ9RYn8uXhLx2mrmzz_K98Nu"),
  SPREADSHEET_ID: getScriptProp("SPREADSHEET_ID", ""),
  MIN_MAIL_QUOTA_ALERT: parseInt(getScriptProp("MIN_MAIL_QUOTA_ALERT", "20"), 10)
};

// ─── ERROR LOGGING & ALERTING SYSTEM ──────────────────────────────────────────

/**
 * Log error to dedicated 'Error Log' sheet and send admin alert email if needed.
 */
function logError(context, errorObj, alertAdmin) {
  var timestamp = new Date().toISOString();
  var errMessage = errorObj ? (errorObj.message || errorObj.toString()) : "Unknown error";
  var stackTrace = errorObj ? (errorObj.stack || "No stack trace available") : "";

  console.error("[" + context + "] " + errMessage + "\nStack: " + stackTrace);

  try {
    var ssId = CONFIG.SPREADSHEET_ID;
    if (ssId) {
      var ss = SpreadsheetApp.openById(ssId);
      var sheet = ss.getSheetByName("Error Log");
      if (!sheet) {
        sheet = ss.insertSheet("Error Log");
        sheet.appendRow(["Timestamp", "Context", "Error Message", "Stack Trace"]);
        sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#fee2e2");
      }
      sheet.appendRow([timestamp, context, errMessage, stackTrace]);
    }
  } catch (sheetErr) {
    console.error("Failed to append to Error Log sheet: " + sheetErr.toString());
  }

  if (alertAdmin) {
    try {
      var remainingQuota = MailApp.getRemainingDailyQuota();
      if (remainingQuota > 2) {
        var subject = "[ALERT] GAS Production Error in " + context;
        var body = "An error occurred in function: " + context + "\n\n" +
                   "Error: " + errMessage + "\n\n" +
                   "Timestamp: " + timestamp + "\n\n" +
                   "Stack Trace:\n" + stackTrace;
        MailApp.sendEmail(CONFIG.ADMIN_EMAIL, subject, body);
      }
    } catch (mailErr) {
      console.error("Failed to send admin alert email: " + mailErr.toString());
    }
  }
}

// ─── HTTP FETCH RETRY WITH EXPONENTIAL BACKOFF ────────────────────────────────

/**
 * Executes UrlFetchApp call with up to maxRetries exponential backoff retries.
 */
function fetchWithRetry(url, options, maxRetries) {
  maxRetries = maxRetries || 3;
  var attempt = 0;
  var delayMs = 2000; // start with 2s

  while (attempt < maxRetries) {
    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        return response;
      }
      if (code >= 400 && code < 500 && code !== 429) {
        throw new Error("HTTP Client Error " + code + ": " + response.getContentText());
      }
      console.warn("UrlFetch attempt " + (attempt + 1) + " returned HTTP " + code + ". Retrying in " + delayMs + "ms...");
    } catch (e) {
      console.warn("UrlFetch attempt " + (attempt + 1) + " failed: " + e.toString() + ". Retrying in " + delayMs + "ms...");
      if (attempt === maxRetries - 1) {
        throw e;
      }
    }
    Utilities.sleep(delayMs);
    delayMs *= 2; // exponential backoff 2s, 4s, 8s
    attempt++;
  }
  throw new Error("UrlFetch failed after " + maxRetries + " attempts to " + url);
}

// ─── TRIGGER DE-DUPLICATION & CONCURRENCY CONTROL ─────────────────────────────

/**
 * Removes duplicate time-driven triggers for a given function name, keeping only one.
 */
function cleanupDuplicateTriggers(functionName) {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var matching = [];
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === functionName) {
        matching.push(triggers[i]);
      }
    }
    // Delete all except the newest one
    if (matching.length > 1) {
      console.info("Found " + matching.length + " duplicate triggers for " + functionName + ". Cleaning up...");
      for (var j = 1; j < matching.length; j++) {
        ScriptApp.deleteTrigger(matching[j]);
      }
    }
  } catch (e) {
    logError("cleanupDuplicateTriggers", e, false);
  }
}

// ─── MAIN HTTP ENTRYPOINT (doPost & doGet) ───────────────────────────────────

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(15000); // 15s timeout
    if (!hasLock) {
      return jsonResponse({ success: false, error: "Server busy - concurrent request lock timeout. Please retry." }, 429);
    }

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "No post data received" }, 400);
    }

    var requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: "Invalid JSON format: " + parseErr.message }, 400);
    }

    var action = requestData.action || requestData.purpose || "upload_file";
    var correlationId = requestData.correlationId || ("req_" + new Date().getTime());

    console.info("Handling action: " + action + " | CorrelationID: " + correlationId);

    // Route Actions
    if (action === "password_reset" || action === "account_unlock" || requestData.otp) {
      return handleOtpEmailSend(requestData, correlationId);
    } else if (action === "upload_file") {
      return handleFileUpload(requestData);
    } else if (action === "download_file") {
      return handleFileDownload(requestData);
    } else if (action === "delete_file") {
      return handleFileDelete(requestData);
    } else if (action === "generate_rjbemp_report") {
      return handleReportRequest(requestData);
    } else {
      return jsonResponse({ success: false, error: "Unknown action: " + action }, 400);
    }

  } catch (err) {
    logError("doPost", err, true);
    return jsonResponse({ success: false, error: "Internal script error: " + err.toString() }, 500);
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "FieldOps GAS Master Service",
    timestamp: new Date().toISOString(),
    mailQuotaRemaining: MailApp.getRemainingDailyQuota()
  });
}

function jsonResponse(data, status) {
  status = status || 200;
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── OTP EMAIL DELIVERY ROUTINE ───────────────────────────────────────────────

function handleOtpEmailSend(data, correlationId) {
  try {
    var remainingQuota = MailApp.getRemainingDailyQuota();
    console.info("Mail Quota Remaining: " + remainingQuota + " | CorrelationID: " + correlationId);

    if (remainingQuota < CONFIG.MIN_MAIL_QUOTA_ALERT) {
      logError("MailQuotaWarning", new Error("Low daily mail quota remaining: " + remainingQuota), true);
    }

    if (remainingQuota <= 0) {
      throw new Error("Daily email quota exhausted (" + remainingQuota + "). Cannot send OTP.");
    }

    var toEmail = data.to;
    if (!toEmail || toEmail.indexOf("@") === -1) {
      return jsonResponse({ success: false, error: "Invalid recipient email: " + toEmail, correlationId: correlationId }, 400);
    }

    var subject = data.subject || "Security Verification Code";
    var htmlBody = data.htmlBody || data.body || ("Your OTP is: " + data.otp);

    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
      body: data.body || ("Your OTP is: " + data.otp)
    });

    console.info("OTP Email dispatched successfully to: " + toEmail + " | CorrelationID: " + correlationId);

    return jsonResponse({
      success: true,
      message: "Email sent successfully",
      quotaRemaining: MailApp.getRemainingDailyQuota(),
      correlationId: correlationId
    });

  } catch (e) {
    logError("handleOtpEmailSend (" + correlationId + ")", e, true);
    return jsonResponse({
      success: false,
      error: "OTP dispatch failed: " + e.toString(),
      correlationId: correlationId
    }, 500);
  }
}

// ─── GOOGLE DRIVE FILE OPERATIONS ─────────────────────────────────────────────

function handleFileUpload(data) {
  try {
    var parentId = data.folderId || CONFIG.PARENT_FOLDER_ID;
    var folderName = data.folderName || "General";
    var filename = data.filename || ("file_" + new Date().getTime());
    var base64Str = data.fileBase64;
    var mimeType = data.mimeType || "application/octet-stream";

    if (!base64Str || base64Str.length === 0) {
      return jsonResponse({ success: false, error: "Empty file base64 data received" }, 400);
    }

    var parentFolder = DriveApp.getFolderById(parentId);
    var targetFolder;
    var subFolders = parentFolder.getFoldersByName(folderName);
    if (subFolders.hasNext()) {
      targetFolder = subFolders.next();
    } else {
      targetFolder = parentFolder.createFolder(folderName);
    }

    var decodedBytes = Utilities.base64Decode(base64Str);
    var blob = Utilities.newBlob(decodedBytes, mimeType, filename);
    
    // Server-side byte re-encoding to JPEG
    if (mimeType.indexOf("image/") === 0 || filename.toLowerCase().indexOf(".jpg") !== -1) {
      try {
        blob = blob.getAs("image/jpeg").setName(filename);
      } catch (convErr) {
        console.warn("Native JPEG byte re-encoding fallback: " + convErr.toString());
      }
    }

    var createdFile = targetFolder.createFile(blob);

    return jsonResponse({
      success: true,
      fileId: createdFile.getId(),
      filename: createdFile.getName(),
      url: createdFile.getUrl()
    });

  } catch (e) {
    logError("handleFileUpload", e, true);
    return jsonResponse({ success: false, error: "Upload failed: " + e.toString() }, 500);
  }
}

function handleFileDownload(data) {
  try {
    var fileId = data.fileId;
    if (!fileId) {
      return jsonResponse({ success: false, error: "Missing fileId parameter" }, 400);
    }

    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var bytes = blob.getBytes();
    var base64Str = Utilities.base64Encode(bytes);

    return jsonResponse({
      success: true,
      fileId: fileId,
      filename: file.getName(),
      mimeType: blob.getContentType(),
      fileBase64: base64Str,
      sizeBytes: bytes.length
    });

  } catch (e) {
    logError("handleFileDownload (" + data.fileId + ")", e, false);
    return jsonResponse({ success: false, error: "File download failed: " + e.toString() }, 404);
  }
}

function handleFileDelete(data) {
  try {
    var fileId = data.fileId;
    if (!fileId) return jsonResponse({ success: false, error: "Missing fileId" }, 400);
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return jsonResponse({ success: true, message: "File trashed successfully" });
  } catch (e) {
    logError("handleFileDelete", e, false);
    return jsonResponse({ success: false, error: e.toString() }, 500);
  }
}

// ─── BATCH RJBEMP PDF REPORT GENERATION WITH CHECKPOINTING ────────────────────

var RJBEMP_ZONES = {
  "Ajmer": ["Ajmer", "Beawer", "Bhilwara", "Nagaur", "Tonk"],
  "Bikaner": ["Bikaner", "Churu", "Ganganar", "Hanumangarh"],
  "Jaipur": ["Jaipur"],
  "Jodhpur": ["Barmer", "Balotra", "Jaisalmer", "Jalore", "Jodhpur", "Pali", "Phalodi", "Sirohi"],
  "Udaipur": ["Banswara", "Chittorgarh", "Dungarpur", "Rajsamand", "Pratapgarh", "Udaipur"]
};

function handleReportRequest(data) {
  var runId = data.runId || ("run_" + new Date().getTime());
  return runBatchReportGeneration(runId);
}

function runBatchReportGeneration(runId) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) {
    return jsonResponse({ success: false, error: "Report generation already running in another process." }, 429);
  }

  var scriptProps = PropertiesService.getScriptProperties();
  var stateJson = scriptProps.getProperty("REPORT_STATE_" + runId);
  var state = stateJson ? JSON.parse(stateJson) : { runId: runId, completedDistricts: [], successes: 0, failures: 0, errors: [] };

  var totalSucceeded = state.successes;
  var totalFailed = state.failures;
  var errors = state.errors;

  try {
    var startTime = new Date().getTime();
    var maxExecutionMs = 4 * 60 * 1000; // Stop after 4 mins to leave buffer before 6-min timeout

    for (var zone in RJBEMP_ZONES) {
      var districts = RJBEMP_ZONES[zone];
      for (var i = 0; i < districts.length; i++) {
        var dist = districts[i];
        var itemKey = zone + ":" + dist;

        // Idempotency: Skip already completed districts in this run
        if (state.completedDistricts.indexOf(itemKey) !== -1) {
          continue;
        }

        // Execution Time Check
        if (new Date().getTime() - startTime > maxExecutionMs) {
          console.info("Approaching GAS 6-minute execution limit. Checkpointing progress for run " + runId);
          scriptProps.setProperty("REPORT_STATE_" + runId, JSON.stringify(state));
          return jsonResponse({
            success: true,
            status: "checkpointed",
            runId: runId,
            message: "Progress saved. " + state.completedDistricts.length + " districts completed. Trigger next batch to resume.",
            completedCount: state.completedDistricts.length
          });
        }

        // District Loop Failure Isolation
        try {
          generateDistrictReportPdf(zone, dist);
          state.completedDistricts.push(itemKey);
          totalSucceeded++;
        } catch (distErr) {
          totalFailed++;
          var errMsg = "Failed " + itemKey + ": " + distErr.toString();
          errors.push(errMsg);
          logError("generateDistrictReportPdf (" + itemKey + ")", distErr, false);
          // Mark as processed so we don't get stuck in an infinite loop on retry
          state.completedDistricts.push(itemKey);
        }

        state.successes = totalSucceeded;
        state.failures = totalFailed;
        state.errors = errors;
        scriptProps.setProperty("REPORT_STATE_" + runId, JSON.stringify(state));
      }
    }

    // Run Completed! Clean up checkpoint state
    scriptProps.deleteProperty("REPORT_STATE_" + runId);

    var summaryMsg = "RJBEMP Report Run Finished: " + totalSucceeded + " succeeded, " + totalFailed + " failed.";
    console.info(summaryMsg);

    return jsonResponse({
      success: true,
      status: "completed",
      runId: runId,
      succeeded: totalSucceeded,
      failed: totalFailed,
      errors: errors,
      message: summaryMsg
    });

  } catch (runErr) {
    logError("runBatchReportGeneration", runErr, true);
    return jsonResponse({ success: false, error: runErr.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

function generateDistrictReportPdf(zone, district) {
  // Mock / Placeholder for PDF render logic - isolated per district
  Utilities.sleep(100); // simulate work
  return true;
}

// ─── DAILY HEALTH CHECK & MONITORING TRIGGER ─────────────────────────────────

function runDailyHealthCheck() {
  try {
    cleanupDuplicateTriggers("runDailyHealthCheck");

    var quota = MailApp.getRemainingDailyQuota();
    var ssId = CONFIG.SPREADSHEET_ID;
    var errorCount = 0;

    if (ssId) {
      var ss = SpreadsheetApp.openById(ssId);
      var errSheet = ss.getSheetByName("Error Log");
      if (errSheet && errSheet.getLastRow() > 1) {
        errorCount = errSheet.getLastRow() - 1;
      }
    }

    console.info("[HEALTH CHECK] Remaining Quota: " + quota + " | Recent Errors Logged: " + errorCount);

    if (quota < CONFIG.MIN_MAIL_QUOTA_ALERT || errorCount > 10) {
      var alertBody = "Daily Health Check Summary:\n\n" +
                       "- Mail Quota Remaining: " + quota + "\n" +
                       "- Error Log Rows: " + errorCount + "\n\n" +
                       "Please inspect Apps Script Executions and Error Log sheet.";
      MailApp.sendEmail(CONFIG.ADMIN_EMAIL, "[HEALTH CHECK WARNING] GAS System Status", alertBody);
    }
  } catch (e) {
    logError("runDailyHealthCheck", e, true);
  }
}
