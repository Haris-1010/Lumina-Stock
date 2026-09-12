"use client"; // Error boundaries must be Client Components

// Last-resort boundary for errors thrown in the root layout/providers.
// Replaces the root layout when active, so it must render its own <html>/<body>
// and use inline styles only (the app stylesheet may not have loaded).
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#090f1a",
          color: "#e6e9ef",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#94a3b8", margin: "0 0 20px" }}>
            The page failed to load. This is usually temporary — please try again.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              padding: "10px 24px",
              background: "#059669",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error?.digest ? (
            <p style={{ fontSize: 11, color: "#475569", marginTop: 16 }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
