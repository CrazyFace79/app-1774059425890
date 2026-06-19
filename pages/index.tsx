import type { FormEvent } from "react";
import { useState } from "react";

const phoneInputStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: 16,
  padding: "12px 14px",
  width: "100%",
};

export default function Home() {
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [showSecondaryPhone, setShowSecondaryPhone] = useState(false);
  const [savedPhones, setSavedPhones] = useState<string[]>([]);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const phones = [primaryPhone, secondaryPhone]
      .map((phone) => phone.trim())
      .filter(Boolean);

    if (phones.length === 0) {
      setError("Introduce al menos un numero de telefono.");
      setSavedPhones([]);
      return;
    }

    setError("");
    setSavedPhones(phones);
  }

  return (
    <main
      style={{
        background: "#f3f4f6",
        color: "#111827",
        minHeight: "100vh",
        padding: 40,
      }}
    >
      <section
        style={{
          background: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.08)",
          margin: "0 auto",
          maxWidth: 560,
          padding: 32,
        }}
      >
        <p style={{ color: "#2563eb", fontWeight: 700, margin: 0 }}>
          AI APP
        </p>
        <h1 style={{ fontSize: 32, margin: "8px 0 12px" }}>
          Telefonos de contacto
        </h1>
        <p style={{ color: "#4b5563", lineHeight: 1.6, marginTop: 0 }}>
          Guarda uno o dos numeros de telefono para tener una alternativa si
          no localizas a la primera persona.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 18, marginTop: 28 }}
        >
          <label style={{ display: "grid", gap: 8, fontWeight: 700 }}>
            Telefono principal
            <input
              inputMode="tel"
              onChange={(event) => setPrimaryPhone(event.target.value)}
              placeholder="Ej. 600 123 456"
              required
              style={phoneInputStyle}
              type="tel"
              value={primaryPhone}
            />
          </label>

          {showSecondaryPhone ? (
            <label style={{ display: "grid", gap: 8, fontWeight: 700 }}>
              Telefono alternativo
              <input
                inputMode="tel"
                onChange={(event) => setSecondaryPhone(event.target.value)}
                placeholder="Ej. 911 234 567"
                style={phoneInputStyle}
                type="tel"
                value={secondaryPhone}
              />
            </label>
          ) : null}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={() => {
                setShowSecondaryPhone((currentValue) => !currentValue);
                if (showSecondaryPhone) {
                  setSecondaryPhone("");
                  setSavedPhones((currentPhones) => currentPhones.slice(0, 1));
                }
              }}
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 999,
                color: "#1d4ed8",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                padding: "10px 16px",
              }}
              type="button"
            >
              {showSecondaryPhone
                ? "Quitar segundo telefono"
                : "Anadir segundo telefono"}
            </button>

            <button
              style={{
                background: "#2563eb",
                border: "1px solid #2563eb",
                borderRadius: 999,
                color: "#ffffff",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 700,
                padding: "10px 18px",
              }}
              type="submit"
            >
              Guardar telefonos
            </button>
          </div>

          {error ? (
            <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>
              {error}
            </p>
          ) : null}
        </form>

        {savedPhones.length > 0 ? (
          <aside
            style={{
              background: "#ecfdf5",
              border: "1px solid #bbf7d0",
              borderRadius: 12,
              marginTop: 28,
              padding: 18,
            }}
          >
            <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>
              Telefonos guardados
            </h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {savedPhones.map((phone, index) => (
                <li key={`${phone}-${index}`}>
                  {index === 0 ? "Principal" : "Alternativo"}: {phone}
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
