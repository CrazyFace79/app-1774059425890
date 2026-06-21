# missing-evidence-recovery

Localiza adjuntos mencionados en chats pero ausentes en una exportacion.

Busca referencias a:

- `.pdf`
- `.jpg` / `.jpeg`
- `.png`
- `.docx`
- `.xlsx`

Genera:

- `MISSING_ATTACHMENTS`
- `RECOVERY_CANDIDATES`
- `prioritizedMissingAttachments`

## MISSING_ATTACHMENTS

Campos:

- `chat`
- `fecha`
- `nombre_archivo`
- `tipo`
- `ruta_original`
- `estado`

Estados:

- `MISSING_FROM_EXPORT`: mencionado en chat, no presente en exportacion.
- `POSSIBLE_COPY_FOUND`: falta en exportacion, pero hay una copia candidata.
- `EXPORTED_PRESENT`: existe en la exportacion y se excluye de la tabla final.

## Carpetas candidatas

El modulo prioriza rutas que parezcan estar en:

- Downloads / Descargas
- Desktop / Escritorio
- Documents / Documentos
- WhatsApp Media
- Android backups
- Google Drive
- OneDrive

## Prioridad maxima

Sube prioridad cuando el nombre contiene:

- hotel
- booking
- airbnb
- reservation
- reserva
- invoice
- receipt
- villa
- ceuti
- trip
- travel

## Ejemplo

```ts
import { recoverMissingEvidence } from "./missing-evidence-recovery";

const report = recoverMissingEvidence({
  chats: [
    {
      chat: "WhatsApp Export",
      fecha: "2026-06-21",
      text: "Adjunto: MENU'S HOTEL VILLA CEUTI.pdf",
    },
  ],
  exportedFiles: [{ name: "chat.txt" }],
  candidateFiles: [
    {
      name: "MENU'S HOTEL VILLA CEUTI.pdf",
      path: "C:/Users/me/Downloads/MENU'S HOTEL VILLA CEUTI.pdf",
    },
  ],
});

console.log(report.MISSING_ATTACHMENTS);
console.log(report.RECOVERY_CANDIDATES);
```

Para analizar el contenido del archivo fisico original, primero hay que recuperar
la ruta candidata y extraer texto/OCR/PDF. Ese texto se puede pasar despues a
`payment-proof-engine`.
