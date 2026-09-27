# Estado

## DONE

- Dominio compartido: presets, máscaras, Identity Lock, historial con ramas, créditos, privacidad y plan de reel.
- API: dispositivo, proyectos, original que no se sustituye, jobs `QUEUED | PROCESSING | COMPLETED | FAILED | CANCELLED`, máscara, vídeo, reel, sello de exportación, borrado y retención.
- Proveedor local procedural y adaptador HTTP que exige clave de entorno y opt-out de entrenamiento.
- Tests de dominio, de la API (pelo, bigote, original intacto, vídeo, reel, consentimiento, créditos) y del payload de la app. 24 pruebas en verde.
- App Expo en un solo código: inicio en español, consentimiento, proyectos, editor (zoom, comparar, mantener original, deshacer, rehacer, resets, duplicar, exportar, compartir), todas las herramientas desde datos, máscara auto/manual, revisión con conservar / descartar / reintentar / variación, animar y reel.
- Recorrido en Expo web: importar, pelo ondulado, bigote, conservar, historial con deshacer, exportar, animar y previsualizar un reel. La etiqueta visible fue «Procesado en local. No es IA generativa.»
- `MONETIZATION_ENABLED=false` no bloquea herramientas. Compras desactivadas en la UI.
- ESLint y `tsc` estricto del dominio, la API y la app.

## IN PROGRESS

- Nada del flujo principal. El siguiente trabajo depende de un SDK o de claves de proveedor.

## BLOCKED

- APK / AAB: esta máquina no tiene Android SDK ni `sdkmanager`.
- IPA: no hay macOS ni Xcode.
- Proveedor generativo de imagen o vídeo: faltan `AI_EDIT_API_KEY` y `AI_VIDEO_API_KEY`. Sin ellas el producto usa el motor local y lo dice en pantalla. No se descargan modelos.

## NEXT

- Cuando haya SDK, `eas build` con los perfiles de `apps/mobile/eas.json`.
- Conectar un proveedor HTTP solo por entorno, sin cambiar la UI de las herramientas.
- La cámara nativa y guardar en la galería del teléfono no se pueden ejercitar en el navegador. En web, Galería usa el selector de archivos y Exportar descarga el archivo.
