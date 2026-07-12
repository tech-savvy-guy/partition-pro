import { Button } from "@bain/design-system";
import { useNavigate } from "react-router-dom";

export default function Forbidden() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] text-center">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">403</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-2">
        Access Forbidden
      </h2>
      <p className="text-gray-500 mb-6 max-w-md">
        You don’t have permission to access this page. Please contact your
        administrator if you believe this is an error.
      </p>

      <Button kind="primary" onClick={() => navigate("/")}>
        Go to Dashboard
      </Button>
    </div>
  );
}
