"use client"
import * as React from "react"
import { useSearchParams } from "next/navigation"

function UnsubscribeContent() {
  const params = useSearchParams()
  const token = params.get("token") ?? ""
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle")

  async function handleUnsubscribe() {
    setStatus("loading")
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (res.ok) setStatus("done")
      else setStatus("error")
    } catch {
      setStatus("error")
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#f9fafb" }}>
      <div style={{ maxWidth: 400, width: "100%", background: "#fff", borderRadius: 12, padding: 40, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", textAlign: "center" }}>
        {status === "done" ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>You&apos;ve been unsubscribed</h1>
            <p style={{ color: "#6b7280", fontSize: 14 }}>You won&apos;t receive any more marketing emails from us.</p>
          </>
        ) : status === "error" ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: "#6b7280", fontSize: 14 }}>Please try again or contact support.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Unsubscribe</h1>
            <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>You are about to unsubscribe from our marketing emails. This action cannot be undone.</p>
            <button
              onClick={handleUnsubscribe}
              disabled={status === "loading"}
              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 500, cursor: "pointer", width: "100%" }}
            >
              {status === "loading" ? "Processing..." : "Confirm Unsubscribe"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <UnsubscribeContent />
    </React.Suspense>
  )
}
