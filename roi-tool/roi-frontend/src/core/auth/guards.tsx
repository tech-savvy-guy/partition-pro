import * as React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/core/auth/authContext";
import { Permission } from "@/core/rbac/permissions.enum";
import { canGlobal } from "@/core/rbac";

// Require authentication only
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Easy Auth / Okta handles login redirect
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Require specific permissions (PREFERRED)

export const RequirePermission: React.FC<{
  permissions: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ permissions, children, fallback = null }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated || !user) return <Navigate to="/" replace />;

  const hasAll = permissions.every((p) => canGlobal(user, p));

  if (!hasAll) {
    return fallback ?? <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

//OPTIONAL: Require backend roleId
// (use sparingly)

export const RequireRoleId: React.FC<{
  roleId: string;
  children: React.ReactNode;
}> = ({ roleId, children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated || !user) return <Navigate to="/" replace />;

  if (user.roleId !== roleId) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
