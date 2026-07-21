/**
 ==============================================================================
 STANDALONE OTP EMAIL DISPATCHER SCRIPT (DEPLOY TO EACH OF YOUR 10 GMAIL ACCOUNTS)
 ==============================================================================
 Deploy Instructions:
 1. Go to https://script.google.com/ and create a new project on each Gmail account.
 2. Paste this entire code into Editor (Code.gs).
 3. Click "Deploy" -> "New deployment".
 4. Select type: "Web app".
 5. Execute as: "Me".
 6. Who has access: "Anyone".
 7. Click "Deploy" and copy the Web App URL (e.g., https://script.google.com/macros/s/.../exec).
 8. Give all 10 Web App URLs to your backend configuration.
 ==============================================================================
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = false;

  try {
    hasLock = lock.tryLock(10000);
    if (!hasLock) {
      return jsonResponse({ success: false, error: "Account busy (lock timeout)" }, 429);
    }

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "No payload received" }, 400);
    }

    var data = JSON.parse(e.postData.contents);
    var correlationId = data.correlationId || ("otp_" + new Date().getTime());

    // Check remaining daily email quota
    var remainingQuota = MailApp.getRemainingDailyQuota();
    console.info("Mail Quota Remaining for this account: " + remainingQuota + " | Ref: " + correlationId);

    if (remainingQuota <= 0) {
      console.warn("Quota exhausted for this Gmail account (" + remainingQuota + "). Returning failure to trigger failover.");
      return jsonResponse({
        success: false,
        error: "Quota exhausted on this account (" + remainingQuota + ")",
        quotaRemaining: 0,
        correlationId: correlationId
      }, 429);
    }

    var toEmail = data.to;
    if (!toEmail || toEmail.indexOf("@") === -1) {
      return jsonResponse({ success: false, error: "Invalid recipient email", correlationId: correlationId }, 400);
    }

    var subject = data.subject || "Security Verification Code";
    var htmlBody = data.htmlBody || data.body || ("Your OTP is: " + data.otp);
    var plainBody = data.body || ("Your OTP is: " + data.otp);

    // Dispatch email
    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
      body: plainBody
    });

    console.info("OTP Email sent successfully to " + toEmail + " | Ref: " + correlationId);

    return jsonResponse({
      success: true,
      message: "OTP sent successfully",
      quotaRemaining: MailApp.getRemainingDailyQuota(),
      correlationId: correlationId
    });

  } catch (err) {
    console.error("OTP Error: " + err.toString());
    return jsonResponse({
      success: false,
      error: "Failed to send OTP: " + err.toString(),
      correlationId: correlationId
    }, 500);
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function doGet(e) {
  return jsonResponse({
    status: "ok",
    service: "OTP Email Dispatcher",
    quotaRemaining: MailApp.getRemainingDailyQuota(),
    timestamp: new Date().toISOString()
  });
}

function jsonResponse(data, status) {
  status = status || 200;
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
