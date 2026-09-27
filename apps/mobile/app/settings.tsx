import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Banner, Button, Field, Muted, Screen, Title } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';
import { disclosureLabel, errorMessage } from '../src/pure/flow';

export default function SettingsScreen() {
  const app = useApp();
  const [url, setUrl] = useState(app.apiUrl);
  const [usage, setUsage] = useState('Cargando sesión…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(app.apiUrl);
  }, [app.apiUrl]);

  useEffect(() => {
    if (!app.serverUp) {
      setUsage('La API no está disponible.');
      return;
    }
    let alive = true;
    void app
      .ensureSession()
      .then(() => app.client().usage())
      .then((body) => {
        if (!alive) return;
        setUsage(`${body.plan.toUpperCase()} · ${body.credits} créditos · monetización ${body.monetizationEnabled ? 'activa' : 'apagada'}`);
      })
      .catch((cause) => {
        if (alive) setUsage(errorMessage(cause));
      });
    return () => {
      alive = false;
    };
  }, [app]);

  return (
    <Screen scroll>
      <Title>Ajustes</Title>
      <Muted>{usage}</Muted>
      <Banner>Las compras están desactivadas. Con la monetización apagada las herramientas no se bloquean ni cobran créditos.</Banner>
      <Banner>Entrenamiento con tus fotos: desactivado. No hay un control para permitirlo.</Banner>
      {app.capabilities ? (
        <Muted>
          Imagen: {app.capabilities.providers.edit.model} ({disclosureLabel(app.capabilities.providers.edit.disclosure)}). Vídeo:{' '}
          {app.capabilities.providers.video.model} ({disclosureLabel(app.capabilities.providers.video.disclosure)}).
        </Muted>
      ) : (
        <Muted>Las capacidades del proveedor se leen al conectar con la API.</Muted>
      )}
      <Field label="URL de la API" value={url} onChangeText={setUrl} placeholder="http://localhost:8787" />
      <Muted>En un emulador Android, la API del ordenador suele ser http://10.0.2.2:8787.</Muted>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button
        label="Guardar URL"
        onPress={() => {
          setError(null);
          void app.setApiUrl(url).catch((cause) => setError(errorMessage(cause)));
        }}
      />
      <Button label="Privacidad y borrado" tone="ghost" onPress={() => router.push('/privacy')} />
    </Screen>
  );
}
