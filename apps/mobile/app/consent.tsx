import { router } from 'expo-router';
import { PRIVACY_SUMMARY } from '@lookstudio/domain';
import { Banner, Button, Muted, Screen, Title } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';

export default function ConsentScreen() {
  const { acceptConsent } = useApp();
  return (
    <Screen scroll>
      <Title>Antes de subir una foto</Title>
      <Muted>{PRIVACY_SUMMARY}</Muted>
      <Banner tone="warn">Las fotos de personas reales no se presentan como si fueran auténticas. Cada resultado guarda si fue modificado o generado.</Banner>
      <Banner>El entrenamiento con tus imágenes está desactivado y no se puede encender desde la app.</Banner>
      <Button
        label="Acepto y continuar"
        onPress={() => {
          void acceptConsent().then(() => router.replace('/home'));
        }}
      />
    </Screen>
  );
}
