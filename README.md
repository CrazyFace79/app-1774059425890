# AI Look Studio

App Android + iOS en un solo código (Expo + React Native + TypeScript) y una API local para proyectos, máscaras, trabajos de imagen, vídeo y reels.

El motor por defecto es procedural y limita el cambio a la máscara. No es un modelo generativo. Un proveedor HTTP se activa solo con variables de entorno y no hay claves dentro de la app.

## Requisitos

- Node 22
- ffmpeg con libx264 y aac, en el PATH, para animar y montar reels

## Arranque

```bash
npm install
npm run dev:api
```

La API escucha en `http://localhost:8787`. Copia `apps/api/.env.example` si quieres cambiar puerto, proveedores o `MONETIZATION_ENABLED`.

En otra terminal:

```bash
npm run start:mobile
```

La app lee `EXPO_PUBLIC_API_URL` (`apps/mobile/.env.example`). En un emulador Android la API del ordenador suele ser `http://10.0.2.2:8787`. También puedes cambiarla en Ajustes.

Web, para probar la misma UI:

```bash
npm run start --workspace @lookstudio/mobile -- --web
```

## Comprobaciones

```bash
npm test
npm run typecheck
npm run lint
```

## Qué hace el motor local

- Pelo, barba, bigote, rostro, ropa, accesorios, fondo, retoque y estilo son ediciones de píxeles dentro de la máscara.
- Animar mueve la cámara. Un gesto real (sonrisa, mirada, giro) necesita `VIDEO_PROVIDER=http`.
- El reel monta clips con ffmpeg a 1080×1920. La previsualización es 540×960.
- Los resultados locales se etiquetan como procesados en local, no como IA generativa.

## Builds nativas

`apps/mobile/eas.json` deja listos los perfiles de desarrollo, preview y producción. Compilar el APK o el IPA en esta máquina no está disponible: no hay Android SDK ni Xcode. El estado concreto está en `STATUS.md`.
