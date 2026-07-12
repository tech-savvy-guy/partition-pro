import * as React from "react";
import { InlineLoading } from "@bain/design-system";
import { authService } from "@/core/auth/authService";

export default function LogoutPage() {

  React.useEffect(() => {
    authService.logout();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <InlineLoading description="Signing you out…" />
        <p className="text-sm text-gray-600">
          Please wait while we securely sign you out.
        </p>
      </div>
    </div>
  );
}
