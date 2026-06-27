import sys
import os

# Add the vendored directory to the system path
vendor_path = os.path.join(os.path.dirname(__file__), "vendor")
if os.path.exists(vendor_path):
    sys.path.insert(0, vendor_path)

# Import the main app from the existing app package
from app.main import app
