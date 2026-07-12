import re
import json
import os
from django.http import JsonResponse
class InputSanitizerMiddleware:
   """
   Middleware to reject malicious input (JS, HTML, code) and
   validate file uploads by extension + MIME type (without python-magic).
   """
   def __init__(self, get_response):
       self.get_response = get_response
       # Allowed MIME + extension map
       self.allowed_file_types = {
           "application/pdf": [".pdf"],
           "image/jpeg": [".jpg", ".jpeg"],
           "image/png": [".png"],
           "text/plain": [".txt"],
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [".doc",".docx"]
       }
   def __call__(self, request):
       # ✅ Validate GET params
       for key, value in request.GET.items():
           if not self._is_safe(value):
               return JsonResponse(
                   {"error": f"Invalid input in query param '{key}'"},
                   status=400
               )
       # ✅ Validate POST form fields
       for key, value in request.POST.items():
           if not self._is_safe(value):
               return JsonResponse(
                   {"error": f"Invalid input in form field '{key}'"},
                   status=400
               )
       # ✅ Validate JSON body
       if request.content_type and "application/json" in request.content_type:
           try:
               data = json.loads(request.body.decode("utf-8"))
               if not self._validate_json(data):
                   return JsonResponse(
                       {"error": "Invalid input detected in JSON body"},
                       status=400
                   )
           except json.JSONDecodeError:
               pass
       # ✅ Validate uploaded files
       for field_name, file in request.FILES.items():
           if not self._validate_file(file, field_name):
               return JsonResponse(
                   {"error": f"Invalid file uploaded for '{field_name}'"},
                   status=400
               )
       return self.get_response(request)
   # ---------------- Helpers ----------------
   def _is_safe(self, value: str) -> bool:
       """Reject HTML/JS/code-like patterns in strings."""
       if not isinstance(value, str):
           return True
       if re.search(r"<.*?>", value):
           return False
       forbidden_patterns = [
           r"script", r"onerror", r"onload", r"javascript:",
           r"eval\(", r"function\s*\(",  r"\$\("
       ]
       for pattern in forbidden_patterns:
           if re.search(pattern, value, re.IGNORECASE):
               return False
       return True
   def _validate_json(self, data):
       """Recursively validate JSON dicts/lists."""
       if isinstance(data, dict):
           return all(self._validate_json(v) for v in data.values())
       elif isinstance(data, list):
           return all(self._validate_json(v) for v in data)
       elif isinstance(data, str):
           return self._is_safe(data)
       return True
   def _validate_file(self, file, field_name: str) -> bool:
       """Check MIME type + extension for uploaded files."""
       ext = os.path.splitext(file.name)[1].lower()
       mime = file.content_type  # comes from client header
       if mime not in self.allowed_file_types:
           return False
       if ext not in self.allowed_file_types[mime]:
           return False
       # ✅ Optional: basic signature checks for stronger security
       try:
           header = file.read(10)
           file.seek(0)
           if mime == "application/pdf" and not header.startswith(b"%PDF"):
               return False
           if mime == "image/png" and not header.startswith(b"\x89PNG"):
               return False
           if mime == "image/jpeg" and header[:2] != b"\xff\xd8":
               return False
       except Exception:
           return False
       return True