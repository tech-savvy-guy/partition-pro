from django.http import JsonResponse

def health(request):
    """Simple health-check endpoint."""
    return JsonResponse({"status": "ok"})
