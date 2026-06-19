import Head from "next/head";
import { useMemo, useState } from "react";

type Coordinates = {
  lat: number;
  lng: number;
};

type Place = Coordinates & {
  name: string;
};

type LocationState =
  | { status: "idle" | "loading"; coords: null; message: string }
  | { status: "ready"; coords: Coordinates; message: string }
  | { status: "error"; coords: null; message: string };

const fallbackPlaces: Place[] = [
  { name: "Torrevieja", lat: 37.97872, lng: -0.68222 },
  { name: "La Manga", lat: 37.74156, lng: -0.73438 },
];

const defaultTarget = fallbackPlaces[0];

const cleanPhone = (phone: string) => phone.replace(/[^\d+]/g, "");
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function distanceInMeters(from: Coordinates, to: Coordinates) {
  const earthRadius = 6371000;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const originLat = toRadians(from.lat);
  const targetLat = toRadians(to.lat);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(meters / 1000).toFixed(meters > 10000 ? 0 : 1)} km`;
}

function parseTargetFromUrl(): Place | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    name: params.get("name") || "Ubicacion de tu colega",
  };
}

function isShareMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("share") === "1";
}

function senderPhoneFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("from") || "";
}

function buildAppUrl(params: Record<string, string>) {
  const url = new URL(window.location.origin + window.location.pathname);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

function mapsUrl(target: Coordinates) {
  return `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;
}

function whatsAppUrl(phone: string, message: string) {
  const normalized = cleanPhone(phone).replace(/^\+/, "");
  const base = normalized ? `https://wa.me/${normalized}` : "https://wa.me/";

  return `${base}?text=${encodeURIComponent(message)}`;
}

export default function Home() {
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState<Place>(() => parseTargetFromUrl() || defaultTarget);
  const [shareMode] = useState(isShareMode);
  const [senderPhone] = useState(senderPhoneFromUrl);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [location, setLocation] = useState<LocationState>({
    status: "idle",
    coords: null,
    message: "Pulsa para activar ubicacion cuando haga falta.",
  });

  const distance = useMemo(() => {
    if (location.status !== "ready") {
      return null;
    }

    return formatDistance(distanceInMeters(location.coords, target));
  }, [location, target]);

  function requestLocation(onSuccess?: (coords: Coordinates) => void) {
    if (!("geolocation" in navigator)) {
      setLocation({
        status: "error",
        coords: null,
        message: "Este navegador no soporta geolocalizacion.",
      });
      return;
    }

    setLocation({
      status: "loading",
      coords: null,
      message: "Buscando posicion...",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setLocation({
          status: "ready",
          coords,
          message: `Listo. Precision aprox: ${Math.round(position.coords.accuracy)} m`,
        });
        onSuccess?.(coords);
      },
      () => {
        setLocation({
          status: "error",
          coords: null,
          message: "No se pudo acceder a la ubicacion. Revisa permisos.",
        });
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 },
    );
  }

  function requestFriendLocation() {
    const shareLink = buildAppUrl({
      share: "1",
      from: phone,
    });
    const message = `Estoy yendo a la playa. Abre esto y pulsa compartir ubicacion para que vaya directo: ${shareLink}`;

    window.open(whatsAppUrl(phone, message), "_blank", "noopener,noreferrer");
  }

  function sendMyLocation() {
    requestLocation((coords) => {
      const linkBack = buildAppUrl({
        lat: coords.lat.toFixed(6),
        lng: coords.lng.toFixed(6),
        name: "Mi ubicacion en la playa",
      });
      const message = `Estoy aqui. Pulsa este enlace y dale a Iniciar viaje: ${linkBack}`;

      window.open(whatsAppUrl(senderPhone, message), "_blank", "noopener,noreferrer");
    });
  }

  function startTrip() {
    window.open(mapsUrl(target), "_blank", "noopener,noreferrer");
  }

  async function copyCoordinates() {
    const text = `${target.lat.toFixed(6)}, ${target.lng.toFixed(6)}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCoords(true);
      window.setTimeout(() => setCopiedCoords(false), 2000);
    } catch {
      setLocation({
        status: "error",
        coords: null,
        message: `Copia estas coordenadas a mano: ${text}`,
      });
    }
  }

  if (shareMode) {
    return (
      <>
        <Head>
          <title>Compartir ubicacion</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <main className="app compact">
          <section className="panel">
            <p className="eyebrow">Tu colega te espera</p>
            <h1>Comparte tu punto</h1>
            <p className="intro">
              Pulsa el boton y se abre WhatsApp con tu ubicacion en un enlace.
              Solo se envia si tu aceptas.
            </p>
            <button className="primary big" onClick={sendMyLocation}>
              Compartir mi ubicacion
            </button>
            <p className={`status ${location.status}`}>{location.message}</p>
          </section>
        </main>

        <style jsx>{styles}</style>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Iniciar viaje a la playa</title>
        <meta
          name="description"
          content="Pide la ubicacion a tu colega por WhatsApp y abre la ruta a la playa."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="app">
        <section className="panel">
          <p className="eyebrow">Sin perderme</p>
          <h1>Telefono, punto y GPS</h1>
          <p className="intro">
            Mete su telefono, le mandas el enlace y cuando te devuelva su punto
            le das a <strong>Iniciar viaje</strong>. Se abre Maps con GPS hasta
            la ubicacion exacta.
          </p>

          <label>
            Telefono de tu colega
            <input
              inputMode="tel"
              placeholder="+34 600 000 000"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

          <button className="primary big" onClick={requestFriendLocation} disabled={!phone.trim()}>
            Pedir ubicacion por WhatsApp
          </button>
        </section>

        <section className="panel destination">
          <p className="eyebrow">Destino actual</p>
          <h2>{target.name}</h2>
          <p className="coords">
            {target.lat.toFixed(5)}, {target.lng.toFixed(5)}
          </p>

          <div className="chips">
            {fallbackPlaces.map((place) => (
              <button
                className="chip"
                key={place.name}
                onClick={() => setTarget(place)}
                type="button"
              >
                {place.name}
              </button>
            ))}
          </div>

          <button className="start" onClick={startTrip}>
            Iniciar viaje con GPS
          </button>

          <button className="ghost" onClick={() => requestLocation()}>
            Calcular distancia desde mi sitio
          </button>

          <button className="ghost" onClick={copyCoordinates}>
            {copiedCoords ? "Coordenadas copiadas" : "Copiar coordenadas de respaldo"}
          </button>

          {distance && <p className="distance">Estas a {distance} aprox.</p>}
          <p className={`status ${location.status}`}>{location.message}</p>
        </section>

        <section className="panel no-lost">
          <p className="eyebrow">Modo facil</p>
          <h2>Para no perderte</h2>
          <ol className="steps">
            <li>Pide su ubicacion por WhatsApp.</li>
            <li>Abre el enlace que te mande.</li>
            <li>Pulsa Iniciar viaje con GPS y sigue Maps.</li>
          </ol>
        </section>

        <section className="note">
          No localiza a nadie solo por telefono: tu colega tiene que compartir
          su ubicacion. Asi evitamos lios y funciona sin servidor.
        </section>
      </main>

      <style jsx>{styles}</style>
    </>
  );
}

const styles = `
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    color: #17212b;
    background:
      radial-gradient(circle at top left, rgba(255, 223, 127, 0.42), transparent 25rem),
      linear-gradient(135deg, #05657d 0%, #0ca6ba 48%, #f7c76d 100%);
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
  }

  .app {
    display: grid;
    gap: 18px;
    align-content: center;
    max-width: 760px;
    min-height: 100vh;
    margin: 0 auto;
    padding: 22px;
  }

  .compact {
    max-width: 560px;
  }

  .panel,
  .note {
    padding: 26px;
    border: 1px solid rgba(255, 255, 255, 0.34);
    border-radius: 30px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 22px 70px rgba(5, 42, 55, 0.2);
  }

  .panel:first-child {
    color: white;
    background: rgba(5, 33, 45, 0.78);
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #ffe189;
    font-size: 0.78rem;
    font-weight: 900;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 14px;
    font-size: clamp(2.3rem, 12vw, 4.6rem);
    line-height: 0.92;
    letter-spacing: -0.07em;
  }

  h2 {
    margin-bottom: 8px;
    font-size: 2rem;
  }

  .intro,
  .coords,
  .distance,
  .status,
  .note,
  .steps {
    line-height: 1.55;
  }

  .intro {
    color: rgba(255, 255, 255, 0.82);
    font-size: 1.04rem;
  }

  label {
    display: grid;
    gap: 8px;
    margin: 22px 0 12px;
    font-size: 0.92rem;
    font-weight: 800;
  }

  input {
    width: 100%;
    min-height: 56px;
    padding: 14px 16px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 18px;
    color: #14212b;
    background: rgba(255, 255, 255, 0.95);
    font: inherit;
    font-size: 1.1rem;
    outline: none;
  }

  button {
    min-height: 52px;
    padding: 14px 18px;
    border: 0;
    border-radius: 999px;
    font: inherit;
    font-weight: 900;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .primary,
  .start {
    color: #092f3d;
    background: #ffe08a;
    box-shadow: 0 14px 34px rgba(255, 197, 73, 0.28);
  }

  .big,
  .start,
  .ghost {
    width: 100%;
  }

  .start {
    min-height: 64px;
    margin-top: 18px;
    font-size: 1.2rem;
  }

  .ghost {
    margin-top: 10px;
    color: #0b4f62;
    background: #e8f7fa;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 18px 0 4px;
  }

  .chip {
    min-height: 42px;
    color: #0b4f62;
    background: #eaf8fb;
  }

  .coords,
  .distance,
  .status,
  .note,
  .steps {
    color: #5d6975;
  }

  .steps {
    display: grid;
    gap: 10px;
    margin: 0;
    padding-left: 22px;
    font-weight: 700;
  }

  .status {
    margin: 14px 0 0;
    padding: 12px 14px;
    border-radius: 16px;
    background: #f3f7f8;
  }

  .status.ready {
    color: #0b6644;
    background: #e5f8ee;
  }

  .status.error {
    color: #8a2f1b;
    background: #ffe9df;
  }

  .panel:first-child .status {
    color: rgba(255, 255, 255, 0.82);
    background: rgba(255, 255, 255, 0.12);
  }

  .panel:first-child .status.ready {
    color: #d5ffe8;
  }

  .panel:first-child .status.error {
    color: #ffd7c8;
  }

  @media (max-width: 560px) {
    .app {
      padding: 14px;
    }

    .panel,
    .note {
      padding: 22px;
      border-radius: 24px;
    }
  }
`;
