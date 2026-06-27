import requests
import logging
from app.config.settings import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.gas_url = settings.GAS_WEB_APP_URL
        self.gas_url_2 = settings.GAS_WEB_APP_URL_2

    def send_otp_email(self, to_email: str, user_name: str, otp: str, purpose: str) -> bool:
        """
        Send OTP email using Google Apps Script Web App.
        Falls back to a secondary URL if the primary fails.
        Falls back to terminal logging if neither URL is configured.
        
        purpose can be: 'password_reset' or 'account_unlock'
        """
        subject = "Verification Code"
        purpose_text = "Please use the verification code below to proceed with your request."
        badge_text = "Security Code"
        
        if purpose == "password_reset":
            subject = "Reset Password"
            purpose_text = "We received a request to reset the password for your Cyrix Expense Management account. Use the verification code below to set a new password."
            badge_text = "Password Reset OTP"
        elif purpose == "account_unlock":
            subject = "Unlock Account"
            purpose_text = "Your Cyrix Expense Management account has been locked due to too many failed login attempts. Use the verification code below to verify your identity and restore access."
            badge_text = "Account Unlock OTP"

        # Build Plain Text Fallback Body
        plain_text_body = f"Hello {user_name},\n\n{purpose_text}\n\nYour Verification Code is: {otp}\n\nThis code is valid for 10 minutes only.\n\nIf you did not request this, please contact IT support immediately.\n\nRegards,\nCyrix HealthCare Pvt Ltd"

        # Build Premium HTML Email Body (Modern SaaS Theme with Inline CSS)
        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; margin: 0; padding: 0; color: #1a1a1a; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #fafafa; width: 100%; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #eaeaea; padding: 40px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);">
      
      <!-- Logo/Brand Name -->
      <div style="margin-bottom: 32px; text-align: left;">
        <span style="font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #0A1628; text-transform: uppercase;">CYRIX</span>
        <span style="font-size: 11px; font-weight: 600; color: #C4A35A; letter-spacing: 2px; text-transform: uppercase; margin-left: 8px; border-left: 1px solid #eaeaea; padding-left: 8px;">Expense Portal</span>
      </div>

      <!-- Main Content -->
      <h2 style="font-size: 20px; font-weight: 700; color: #0A1628; margin: 0 0 16px 0;">Hello {user_name},</h2>
      
      <p style="font-size: 14px; line-height: 1.6; color: #666666; margin: 0 0 24px 0;">
        {purpose_text}
      </p>

      <!-- Verification Code Container -->
      <div style="background-color: #fcfbfa; border: 1px solid #f3efea; border-radius: 8px; padding: 24px; text-align: center; margin: 32px 0;">
        <span style="font-size: 12px; color: #888888; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Verification Code</span>
        <span style="font-size: 36px; font-weight: 700; color: #0A1628; letter-spacing: 6px; font-family: SFMono-Regular, Consolas, Monaco, monospace; display: block; margin-bottom: 8px;">{otp}</span>
        <span style="font-size: 11px; color: #ef4444; font-weight: 600; display: block;">⏱️ Valid for 10 minutes only</span>
      </div>

      <!-- Security Notice -->
      <p style="font-size: 12px; line-height: 1.5; color: #999999; margin: 0 0 32px 0; border-top: 1px solid #fafafa; padding-top: 16px;">
        <strong>Security Notice:</strong> If you did not request this code, you can safely ignore this email. Do not share this code with anyone.
      </p>

      <!-- Footer -->
      <div style="border-top: 1px solid #eaeaea; padding-top: 24px; text-align: center;">
        <p style="font-size: 12px; color: #999999; margin: 0 0 8px 0;">Cyrix HealthCare Pvt Ltd</p>
        <p style="font-size: 11px; color: #c8c8c8; margin: 0 0 16px 0;">This is an automated message. Please do not reply.</p>
        <p style="font-size: 12px; color: #888888; margin: 0; border-top: 1px solid #fafafa; padding-top: 12px;">
          Designed & Developed by <a href="https://sunilbishnoi.co.in/" target="_blank" style="color: #C4A35A; text-decoration: none; font-weight: 700;">Sunil Bishnoi</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>
"""

        payload = {
            "to": to_email,
            "name": user_name,
            "otp": otp,
            "purpose": purpose,
            "subject": subject,
            "body": plain_text_body,
            "htmlBody": html_content
        }

        # If no script URLs are configured, log to console and return True (simulation)
        if not self.gas_url and not self.gas_url_2:
            logger.warning(
                f"\n=======================================================\n"
                f"EMAIL SEND SIMULATION (No Google Apps Script URLs configured):\n"
                f"To: {to_email}\n"
                f"Name: {user_name}\n"
                f"OTP: {otp}\n"
                f"Purpose: {purpose}\n"
                f"=======================================================\n"
            )
            return True

        # Helper function to try sending through a specific URL
        def try_send(url: str, url_name: str) -> bool:
            if not url:
                return False
            try:
                logger.info(f"Attempting to send OTP email to {to_email} via {url_name}...")
                response = requests.post(url, json=payload, timeout=12)
                if response.status_code == 200:
                    result = response.json()
                    if result.get("success"):
                        logger.info(f"OTP successfully sent to {to_email} via {url_name}")
                        return True
                    else:
                        logger.error(f"{url_name} failed to send email: {result.get('error')}")
                else:
                    logger.error(f"Failed to connect to {url_name}. Status code: {response.status_code}")
            except Exception as e:
                logger.error(f"Error calling {url_name}: {str(e)}")
            return False

        # Attempt Primary URL
        if try_send(self.gas_url, "Primary Apps Script"):
            return True

        # Fallback to Secondary URL if primary fails
        if self.gas_url_2 and self.gas_url_2 != self.gas_url:
            logger.warning("Primary Apps Script failed. Attempting fallback Apps Script...")
            if try_send(self.gas_url_2, "Fallback Apps Script"):
                return True

        # Fallback log in case of complete failures
        logger.warning(f"CRITICAL: All Apps Script URLs failed to send email. Fallback logging OTP code for {to_email}: {otp}")
        return False

email_service = EmailService()
