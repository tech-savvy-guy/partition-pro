from django.utils import timezone
from django.contrib.auth.hashers import make_password
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from ..models import Role

User = get_user_model()

class HealthCheckView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        
        return Response(
            {
                "success": True,
                "message": "Ping successfully",
                
            },
            status=200,
        )
