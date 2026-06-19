import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";

type SharedLocation = {
  phone: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

const mapsButtonStyle: CSSProperties = {
  background: "#111827",
  border: "none",
  borderRadius: 12,
  color: "#ffffff",
  cursor: "pointer",
  fontSize: 16,
  fontWeight: 700,
  padding: "14px 18px",
  textDecoration: "none",
};

export default function Home() {
  const [phone, setPhone] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<SharedLocation | null>(
    null
  );
  const [locationMessage, setLocationMessage] = useState("");
  const [routeMessage, setRouteMessage] = useState("");
  const [routeUrl, setRouteUrl] = useState("");

  const mapUrl = useMemo(() => {
    if (!sharedLocation) {
      return "";
    }

    const { latitude, longitude } = sharedLocation;
    const margin = 0.01;

    return `https://www.openstreetmap.org/export/embed.html?bbox=${
      longitude - margin
    }%2C${latitude - margin}%2C${longitude + margin}%2C${
      latitude + margin
    }&layer=mapnik&marker=${latitude}%2C${longitude}`;
  }, [sharedLocation]);

  const handleRequestLocation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRouteUrl("");
    setRouteMessage("");
    setLocationMessage("");
    setSharedLocation(null);
    setRequestSent(true);
  };

  const shareLocation = () => {
    setLocationMessage("Pidiendo permiso de ubicación al navegador...");

    if (!("geolocation" in navigator)) {
      setLocationMessage(
        "Este dispositivo no tiene geolocalización disponible. Prueba desde un móvil con GPS."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSharedLocation({
          phone,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? Math.round(position.coords.accuracy)
            : null,
          capturedAt: new Date().toLocaleString("es-ES"),
        });
        setLocationMessage(
          "Ubicación compartida correctamente con permiso del dispositivo."
        );
      },
      () => {
        setLocationMessage(
          "No se pudo obtener la ubicación. Revisa los permisos del navegador e inténtalo otra vez."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  const startRoute = () => {
    if (!sharedLocation) {
      return;
    }

    setRouteMessage("Calculando tu punto de salida...");

    const destination = `${sharedLocation.latitude},${sharedLocation.longitude}`;
    const buildUrl = (origin?: string) =>
      `https://www.google.com/maps/dir/?api=1${
        origin ? `&origin=${origin}` : ""
      }&destination=${destination}&travelmode=driving`;

    if (!("geolocation" in navigator)) {
      setRouteUrl(buildUrl());
      setRouteMessage(
        "Abre el camino en Google Maps; allí podrás elegir tu punto de salida."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = `${position.coords.latitude},${position.coords.longitude}`;
        setRouteUrl(buildUrl(origin));
        setRouteMessage(
          "Ruta lista. Pulsa el enlace para ver el camino desde tu ubicación actual."
        );
      },
      () => {
        setRouteUrl(buildUrl());
        setRouteMessage(
          "No se pudo leer tu ubicación actual. Abre el camino y elige el punto de salida en Google Maps."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  return (
    <div
      style={{
        background:
          "linear-gradient(135deg, #eff6ff 0%, #f8fafc 45%, #ecfeff 100%)",
        color: "#0f172a",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        minHeight: "100vh",
        padding: "48px 20px",
      }}
    >
      <main
        style={{
          margin: "0 auto",
          maxWidth: 1080,
        }}
      >
        <section
          style={{
            display: "grid",
            gap: 32,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                color: "#2563eb",
                fontWeight: 800,
                letterSpacing: "0.08em",
                margin: "0 0 12px",
                textTransform: "uppercase",
              }}
            >
              Ubicación con permiso
            </p>
            <h1
              style={{
                fontSize: "clamp(36px, 6vw, 68px)",
                lineHeight: 1,
                margin: 0,
              }}
            >
              Mete el teléfono, recibe ubicación e inicia el camino
            </h1>
            <p
              style={{
                color: "#475569",
                fontSize: 18,
                lineHeight: 1.6,
                marginTop: 20,
              }}
            >
              Por privacidad, la ubicación no se puede sacar solo con un número:
              la otra persona debe aceptar compartirla desde su móvil. Cuando la
              ubicación esté disponible, podrás abrir la ruta en Google Maps.
            </p>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.86)",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              borderRadius: 28,
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.14)",
              padding: 28,
            }}
          >
            <form onSubmit={handleRequestLocation}>
              <label
                htmlFor="phone"
                style={{ display: "block", fontWeight: 800, marginBottom: 10 }}
              >
                Teléfono de la persona
              </label>
              <input
                id="phone"
                inputMode="tel"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+34 600 000 000"
                required
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 14,
                  boxSizing: "border-box",
                  fontSize: 18,
                  marginBottom: 16,
                  outlineColor: "#2563eb",
                  padding: "15px 16px",
                  width: "100%",
                }}
                type="tel"
                value={phone}
              />
              <button style={{ ...mapsButtonStyle, width: "100%" }} type="submit">
                Solicitar ubicación
              </button>
            </form>

            {requestSent && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 18,
                  marginTop: 18,
                  padding: 18,
                }}
              >
                <strong>Solicitud preparada para {phone}</strong>
                <p style={{ color: "#475569", lineHeight: 1.5, marginBottom: 14 }}>
                  En una app real aquí enviarías un SMS o enlace seguro. Para
                  probarlo ahora, pulsa el botón desde el móvil que va a
                  compartir su ubicación.
                </p>
                <button
                  onClick={shareLocation}
                  style={{
                    ...mapsButtonStyle,
                    background: "#2563eb",
                    width: "100%",
                  }}
                  type="button"
                >
                  Compartir ubicación ahora
                </button>
              </div>
            )}

            {locationMessage && (
              <p style={{ color: "#334155", fontWeight: 700, marginBottom: 0 }}>
                {locationMessage}
              </p>
            )}
          </div>
        </section>

        {sharedLocation && (
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 28,
              boxShadow: "0 18px 60px rgba(15, 23, 42, 0.1)",
              marginTop: 34,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 0,
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              }}
            >
              <div style={{ padding: 28 }}>
                <p
                  style={{
                    color: "#16a34a",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    marginTop: 0,
                    textTransform: "uppercase",
                  }}
                >
                  Ubicación recibida
                </p>
                <h2 style={{ fontSize: 30, margin: "0 0 12px" }}>
                  {sharedLocation.phone}
                </h2>
                <dl
                  style={{
                    color: "#475569",
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "max-content 1fr",
                    lineHeight: 1.5,
                    marginBottom: 24,
                  }}
                >
                  <dt style={{ fontWeight: 800 }}>Latitud</dt>
                  <dd style={{ margin: 0 }}>
                    {sharedLocation.latitude.toFixed(6)}
                  </dd>
                  <dt style={{ fontWeight: 800 }}>Longitud</dt>
                  <dd style={{ margin: 0 }}>
                    {sharedLocation.longitude.toFixed(6)}
                  </dd>
                  <dt style={{ fontWeight: 800 }}>Precisión</dt>
                  <dd style={{ margin: 0 }}>
                    {sharedLocation.accuracy
                      ? `${sharedLocation.accuracy} metros`
                      : "No disponible"}
                  </dd>
                  <dt style={{ fontWeight: 800 }}>Hora</dt>
                  <dd style={{ margin: 0 }}>{sharedLocation.capturedAt}</dd>
                </dl>

                <button
                  onClick={startRoute}
                  style={{ ...mapsButtonStyle, background: "#16a34a" }}
                  type="button"
                >
                  Iniciar ruta
                </button>

                {routeMessage && (
                  <p style={{ color: "#334155", fontWeight: 700 }}>
                    {routeMessage}
                  </p>
                )}

                {routeUrl && (
                  <a
                    href={routeUrl}
                    rel="noreferrer"
                    style={{
                      ...mapsButtonStyle,
                      display: "inline-block",
                      marginTop: 8,
                    }}
                    target="_blank"
                  >
                    Ver camino en Google Maps
                  </a>
                )}
              </div>

              <iframe
                src={mapUrl}
                style={{
                  border: 0,
                  minHeight: 420,
                  width: "100%",
                }}
                title="Mapa con ubicación compartida"
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}