"use client";

import * as React from "react";
import { RiErrorWarningLine, RiRefreshLine } from "@remixicon/react";

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 px-10 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive-subtle">
            <RiErrorWarningLine size={24} className="text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Something went wrong</p>
            <p className="mt-1 max-w-sm text-sm text-foreground-muted">
              {this.state.message || "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
          >
            <RiRefreshLine size={15} />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
