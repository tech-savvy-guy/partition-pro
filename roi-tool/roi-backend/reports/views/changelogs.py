from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from reports.models import Changelogs
from utilities.custom_logger import get_file_logger

logger = get_file_logger()


class ChangelogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get latest changelogs (default: last 5)
        Optional query param: ?limit=10
        """
        limit = int(request.GET.get("limit", 5))

        changelogs = (
            Changelogs.objects
            .all()
            .order_by("-created_on")[:limit]
        )

        results = []
        for c in changelogs:
            results.append({
                "id": str(c.id),
                "heading": c.heading,
                "description": c.description,
                "created_on": c.created_on.isoformat(),
                "created_by": c.created_by,
            })

        return Response(
            {"results": results},
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        """
        Create a new changelog entry
        """
        user = request.user
        data = request.data

        required = ["heading", "description"]
        missing = [f for f in required if f not in data]

        if missing:
            return Response(
                {"error": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            changelog = Changelogs.objects.create(
                created_on=timezone.now(),
                created_by=user.email,
                heading=data["heading"],
                description=data["description"],
            )
        except Exception as e:
            logger.exception("Changelog creation failed")
            return Response(
                {"error": "Changelog creation failed", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "success": True,
                "id": str(changelog.id),
                "heading": changelog.heading,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, changelog_id):
        """
        Delete a changelog entry
        """
        try:
            changelog = Changelogs.objects.get(id=changelog_id)
        except Changelogs.DoesNotExist:
            return Response(
                {"error": "Changelog not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            changelog.delete()
        except Exception as e:
            logger.exception("Changelog delete failed")
            return Response(
                {"error": "Failed to delete changelog", "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {"success": True, "message": "Changelog deleted"},
            status=status.HTTP_200_OK,
        )
