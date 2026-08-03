export type NearbyDevice = {
  id: string;
  name: string;
  kind: DeviceKind;
  signal: SignalLevel | null;
  rssi: number | null;
  source: "picker" | "scan";
  lastSeen: number;
  uuids: string[];
};

export type DeviceKind =
  | "telefono"
  | "auriculares"
  | "altavoz"
  | "reloj"
  | "tv"
  | "ordenador"
  | "raton"
  | "teclado"
  | "coche"
  | "beacon"
  | "desconocido";

export type SignalLevel = "fuerte" | "media" | "debil";

type BluetoothLike = {
  getAvailability?: () => Promise<boolean>;
  requestDevice: (options: Record<string, unknown>) => Promise<BluetoothDeviceLike>;
  requestLEScan?: (options: Record<string, unknown>) => Promise<BluetoothLEScanLike>;
  addEventListener?: (
    type: "advertisementreceived",
    listener: (event: AdvertisementEventLike) => void
  ) => void;
  removeEventListener?: (
    type: "advertisementreceived",
    listener: (event: AdvertisementEventLike) => void
  ) => void;
};

type BluetoothDeviceLike = {
  id: string;
  name?: string | null;
  gatt?: { connected?: boolean } | null;
};

type BluetoothLEScanLike = {
  active: boolean;
  stop: () => void;
};

type AdvertisementEventLike = {
  device: BluetoothDeviceLike;
  rssi?: number;
  txPower?: number;
  uuids?: string[];
};

const KIND_RULES: Array<{ kind: DeviceKind; pattern: RegExp }> = [
  {
    kind: "auriculares",
    pattern:
      /airpods|galaxy buds|buds|headset|earbud|headphones|freebud|soundcore|beats|wf-|wh-/i,
  },
  {
    kind: "altavoz",
    pattern: /speaker|jbl|boombox|soundbar|homepod|echo|sonos|marshall|ue boom/i,
  },
  {
    kind: "reloj",
    pattern: /watch|band|mi band|fitbit|garmin|amazfit|galaxy watch|pixel watch/i,
  },
  {
    kind: "tv",
    pattern: /\btv\b|chromecast|fire stick|roku|samsung tv|lg tv|android tv|bravia/i,
  },
  {
    kind: "telefono",
    pattern: /iphone|pixel|galaxy|xiaomi|redmi|oneplus|huawei|oppo|motorola|nokia|android/i,
  },
  {
    kind: "ordenador",
    pattern: /macbook|imac|laptop|notebook|pc-|desktop|surface|chromebook/i,
  },
  {
    kind: "raton",
    pattern: /mouse|mx master|magic mouse|trackball/i,
  },
  {
    kind: "teclado",
    pattern: /keyboard|magic keyboard|keychron|logitech k/i,
  },
  {
    kind: "coche",
    pattern: /car|auto|bmw|audi|toyota|honda|tesla|ford|hyundai|kia|seat|skoda/i,
  },
  {
    kind: "beacon",
    pattern: /beacon|ibeacon|eddystone|tile|airtag|smarttag|tracker/i,
  },
];

export function getBluetooth(): BluetoothLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const bluetooth = (navigator as Navigator & { bluetooth?: BluetoothLike }).bluetooth;
  return bluetooth ?? null;
}

export async function isBluetoothAvailable(): Promise<boolean> {
  const bluetooth = getBluetooth();
  if (!bluetooth) {
    return false;
  }

  if (typeof bluetooth.getAvailability === "function") {
    try {
      return await bluetooth.getAvailability();
    } catch {
      return true;
    }
  }

  return true;
}

export function canContinuousScan(): boolean {
  const bluetooth = getBluetooth();
  return typeof bluetooth?.requestLEScan === "function";
}

export function guessDeviceKind(name: string): DeviceKind {
  for (const rule of KIND_RULES) {
    if (rule.pattern.test(name)) {
      return rule.kind;
    }
  }

  return "desconocido";
}

export function signalFromRssi(rssi: number | null | undefined): SignalLevel | null {
  if (typeof rssi !== "number" || Number.isNaN(rssi)) {
    return null;
  }

  if (rssi >= -60) {
    return "fuerte";
  }

  if (rssi >= -80) {
    return "media";
  }

  return "debil";
}

export function formatKind(kind: DeviceKind): string {
  const labels: Record<DeviceKind, string> = {
    telefono: "Teléfono",
    auriculares: "Auriculares",
    altavoz: "Altavoz",
    reloj: "Reloj / pulsera",
    tv: "Televisor / stick",
    ordenador: "Ordenador",
    raton: "Ratón",
    teclado: "Teclado",
    coche: "Coche",
    beacon: "Baliza / tracker",
    desconocido: "Sin clasificar",
  };

  return labels[kind];
}

export function formatSignal(signal: SignalLevel | null): string {
  if (!signal) {
    return "Sin señal";
  }

  const labels: Record<SignalLevel, string> = {
    fuerte: "Señal fuerte",
    media: "Señal media",
    debil: "Señal débil",
  };

  return labels[signal];
}

export function toNearbyDevice(
  device: BluetoothDeviceLike,
  source: NearbyDevice["source"],
  extras?: { rssi?: number; uuids?: string[] }
): NearbyDevice {
  const name = device.name?.trim() || "Dispositivo sin nombre";
  const rssi = typeof extras?.rssi === "number" ? extras.rssi : null;

  return {
    id: device.id || `${name}-${Date.now()}`,
    name,
    kind: guessDeviceKind(name),
    signal: signalFromRssi(rssi),
    rssi,
    source,
    lastSeen: Date.now(),
    uuids: extras?.uuids ?? [],
  };
}

export async function pickNearbyDevice(): Promise<NearbyDevice> {
  const bluetooth = getBluetooth();
  if (!bluetooth) {
    throw new Error(
      "Este navegador no soporta Web Bluetooth. Prueba con Chrome o Edge en HTTPS o localhost."
    );
  }

  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "battery_service",
      "device_information",
      "generic_access",
      "generic_attribute",
    ],
  });

  return toNearbyDevice(device, "picker");
}

export type ContinuousScanSession = {
  stop: () => void;
};

export async function startContinuousScan(
  onDevice: (device: NearbyDevice) => void
): Promise<ContinuousScanSession> {
  const bluetooth = getBluetooth();
  if (!bluetooth?.requestLEScan) {
    throw new Error(
      "El escaneo continuo no está disponible. Usa Chrome con la flag experimental o elige dispositivos uno a uno."
    );
  }

  const scan = await bluetooth.requestLEScan({
    acceptAllAdvertisements: true,
    keepRepeatedDevices: true,
  });

  const onAdvertisement = (event: AdvertisementEventLike) => {
    onDevice(
      toNearbyDevice(event.device, "scan", {
        rssi: event.rssi,
        uuids: event.uuids ?? [],
      })
    );
  };

  bluetooth.addEventListener?.("advertisementreceived", onAdvertisement);

  return {
    stop: () => {
      try {
        scan.stop();
      } catch {
        // ignore
      }
      bluetooth.removeEventListener?.("advertisementreceived", onAdvertisement);
    },
  };
}
