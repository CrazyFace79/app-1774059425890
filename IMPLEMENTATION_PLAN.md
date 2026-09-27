# Plan de implementación

El orden es el de construcción real. No hay estimación de calendario.

1. Auditoría del entorno y del repo. Hecho. Node 22, ffmpeg, sin Android SDK ni Xcode.
2. Monorepo, dominio puro y API de trabajos. Hecho.
3. Motor local de máscaras, Identity Lock, presets como datos y historial con ramas. Hecho y cubierto por tests.
4. Proveedor mock real y adaptador HTTP sin claves en el cliente. Hecho.
5. Vídeo de cámara y reel ffmpeg. Hecho en la API.
6. App Expo: inicio, consentimiento, proyectos, editor, herramientas, máscara, revisión, historial, animar y reel. Hecho en código.
7. Verificación del flujo en web (crear, importar, pelo, conservar, bigote, historial, exportar, animar, reel). Siguiente paso de esta entrega.
8. Development build de Android. Bloqueado: no hay SDK en esta máquina. `eas.json` ya describe el perfil.
9. IPA de iOS. Bloqueado: no hay macOS ni Xcode.

Cada herramienta lee `PRESETS` y `getControls`. La UI no tiene una lista de estilos propia.

La app no aplica un resultado hasta Conservar. Exportar con API online estampa el aviso visible. Sin red, deja el archivo y un JSON con la divulgación.

Pendiente fuera de este código: credenciales de un proveedor generativo, firma de las tiendas y un binario instalable.
