import sys
import os

# Add the vendored directory to the system path
vendor_path = os.path.join(os.path.dirname(__file__), "vendor")
if os.path.exists(vendor_path):
    sys.path.insert(0, vendor_path)

from workers import WorkerEntrypoint
import asgi

_real_app = None

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        global _real_app
        if _real_app is None:
            from app.main import app as real_app
            _real_app = real_app
        return await asgi.fetch(_real_app, request, self.env)


