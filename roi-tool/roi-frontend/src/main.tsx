import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import "./index.css";
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

import { queryClient } from "@/core/auth/queryClient";
import { AuthProvider } from "@/core/auth/authContext";
import { UIProvider } from "@/core/ui";
import { GlobalErrorBoundary } from "@/core/error/GlobalErrorBoundary";

import MainLayout from "@/layout/MainLayout";

// Pages
import Dashboard from "@/pages/dashboard/Dashboard";
import Case from "@/pages/Case/Case";
import CaseManagement from "@/pages/Case/CaseManagement/CaseManagement";
import ViewFile from "@/pages/Case/CaseManagement/CaseManagementHelper/ViewFile";
import Archive from "@/pages/Case/CaseArchive/CaseArchive";
import Partitions from "@/pages/Case/Partitions/Partitions";
import Workflow from "@/pages/Case/Partitions/WorkFlow/Workflow";
import Settings from "@/pages/settings/Settings";
import About from "@/pages/About/About";

import NoAccess from "@/pages/NoAccess";
import { RequirePermission } from "./core/auth/guards";
import { Permission } from "./core/rbac";
import Forbidden from "./pages/error/forbidden";
import CaseLayout from "./layout/CaseLayout";
import { RequireCasePermission } from "./core/case/RequireCasePermission";
import CasePermissionRoute from "./core/case/case-permissions/CasePermissoinRoute";
import UploadData from "./pages/Case/CaseManagement/CaseManagementHelper/UploadData";
import LogoutPage from "./pages/Logout";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GlobalErrorBoundary>
          <Routes>
            {/* PUBLIC ROUTES (NO AUTH, NO LAYOUT) */}
            <Route path="/no-access" element={<NoAccess />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* PROTECTED APP */}
            <Route
              path="/*"
              element={
                <AuthProvider>
                  <UIProvider>
                    <MainLayout />
                  </UIProvider>
                </AuthProvider>
              }
            >
              {/* index route */}
              <Route index element={<Navigate to="dashboard" replace />} />

              {/* relative paths only */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route
                path="upload-data"
                element={
                  <RequirePermission permissions={[Permission.EditCases]}>
                    <UploadData />
                  </RequirePermission>
                }
              />
              <Route
                path="cases/:id/files/:fileId/view"
                element={
                  <RequirePermission permissions={[Permission.ViewFiles]}>
                    <ViewFile />
                  </RequirePermission>
                }
              />
              <Route
                path="cases"
                element={
                  <RequirePermission permissions={[Permission.ViewCases]}>
                    <Case />
                  </RequirePermission>
                }
              />
              <Route
                path="cases/new"
                element={
                  <RequirePermission permissions={[Permission.CreateCases]}>
                      <CaseManagement />
                  </RequirePermission>
                }
              />
              <Route
                path="cases/:id/edit"
                element={
                  <RequirePermission permissions={[Permission.EditCases]}>
                    <CasePermissionRoute>
                      <CaseManagement />
                    </CasePermissionRoute>
                  </RequirePermission>
                }
              />
              <Route path="cases" element={<CaseLayout />}>
                <Route
                  path=":caseId/partitions"
                  element={
                    <RequireCasePermission
                      permission={Permission.ViewPartitions}
                    >
                      <Partitions />
                    </RequireCasePermission>
                  }
                />
                <Route
                  path=":caseId/partitions/:partitionId/workflow"
                  element={
                    <RequireCasePermission
                      permission={Permission.ViewWorkflows}
                    >
                      <Workflow />
                    </RequireCasePermission>
                  }
                />
              </Route>
              <Route
                path="archive"
                element={
                  <RequirePermission permissions={[Permission.ViewCases]}>
                    <Archive />
                  </RequirePermission>
                }
              />
              <Route path="about" element={<About />} />
              <Route
                path="settings"
                element={
                  <RequirePermission permissions={[Permission.ViewUsers]}>
                    <Settings />
                  </RequirePermission>
                }
              />
            </Route>
            <Route path="/forbidden" element={<Forbidden />} />
          </Routes>
        </GlobalErrorBoundary>

        <ReactQueryDevtools initialIsOpen={false} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
