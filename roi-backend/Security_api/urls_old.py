from django.urls import path, include
from Security_api.Views.login import GetUserDetailsApiView
from Security_api.Views.AzureToken import AzureTokenApiView
from Security_api.Views.ProductLibrary import ProductLibraryApiView
from Security_api.Views.Vendors import VendorsApiView
from Security_api.Views.NewUser import NewUserApiView
from Security_api.Views.ClientDetails import ClientDetailsApiView
from Security_api.Views.UpdateProductLibrary import UpdateProductLibraryApiView
from Security_api.Views.ComplianceReport import ComplianceReportApiView
from Security_api.Views.ComplianceEngine import ComplianceEngineApiView
from Security_api.Views.ComplianceEngineAdhoc import ComplianceEngineAdhocApiView
from Security_api.Views.ComplianceReportUpdate import ComplianceReportUpdateApiView
from Security_api.Views.GenerateElpReport import GenerateElpReportApiView
from Security_api.Views.NewProduct import NewProductApiView
from Security_api.Views.logout_user import LogoutUserApiView
from Security_api.Views.TwoFactor import TwoFactorAPIView
from Security_api.Views.RefreshPowerBI import RefreshPowerBIApiView
from Security_api.Views.RefreshStatusPowerBI import RefreshStatusPowerBIApiView
from Security_api.Views.UpdateModules import UpdateModulesApiView
from Security_api.Views.UpdatePassword import UpdatePasswordApiView
from Security_api.Views.Notifications import NotificationsApiView
from Security_api.Views.UpdateUserDetails import UpdateUserDetailsApiView
from Security_api.Views.HardwareLibrary import HardwareLibraryApiView
from Security_api.Views.TrackerReport import TrackerReportApiView
from Security_api.Views.UploadTracker import UploadTrackerApiView
from Security_api.Views.UpdateTracker import TrackerReportUpdateApiView
from Security_api.Views.HomeDashboardData import HomeDashboardDataApiView


urlpatterns = [
    path('getuserdetails', GetUserDetailsApiView.as_view()),
    path('twofactor', TwoFactorAPIView.as_view()),
    path('getazuretoken', AzureTokenApiView.as_view()),
    path('refreshpowerbireport', RefreshPowerBIApiView.as_view()),
    path('refreshstatuspowerbireport', RefreshStatusPowerBIApiView.as_view()),
path('getproductlibrary', ProductLibraryApiView.as_view()),
path('updatevendorsinscope', VendorsApiView.as_view()),
path('updatemodulesinscope', UpdateModulesApiView.as_view()),
path('addnewuser', NewUserApiView.as_view()),
path('updateclientdetails', ClientDetailsApiView.as_view()),
path('updateitemproductlibrary', UpdateProductLibraryApiView.as_view()),
path('getcompliancereport', ComplianceReportApiView.as_view()),
path('getcomplainceenginedetails', ComplianceEngineApiView.as_view()),
path('adhoccomplianceengine', ComplianceEngineAdhocApiView.as_view()),
path('updatecompliancereport', ComplianceReportUpdateApiView.as_view()),
path('updatecomplianceengineconfig', ComplianceEngineApiView.as_view()),
path('addnewproduct', NewProductApiView.as_view()),
path('logoutuser', LogoutUserApiView.as_view()),
path('updatepassword', UpdatePasswordApiView.as_view()),
path('getnotificationdetails', NotificationsApiView.as_view()),
path('updateuserdetails', UpdateUserDetailsApiView.as_view()),
path('gethardwarelibrary', HardwareLibraryApiView.as_view()),
path('getelpdata', GenerateElpReportApiView.as_view()),
path('gettrackerreport', TrackerReportApiView.as_view()),
path('uploadtrackerreport', UploadTrackerApiView.as_view()),
path('updatetrackerreport', TrackerReportUpdateApiView.as_view()),
path('homedashboarddata',HomeDashboardDataApiView.as_view())
]