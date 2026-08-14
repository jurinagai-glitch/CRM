import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

type SessionUser = { id: string; email: string; name: string | null; role: string };

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { user: SessionUser }) => setStatus(data.user ? "authed" : "anon"))
      .catch(() => setStatus("anon"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      setStatus("authed");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f3ec", color: "#6a7372" }}>読み込み中...</div>;
  }

  if (status === "anon") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f3ec" }}>
        <form onSubmit={submit} style={{ width: 320, padding: 32, background: "#fffdf8", border: "1px solid #dedbd2", borderRadius: 10, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, color: "#16324f", fontFamily: "'Noto Serif JP', serif" }}>Relay CRM</h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6a7372" }}>ログインしてください</p>
          </div>
          <label style={{ fontSize: 12, color: "#52605f" }}>
            メールアドレス
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #dedbd2", borderRadius: 6, fontSize: 13 }}
            />
          </label>
          <label style={{ fontSize: 12, color: "#52605f" }}>
            パスワード
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #dedbd2", borderRadius: 6, fontSize: 13 }}
            />
          </label>
          {error && <p style={{ margin: 0, fontSize: 12, color: "#b54b42" }}>{error}</p>}
          <Button type="submit" className="ink-button" disabled={submitting}>
            {submitting ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
