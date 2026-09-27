import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Network from 'expo-network';
import type { Stroke } from '@lookstudio/domain';
import { LookClient, type Capabilities, type SessionBody } from '../api/client';
import { errorMessage } from '../pure/flow';
import { getSetting, listProjects, setSetting, sweepRetention, type ProjectRow } from '../storage/library';
import { newId } from '../storage/files';
import { deleteSecret, readSecret, writeSecret } from '../storage/secrets';

const API_KEY = 'apiUrl';
const CONSENT_KEY = 'consent';
const DEVICE_KEY = 'lookstudio.device';
const TOKEN_KEY = 'lookstudio.token';

export type MaskDraft = {
  mode: 'auto' | 'manual';
  strokes: Stroke[];
  brush: 'brush' | 'erase';
  size: number;
  feather: number;
  invert: boolean;
};

export const emptyMask = (): MaskDraft => ({
  mode: 'auto',
  strokes: [],
  brush: 'brush',
  size: 0.04,
  feather: 2,
  invert: false,
});

type AppValue = {
  ready: boolean;
  consent: boolean;
  online: boolean;
  serverUp: boolean;
  apiUrl: string;
  session: SessionBody | null;
  capabilities: Capabilities | null;
  projects: ProjectRow[];
  revision: number;
  bootError: string | null;
  acceptConsent: () => Promise<void>;
  setApiUrl: (url: string) => Promise<void>;
  refresh: () => Promise<void>;
  client: () => LookClient;
  ensureSession: () => Promise<SessionBody>;
  maskFor: (projectId: string, tool: string) => MaskDraft;
  updateMask: (projectId: string, tool: string, patch: Partial<MaskDraft>) => void;
  clearSession: () => Promise<void>;
};

const AppContext = createContext<AppValue | null>(null);

const defaultApi = process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:8787';

function onlineFrom(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [online, setOnline] = useState(true);
  const [serverUp, setServerUp] = useState(false);
  const [apiUrl, setApiUrlState] = useState(defaultApi);
  const [session, setSession] = useState<SessionBody | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [revision, setRevision] = useState(0);
  const [bootError, setBootError] = useState<string | null>(null);
  const [masks, setMasks] = useState<Record<string, MaskDraft>>({});

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [storedConsent, storedUrl, token] = await Promise.all([getSetting(CONSENT_KEY), getSetting(API_KEY), readSecret(TOKEN_KEY)]);
        if (!alive) return;
        setConsent(storedConsent === 'yes');
        if (storedUrl) setApiUrlState(storedUrl);
        if (token) setSession({ token, userId: '', plan: 'free', credits: 0, monetizationEnabled: false, trainingOptOut: true });
        await sweepRetention();
        setProjects(await listProjects());
      } catch (error) {
        if (alive) setBootError(errorMessage(error));
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    void Network.getNetworkStateAsync()
      .then((state) => setOnline(onlineFrom(state)))
      .catch(() => setOnline(true));
    try {
      subscription = Network.addNetworkStateListener((state) => setOnline(onlineFrom(state)));
    } catch {
      subscription = null;
    }
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void fetch(`${apiUrl.replace(/\/+$/, '')}/v1/health`)
      .then((response) => {
        if (alive) setServerUp(response.ok);
      })
      .catch(() => {
        if (alive) setServerUp(false);
      });
    return () => {
      alive = false;
    };
  }, [apiUrl, online, ready, revision]);

  const acceptConsent = useCallback(async () => {
    await setSetting(CONSENT_KEY, 'yes');
    setConsent(true);
  }, []);

  const setApiUrl = useCallback(async (url: string) => {
    const next = url.trim().replace(/\/+$/, '') || defaultApi;
    await setSetting(API_KEY, next);
    await deleteSecret(TOKEN_KEY);
    setSession(null);
    setCapabilities(null);
    setApiUrlState(next);
    setRevision((value) => value + 1);
  }, []);

  const clearSession = useCallback(async () => {
    await deleteSecret(TOKEN_KEY);
    setSession(null);
    setCapabilities(null);
  }, []);

  const ensureSession = useCallback(async () => {
    if (session?.userId) return session;
    let deviceId = await readSecret(DEVICE_KEY);
    if (!deviceId) {
      deviceId = newId();
      await writeSecret(DEVICE_KEY, deviceId);
    }
    const client = new LookClient(apiUrl, null);
    const next = await client.auth(deviceId);
    await writeSecret(TOKEN_KEY, next.token);
    setSession(next);
    try {
      setCapabilities(await new LookClient(apiUrl, next.token).capabilities());
    } catch {
      setCapabilities(null);
    }
    return next;
  }, [apiUrl, session]);

  const client = useCallback(() => new LookClient(apiUrl, session?.token ?? null), [apiUrl, session?.token]);

  const maskFor = useCallback(
    (projectId: string, tool: string) => masks[`${projectId}:${tool}`] ?? emptyMask(),
    [masks],
  );

  const updateMask = useCallback((projectId: string, tool: string, patch: Partial<MaskDraft>) => {
    const key = `${projectId}:${tool}`;
    setMasks((current) => ({ ...current, [key]: { ...(current[key] ?? emptyMask()), ...patch } }));
  }, []);

  const value = useMemo<AppValue>(
    () => ({
      ready,
      consent,
      online,
      serverUp,
      apiUrl,
      session,
      capabilities,
      projects,
      revision,
      bootError,
      acceptConsent,
      setApiUrl,
      refresh,
      client,
      ensureSession,
      maskFor,
      updateMask,
      clearSession,
    }),
    [
      ready,
      consent,
      online,
      serverUp,
      apiUrl,
      session,
      capabilities,
      projects,
      revision,
      bootError,
      acceptConsent,
      setApiUrl,
      refresh,
      client,
      ensureSession,
      maskFor,
      updateMask,
      clearSession,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('Falta el proveedor de la app.');
  return value;
}
