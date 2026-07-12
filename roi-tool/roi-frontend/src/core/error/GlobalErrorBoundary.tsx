import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class GlobalErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Global Error Boundary Caught:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center h-[80vh] text-center px-4">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-6 max-w-md">
              An unexpected error occurred. Try refreshing the page or return to
              the dashboard.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md"
              >
                Reload App
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
