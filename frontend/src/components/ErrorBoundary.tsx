/**
 * src/components/ErrorBoundary.tsx — Error Boundary genérico (spec,
 * sección 11: "Error Boundary en ResultPanel/GraphViewer"). Componente de
 * clase (requisito de React para `componentDidCatch`), con reintento.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary capturó un error:", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200"
        >
          <p>{this.props.fallbackLabel ?? "Ocurrió un error al mostrar este contenido."}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-2 rounded bg-red-800/60 px-3 py-1 text-red-100 hover:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
