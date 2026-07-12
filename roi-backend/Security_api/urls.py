from django.urls import path
from Security_api.Views.health import HealthCheckView
from rest_framework_simplejwt.views import TokenRefreshView
from Security_api.Views.roles import CreateRoleView, UpdateRoleView, DeleteRoleView, GetRolesView
from Security_api.Views.user_details import CreateUserView, GetUsersView, UpdateUserView, DeleteUserView
from Security_api.Views.login import LoginUserView,MeView

from Security_api.Views.logout_user import LogoutUserApiView, LogoutAllView



urlpatterns = [
    path('login', LoginUserView.as_view(), name='login'),
    path('me', MeView.as_view(), name='me'),
    path('logout', LogoutUserApiView.as_view(), name='logout'),
    path("logout-all", LogoutAllView.as_view(), name="logout_all"),
    path('token/refresh', TokenRefreshView.as_view(), name='token_refresh'),

    path("users", GetUsersView.as_view(), name="list_users"),
    path("users/create", CreateUserView.as_view(), name="create_user"),
    path("users/<uuid:user_id>/update", UpdateUserView.as_view(), name="update_user"),
    path("users/<uuid:user_id>/delete", DeleteUserView.as_view(), name="delete_user"),

    path("roles", GetRolesView.as_view(), name="list_roles"),
    path("roles/create", CreateRoleView.as_view(), name="create_role"),
    path("roles/<uuid:role_id>/update", UpdateRoleView.as_view(), name="update_role"),
    path("roles/<uuid:role_id>/delete", DeleteRoleView.as_view(), name="delete_role"),
    
    path("health", HealthCheckView.as_view(), name="health_check"),


]