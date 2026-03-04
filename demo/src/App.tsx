import { useEffect, useState } from "react";
import { AdvancedDemo } from "./AdvancedDemo";
import { SimpleDemo } from "./SimpleDemo";

type DemoMode = "simple" | "advanced";

const apiToken = import.meta.env.VITE_CAMERA_KIT_API_TOKEN;
const lensId = import.meta.env.VITE_LENS_ID;
const lensGroupId = import.meta.env.VITE_LENS_GROUP_ID;

function readModeFromHash(): DemoMode {
  return window.location.hash === "#/advanced" ? "advanced" : "simple";
}

function SetupRequired() {
  return (
    <section className="card setup-card">
      <h2>Missing Environment Variables</h2>
      <p>
        Configure these values in <code>demo/.env</code>:
      </p>
      <pre className="env-block">
        VITE_CAMERA_KIT_API_TOKEN=...
        {"\n"}VITE_LENS_ID=...
        {"\n"}VITE_LENS_GROUP_ID=...
      </pre>
    </section>
  );
}

export function App() {
  const [mode, setMode] = useState<DemoMode>(() => {
    if (typeof window === "undefined") return "simple";
    return readModeFromHash();
  });

  useEffect(() => {
    function onHashChange() {
      setMode(readModeFromHash());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <main className={`page page-${mode}`}>
      <header className="hero">
        <div className="hero-top">
          <div>
            <p className="eyebrow">React Camera Kit</p>
            <h1>Web Demo</h1>
          </div>
          <nav className="mode-nav" aria-label="Demo mode">
            <a href="#/" className={mode === "simple" ? "active" : ""}>
              Simple
            </a>
            <a href="#/advanced" className={mode === "advanced" ? "active" : ""}>
              Advanced
            </a>
          </nav>
        </div>
        <p className="subhead">
          One live sample for showcase, plus an optional advanced mode for status, controls, and diagnostics.
        </p>
      </header>

      {!apiToken || !lensId || !lensGroupId ? (
        <SetupRequired />
      ) : (
        <>
          {mode === "advanced" ? (
            <AdvancedDemo apiToken={apiToken} lensGroupId={lensGroupId} />
          ) : (
            <SimpleDemo apiToken={apiToken} lensId={lensId} lensGroupId={lensGroupId} />
          )}
        </>
      )}
    </main>
  );
}
