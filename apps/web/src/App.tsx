import { useEffect, useState } from "react";

type HealthPayload = { status: string; db: string };
type State =
  | { kind: "loading" }
  | { kind: "ok"; payload: HealthPayload }
  | { kind: "error"; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/health", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as HealthPayload;
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} - db: ${payload.db}`);
        }
        setState({ kind: "ok", payload });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : "erreur inconnue",
        });
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.5 }}>
      <h1 style={{ fontSize: "1.25rem", margin: 0 }}>THM Roadmap</h1>
      <p style={{ color: "#555", marginTop: "0.25rem" }}>
        Socle phase 1. Sonde <code>GET /health</code> via le proxy Vite.
      </p>

      {state.kind === "loading" && <p>Verification de l'API...</p>}

      {state.kind === "error" && (
        <p role="alert" style={{ color: "#b00020" }}>
          API injoignable : {state.message}
        </p>
      )}

      {state.kind === "ok" && (
        <pre
          style={{
            background: "#f4f4f5",
            border: "1px solid #d4d4d8",
            borderRadius: 6,
            padding: "0.75rem",
            width: "fit-content",
          }}
        >
          {JSON.stringify(state.payload, null, 2)}
        </pre>
      )}
    </main>
  );
}
