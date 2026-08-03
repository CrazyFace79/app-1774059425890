import Head from "next/head";
import { useEffect, useRef, useState } from "react";
import {
  canContinuousScan,
  formatKind,
  formatSignal,
  isBluetoothAvailable,
  pickNearbyDevice,
  startContinuousScan,
  type ContinuousScanSession,
  type NearbyDevice,
} from "../lib/bluetooth";

type SupportState =
  | { status: "checking" }
  | { status: "ready"; continuous: boolean }
  | { status: "unsupported"; message: string };

function sortDevices(devices: NearbyDevice[]) {
  return [...devices].sort((a, b) => {
    const aRssi = a.rssi ?? -999;
    const bRssi = b.rssi ?? -999;
    if (aRssi !== bRssi) {
      return bRssi - aRssi;
    }
    return b.lastSeen - a.lastSeen;
  });
}

function upsertDevice(list: NearbyDevice[], next: NearbyDevice) {
  const index = list.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return sortDevices([next, ...list]);
  }

  const copy = [...list];
  copy[index] = {
    ...copy[index],
    ...next,
    name: next.name !== "Dispositivo sin nombre" ? next.name : copy[index].name,
    rssi: next.rssi ?? copy[index].rssi,
    signal: next.signal ?? copy[index].signal,
    uuids: next.uuids.length ? next.uuids : copy[index].uuids,
  };
  return sortDevices(copy);
}

function relativeTime(timestamp: number, now: number) {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return "ahora";
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `hace ${minutes} min`;
}

export default function Home() {
  const [support, setSupport] = useState<SupportState>({ status: "checking" });
  const [devices, setDevices] = useState<NearbyDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const scanRef = useRef<ContinuousScanSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSupport() {
      const available = await isBluetoothAvailable();
      if (cancelled) return;

      if (!available) {
        setSupport({
          status: "unsupported",
          message:
            "Bluetooth no está disponible en este dispositivo o navegador. Usa Chrome o Edge en un móvil/PC con Bluetooth.",
        });
        return;
      }

      setSupport({
        status: "ready",
        continuous: canContinuousScan(),
      });
    }

    checkSupport();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      scanRef.current?.stop();
      scanRef.current = null;
    };
  }, []);

  async function handleIdentify() {
    setError("");
    setBusy(true);

    try {
      const device = await pickNearbyDevice();
      setDevices((current) => upsertDevice(current, device));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo identificar el dispositivo.";
      if (!/cancelled|canceled|user/i.test(message)) {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleScan() {
    setError("");

    if (scanning) {
      scanRef.current?.stop();
      scanRef.current = null;
      setScanning(false);
      return;
    }

    setBusy(true);
    try {
      const session = await startContinuousScan((device) => {
        setDevices((current) => upsertDevice(current, device));
      });
      scanRef.current = session;
      setScanning(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo iniciar el escaneo.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function clearDevices() {
    setDevices([]);
    setError("");
  }

  const ready = support.status === "ready";

  return (
    <>
      <Head>
        <title>CERCA — dispositivos cerca de ti</title>
        <meta
          name="description"
          content="Identifica dispositivos Bluetooth cercanos desde el navegador."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page">
        <section className="hero" aria-labelledby="brand">
          <div className="hero-copy">
            <p className="brand" id="brand">
              CERCA
            </p>
            <h1>Identifica qué hay a tu alrededor</h1>
            <p className="lede">
              Escanea Bluetooth y guarda el nombre de cada dispositivo cercano
              para reconocerlo al momento.
            </p>

            <div className="actions">
              <button
                className="btn primary"
                disabled={!ready || busy}
                onClick={handleIdentify}
                type="button"
              >
                {busy && !scanning ? "Abriendo selector…" : "Identificar dispositivo"}
              </button>

              {ready && support.continuous ? (
                <button
                  className={`btn ghost ${scanning ? "live" : ""}`}
                  disabled={busy && !scanning}
                  onClick={handleToggleScan}
                  type="button"
                >
                  {scanning ? "Detener escaneo" : "Escanear al rededor"}
                </button>
              ) : null}
            </div>

            {support.status === "unsupported" ? (
              <p className="status warn">{support.message}</p>
            ) : null}
            {support.status === "checking" ? (
              <p className="status">Comprobando Bluetooth…</p>
            ) : null}
            {error ? <p className="status warn">{error}</p> : null}
          </div>

          <div className="radar" aria-hidden="true">
            <div className={`ring r1 ${scanning ? "pulse" : ""}`} />
            <div className={`ring r2 ${scanning ? "pulse" : ""}`} />
            <div className={`ring r3 ${scanning ? "pulse" : ""}`} />
            <div className="sweep" />
            <div className="core">
              <span>{devices.length}</span>
              <small>cerca</small>
            </div>
          </div>
        </section>

        <section className="results" aria-labelledby="results-title">
          <div className="results-head">
            <div>
              <h2 id="results-title">Dispositivos detectados</h2>
              <p>
                {devices.length === 0
                  ? "Aún no hay ninguno. Pulsa identificar y elige un dispositivo del listado del sistema."
                  : `${devices.length} identificado${devices.length === 1 ? "" : "s"}.`}
              </p>
            </div>
            {devices.length > 0 ? (
              <button className="btn text" onClick={clearDevices} type="button">
                Limpiar lista
              </button>
            ) : null}
          </div>

          {devices.length === 0 ? (
            <div className="empty">
              <p>
                Tip: en el selector del navegador verás auriculares, móviles,
                relojes, TVs y otros aparatos que estén anunciándose por
                Bluetooth cerca de ti.
              </p>
            </div>
          ) : (
            <ul className="device-list">
              {devices.map((device) => (
                <li key={device.id}>
                  <div className="device-main">
                    <strong>{device.name}</strong>
                    <span>{formatKind(device.kind)}</span>
                  </div>
                  <div className="device-meta">
                    <span className={`signal ${device.signal ?? "unknown"}`}>
                      {formatSignal(device.signal)}
                      {typeof device.rssi === "number" ? ` (${device.rssi} dBm)` : ""}
                    </span>
                    <span>visto {relativeTime(device.lastSeen, now)}</span>
                    <span className="id">ID {device.id.slice(0, 10)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="footnote">
            Funciona con Web Bluetooth en Chrome/Edge (HTTPS o localhost). El
            escaneo continuo solo aparece si el navegador lo permite; si no,
            identifica aparatos uno a uno con el selector del sistema.
          </p>
        </section>
      </main>

      <style jsx>{`
        .page {
          margin: 0 auto;
          max-width: 1100px;
          padding: 28px 20px 64px;
        }

        .hero {
          align-items: center;
          display: grid;
          gap: 36px;
          grid-template-columns: 1.1fr 0.9fr;
          min-height: calc(100vh - 56px);
          padding-bottom: 24px;
        }

        .brand {
          color: var(--amber-soft);
          font-family: "Fraunces", serif;
          font-size: clamp(3.4rem, 9vw, 6.4rem);
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 0.9;
          margin-bottom: 18px;
        }

        h1 {
          font-family: "Fraunces", serif;
          font-size: clamp(1.7rem, 3.6vw, 2.5rem);
          font-weight: 500;
          letter-spacing: -0.02em;
          line-height: 1.15;
          max-width: 14ch;
        }

        .lede {
          color: var(--mist);
          font-size: 1.05rem;
          margin-top: 14px;
          max-width: 34ch;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }

        .btn {
          border: 1px solid transparent;
          border-radius: 999px;
          cursor: pointer;
          padding: 14px 22px;
          transition:
            transform 180ms ease,
            background 180ms ease,
            border-color 180ms ease,
            opacity 180ms ease;
        }

        .btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .btn:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .btn.primary {
          background: linear-gradient(135deg, var(--amber) 0%, #f0c56a 100%);
          color: var(--ink);
          font-weight: 700;
        }

        .btn.ghost {
          background: rgba(231, 241, 234, 0.06);
          border-color: var(--line);
          color: var(--fog);
        }

        .btn.ghost.live {
          border-color: rgba(125, 255, 179, 0.45);
          box-shadow: 0 0 0 4px rgba(125, 255, 179, 0.08);
          color: var(--signal);
        }

        .btn.text {
          background: transparent;
          color: var(--amber-soft);
          padding: 8px 0;
        }

        .status {
          color: var(--mist);
          font-size: 0.92rem;
          margin-top: 16px;
        }

        .status.warn {
          color: var(--danger);
        }

        .radar {
          aspect-ratio: 1;
          isolation: isolate;
          margin: 0 auto;
          max-width: 420px;
          position: relative;
          width: min(100%, 420px);
        }

        .ring {
          border: 1px solid rgba(125, 255, 179, 0.18);
          border-radius: 50%;
          inset: 12%;
          position: absolute;
        }

        .r1 {
          inset: 8%;
        }

        .r2 {
          inset: 22%;
        }

        .r3 {
          inset: 36%;
        }

        .ring.pulse {
          animation: breathe 2.8s ease-in-out infinite;
        }

        .r2.pulse {
          animation-delay: 0.35s;
        }

        .r3.pulse {
          animation-delay: 0.7s;
        }

        .sweep {
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(224, 162, 58, 0.28) 48deg,
            transparent 70deg
          );
          border-radius: 50%;
          inset: 8%;
          position: absolute;
          animation: spin 6s linear infinite;
        }

        .core {
          align-items: center;
          background: radial-gradient(circle at 35% 30%, #2f8f6d, var(--pine-deep));
          border: 1px solid rgba(125, 255, 179, 0.35);
          border-radius: 50%;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          height: 28%;
          justify-content: center;
          left: 50%;
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 28%;
        }

        .core span {
          font-family: "Fraunces", serif;
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 700;
          line-height: 1;
        }

        .core small {
          color: var(--mist);
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .results {
          border-top: 1px solid var(--line);
          padding-top: 36px;
        }

        .results-head {
          align-items: end;
          display: flex;
          gap: 16px;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .results h2 {
          font-family: "Fraunces", serif;
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 500;
        }

        .results-head p {
          color: var(--mist);
          margin-top: 6px;
        }

        .empty {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 20px;
          color: var(--mist);
          padding: 22px;
        }

        .device-list {
          display: grid;
          gap: 12px;
          list-style: none;
        }

        .device-list li {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          display: grid;
          gap: 10px;
          padding: 18px 18px 16px;
        }

        .device-main {
          align-items: baseline;
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          justify-content: space-between;
        }

        .device-main strong {
          font-size: 1.12rem;
          font-weight: 700;
        }

        .device-main span {
          color: var(--amber-soft);
          font-size: 0.92rem;
        }

        .device-meta {
          color: var(--mist);
          display: flex;
          flex-wrap: wrap;
          font-size: 0.86rem;
          gap: 8px 16px;
        }

        .signal.fuerte {
          color: var(--signal);
        }

        .signal.media {
          color: var(--amber-soft);
        }

        .signal.debil,
        .signal.unknown {
          color: var(--mist);
        }

        .id {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          opacity: 0.8;
        }

        .footnote {
          color: rgba(231, 241, 234, 0.55);
          font-size: 0.82rem;
          margin-top: 22px;
          max-width: 70ch;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes breathe {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }

        @media (max-width: 860px) {
          .hero {
            grid-template-columns: 1fr;
            min-height: auto;
            padding-top: 18px;
          }

          .radar {
            order: -1;
            max-width: 280px;
          }

          h1 {
            max-width: none;
          }

          .results-head {
            align-items: start;
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
