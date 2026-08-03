"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#050505",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.2em",
              color: "#f59e0b",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Unexpected error
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
            The application could not load.
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 24,
            }}
          >
            This is usually caused by a temporary connection issue. Please try again.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#10b981",
                color: "#022c22",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#ffffff",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Back to login
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
