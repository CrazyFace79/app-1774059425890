# payment-proof-engine

Motor para reducir falsos positivos en hallazgos de Booking, Airbnb, Stripe,
PayPal y movimientos bancarios. No considera suficiente una visita web, cookie,
cache, DNS, historial de navegador, publicidad, popup, script o referencia a
dominio.

## Clasificacion

- `LEVEL 0`: visita web.
- `LEVEL 1`: inicio de checkout.
- `LEVEL 2`: reserva iniciada.
- `LEVEL 3`: pago o reserva confirmado por evidencia explicita.
- `LEVEL 4`: evidencia documental solida en correo, PDF, OCR, documento,
  spreadsheet o datos estructurados con importe/identificador/recibo/voucher.

El informe devuelve todos los hallazgos, pero `visibleFindings` muestra por
defecto solo `LEVEL 3` y `LEVEL 4`.

## Entradas soportadas

El motor acepta texto ya extraido de estos origenes:

- Correos: `.pst`, `.ost`, `.mbox`, `.eml`, `.msg`
- PDF: `.pdf`
- Imagen OCR: `.jpg`, `.jpeg`, `.png`, `.webp`
- Documentos/datos: `.docx`, `.xlsx`, `.csv`, `.txt`, `.json`

La extraccion binaria/OCR debe hacerse antes de llamar al motor. Este modulo
clasifica la evidencia extraida y genera tablas limpias.

## Ejemplo

```ts
import { analyzePaymentProofDocuments } from "./payment-proof-engine";

const report = analyzePaymentProofDocuments([
  {
    fileName: "booking-confirmation.eml",
    text: `
      Booking Confirmation
      Booking Number: BK-123456
      Hotel: Hotel Centro
      City: Madrid
      Total: EUR 249.90
      guest@example.com
    `,
  },
  {
    fileName: "browser-history.txt",
    text: "Visited booking.com from browser history",
  },
]);

console.log(report.PAGOS_CONFIRMADOS);
console.log(report.RESERVAS_CONFIRMADAS);
console.log(report.SOSPECHAS_SIN_CONFIRMAR);
console.log(report.summary.finalMessage);
```

## Tablas generadas

### PAGOS_CONFIRMADOS

Campos:

- `fecha`
- `hora`
- `proveedor`
- `importe`
- `moneda`
- `hotel`
- `ciudad`
- `correo_asociado`
- `archivo_origen`
- `tipo_evidencia`
- `confidence_score`

### RESERVAS_CONFIRMADAS

Campos:

- `fecha_reserva`
- `fecha_estancia`
- `hotel`
- `destino`
- `plataforma`
- `numero_reserva`
- `importe`
- `evidencia`

### SOSPECHAS_SIN_CONFIRMAR

Incluye visitas o checkouts de Booking, Airbnb, Stripe o PayPal que no tienen
prueba documental o financiera suficiente.

### STRIPE_ACTIVITY

Incluye actividad Stripe que no debe contarse como pago:

- `api.stripe.com`
- `checkout.stripe.com`
- `merchant-ui-api.stripe.com`

`PAYMENT_CONFIDENCE`:

- `LOW`: solo dominio Stripe o API.
- `MEDIUM`: Stripe con flujo de checkout.
- `HIGH`: solo cuando tambien hay recibo, factura, charge, payment intent u
  order confirmation validos.

### VERIFIED_PAYMENT

Pagos Stripe verificados. No basta con ver un dominio Stripe. Requiere evidencia
financiera no negada:

- `payment_intent` / `pi_...`
- `charge` / `ch_...` / `charge succeeded`
- `receipt` / `receipt_url` / numero de recibo
- `invoice` / `in_...` / `invoice paid`
- `order confirmation`
- `merchant name` como refuerzo de contexto, no como prueba unica

### SUSCRIPCIONES_DETECTADAS

Detecta suscripciones Stripe por senales como:

- `subscription`
- `sub_...`
- `recurring`
- `renewal`
- `plan`
- `mensual`
- `suscripcion`

## Resumen final

El resumen contiene:

- `PAGOS CONFIRMADOS ENCONTRADOS`
- `RESERVAS CONFIRMADAS ENCONTRADAS`
- `IMPORTE TOTAL DETECTADO`
- `EVIDENCIAS DOCUMENTALES`

Si no existe prueba documental o financiera, el mensaje final sera:

`NO HAY EVIDENCIA SUFICIENTE PARA AFIRMAR QUE EXISTIÓ UN PAGO O RESERVA CONFIRMADA`
