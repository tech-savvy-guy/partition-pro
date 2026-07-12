import * as React from "react"

import { GlobalErrorFallback } from "./global-error-fallback"

type State = {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  capturedAt: string | null
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = {
    error: null,
    errorInfo: null,
    capturedAt: null,
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      error,
      errorInfo: null,
      capturedAt: new Date().toISOString(),
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info })
    console.error("Unhandled application error:", error, info)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = "/"
  }

  render() {
    const { error, errorInfo, capturedAt } = this.state

    if (!error || !capturedAt) {
      return this.props.children
    }

    return (
      <GlobalErrorFallback
        error={error}
        errorInfo={errorInfo}
        capturedAt={capturedAt}
        onReload={this.handleReload}
        onGoHome={this.handleGoHome}
      />
    )
  }
}
