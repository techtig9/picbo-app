"use client";

import { useState } from "react";

type LogEntry = { label: string; ok: boolean; body: unknown };

export default function TestPage() {
  const [name, setName] = useState("Ayesha Khan");
  const [email, setEmail] = useState("ayesha@test.local");
  const [password, setPassword] = useState("testpassword123");
  const [prompt, setPrompt] = useState("cinematic product shot of a watch on marble");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  async function call(label: string, url: string, options?: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
      });
      const body = await res.json().catch(() => ({}));
      setLog((prev) => [{ label: `${label} → ${res.status}`, ok: res.ok, body }, ...prev]);
      return { ok: res.ok, body };
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px", lineHeight: 1.5 }}>
      <h1>Picbo.ai backend — manual test page</h1>
      <p style={{ color: "#555" }}>
        This is a plain functional test harness, not the real product UI (that's the polished
        19-page static frontend in <code>picbo/</code>). Every button here calls a real API route
        that reads and writes to a real database. Open your browser&apos;s dev tools → Network
        tab to watch the actual requests.
      </p>

      <section style={{ marginTop: 30, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ fontSize: 16 }}>1. Register</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={inputStyle} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          style={inputStyle}
        />
        <button
          disabled={busy}
          style={btnStyle}
          onClick={() =>
            call("Register", "/api/auth/register", {
              method: "POST",
              body: JSON.stringify({ name, email, password }),
            })
          }
        >
          Register (grants 500 real credits)
        </button>
        <button
          disabled={busy}
          style={btnStyle}
          onClick={() =>
            call("Login", "/api/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, password }),
            })
          }
        >
          Login
        </button>
        <button
          disabled={busy}
          style={btnStyle}
          onClick={() => call("Logout", "/api/auth/logout", { method: "POST" })}
        >
          Logout
        </button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ fontSize: 16 }}>2. Check session &amp; real credit balance</h2>
        <button disabled={busy} style={btnStyle} onClick={() => call("Me", "/api/me")}>
          GET /api/me
        </button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ fontSize: 16 }}>3. Generate (real job + real credit deduction, mock image)</h2>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} style={inputStyle} />
        <button
          disabled={busy}
          style={btnStyle}
          onClick={() =>
            call("Generate photo", "/api/generate/photo", {
              method: "POST",
              body: JSON.stringify({ prompt, complexity: "simple" }),
            })
          }
        >
          Generate (−40 credits)
        </button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ fontSize: 16 }}>4. Admin (only works if this user&apos;s role is &quot;admin&quot;)</h2>
        <button disabled={busy} style={btnStyle} onClick={() => call("Admin users", "/api/admin/users")}>
          GET /api/admin/users
        </button>
      </section>

      <h2 style={{ marginTop: 30, fontSize: 16 }}>Request log (most recent first)</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {log.map((entry, i) => (
          <pre
            key={i}
            style={{
              background: entry.ok ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${entry.ok ? "#86efac" : "#fca5a5"}`,
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              overflowX: "auto",
              margin: 0,
            }}
          >
            {entry.label}
            {"\n"}
            {JSON.stringify(entry.body, null, 2)}
          </pre>
        ))}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 8,
  marginBottom: 8,
  border: "1px solid #ccc",
  borderRadius: 6,
  boxSizing: "border-box",
};

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  marginRight: 8,
  marginTop: 4,
  border: "1px solid #333",
  borderRadius: 6,
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
