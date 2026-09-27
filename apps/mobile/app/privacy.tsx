import { useState } from 'react';
import { router } from 'expo-router';
import { PRIVACY_SUMMARY } from '@lookstudio/domain';
import { Banner, Button, Muted, Screen, Title } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';
import { errorMessage } from '../src/pure/flow';
import { wipeLocal } from '../src/storage/library';

export default function PrivacyScreen() {
  const app = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function eraseAll() {
    setError(null);
    try {
      if (app.serverUp) {
        try {
          await app.ensureSession();
          await app.client().deleteAll();
        } catch (cause) {
          if (!(cause instanceof Error) || !cause.message.includes('Sesión')) throw cause;
        }
      }
      await wipeLocal();
      await app.clearSession();
      await app.refresh();
      router.replace('/');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Screen scroll>
      <Title>Tus datos</Title>
      <Muted>{PRIVACY_SUMMARY}</Muted>
      <Banner>El servidor puede borrar copias de trabajo pasadas las horas de retención configuradas. El original local no entra en ese barrido.</Banner>
      {message ? <Banner>{message}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button
        label="Pedir barrido de copias caducadas"
        tone="ghost"
        disabled={!app.serverUp}
        onPress={() => {
          void app
            .ensureSession()
            .then(() => app.client().sweep())
            .then((body) => setMessage(`Barrido pedido. El servidor revisó ${body.removed} copias.`))
            .catch((cause) => setError(errorMessage(cause)));
        }}
      />
      {confirm ? (
        <Button label="Confirmar borrado total" tone="danger" onPress={() => void eraseAll()} />
      ) : (
        <Button label="Borrar proyectos, fotos y sesión" tone="danger" onPress={() => setConfirm(true)} />
      )}
    </Screen>
  );
}
