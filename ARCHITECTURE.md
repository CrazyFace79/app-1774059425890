# Arquitectura

AI Look Studio es un monorepo de npm workspaces. Una sola app Expo cubre Android, iOS y la verificación web. La API procesa copias; la biblioteca del dispositivo es la fuente de verdad del proyecto.

## Paquetes

- `packages/domain` — tipos, presets, política de Identity Lock, máscaras, efectos locales, historial, jobs, créditos, privacidad y argumentos de ffmpeg del reel. No importa React ni Node.
- `apps/api` — Fastify, SQLite (`node:sqlite`), archivos en disco, cola de trabajos y proveedores.
- `apps/mobile` — Expo SDK 57, expo-router, SQLite local y el sistema de archivos de documentos.

## Flujo de una edición

1. La app crea el proyecto y guarda el original en disco. Ese archivo no se reescribe.
2. La herramienta arma un plan con `buildEditPlan`: prompt, prompt de conservación, zonas protegidas y alcance local o global.
3. Si hay red, la app crea el mismo proyecto en la API (idempotente) y sube el original una sola vez, con consentimiento y `X-Training-Opt-Out: true`.
4. `POST /v1/jobs` devuelve `202` y un `jobId`. La imagen enviada es una copia de trabajo, no el original.
5. La app hace polling. Al completar, descarga el resultado a un asset `pending`.
6. Conservar inserta un nodo de historial. Descartar borra ese archivo. Reintentar y variación lanzan otro trabajo. Hasta conservar, la cabeza del proyecto no cambia.

## Identity Lock y máscaras

Identity Lock empieza activo. Las zonas prohibidas de cada herramienta se aplican siempre: el pelo no edita barba, el bigote no edita barba, la ropa no edita cara. El lock añade protección extra (por ejemplo la cara en una transformación global) y recorta la intensidad. El suavizado de la máscara no reabre esas zonas.

La máscara automática usa zonas geométricas de retrato, o un recorte de fondo si el borde es separable. La máscara manual pinta, borra, invierte y suaviza. El servidor vuelve a construir el plan; no acepta un prompt de conservación escrito por el cliente.

## Historial

El grafo vive en SQLite (`versions`, `head_version_id`, `redo_json`). Deshacer, rehacer, saltar, reset de módulo y reset total usan las funciones de `packages/domain/src/history.ts`. Los nodos antiguos se quedan. Una versión nueva cuelga de la cabeza actual y limpia la pila de rehacer.

## Proveedores

`ProviderRegistry` describe edición, segmentación, upscale y vídeo. `mock` es el motor local. `http` hace `POST` a `{base}/v1/edits`, `/v1/videos`, `/v1/segment` o `/v1/upscale` con `Authorization: Bearer` y opt-out de entrenamiento. La clave sale solo de variables de entorno. Si el modo HTTP está elegido y falta la clave, el trabajo falla: no hay caída silenciosa al mock.

## Vídeo y reel

Animar con el mock genera un mp4 de movimiento de cámara. El reel recibe clips, transiciones (`cut`, `fade`, `wipe`), texto y un audio opcional del usuario. La exportación es 1080×1920. No hay música empaquetada.

## Privacidad y créditos

Hace falta consentimiento antes de subir. `training_opt_out` está fijado. Borrar un proyecto, el original o toda la cuenta elimina archivos. La retención automática no toca el original. `MONETIZATION_ENABLED=false` no cobra ni bloquea. El proveedor de compras rechaza cualquier intento.

## Qué no entra en el binario

Claves de proveedores, modelos grandes y la lógica de ffmpeg. La app solo habla con la API que el usuario configura.
