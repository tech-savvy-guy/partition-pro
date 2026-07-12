import * as React from "react";
import { Locked } from "@carbon/icons-react";
import { Button } from "@bain/design-system";
import { authService } from "@/core/auth/authService";

const SUPPORT_EMAIL = "partitionpro-admin@bain.com";
const REDIRECT_SECONDS = 10;

export default function NoAccess() {
  const [secondsLeft, setSecondsLeft] = React.useState(REDIRECT_SECONDS);
  const signOutStartedRef = React.useRef(false);

  const signOut = React.useCallback(async () => {
    if (signOutStartedRef.current) return;
    signOutStartedRef.current = true;

    // Open support email draft in a new tab and continue logout flow.
    window.open(`mailto:${SUPPORT_EMAIL}`, "_blank");
    await authService.logout();
  }, []);

  // Prevent duplicate execution in React StrictMode
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const tick = (remaining: number) => {
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        void signOut();
        return;
      }

      window.setTimeout(() => {
        tick(remaining - 1);
      }, 1000);
    };

    tick(REDIRECT_SECONDS);
  }, [signOut]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 relative">
      {/* Main No Access content */}
      <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <Locked size={24} className="text-red-600" />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Access Restricted
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          Your account is not authorized to access PartitionPro.
          <br />
          You will be signed out automatically.
        </p>

        <Button
          kind="secondary"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out now
        </Button>
      </div>

      {/* Non-blocking toast in bottom-right */}
      <div className="fixed bottom-6 right-6 z-[9999] w-[340px]">
        <div className="bg-white rounded-lg shadow-lg border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-gray-200 border-t-red-600 animate-spin" />

            <div>
              <p className="text-sm font-semibold text-gray-900">
                Signing you out
              </p>
              <p className="text-xs text-gray-600">
                Redirecting in{" "}
                <span className="font-semibold">{secondsLeft}</span> seconds
              </p>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500">
            After sign-out, an email window will open so you can request access.
          </p>
        </div>
      </div>
    </div>
  );
}
