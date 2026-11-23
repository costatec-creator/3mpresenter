import type {
  Activity,
  Announcement,
  AppSettings,
  BackupPayload,
  CollectionType,
  DisplayInfo,
  Folder,
  Hymn,
  HymnSectionType,
  Program,
  ProgramWithActivities,
  ProjectionState,
} from '../types/index.ts';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Erro na comunicação (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

const isElectron = (): boolean => typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

export const COLLECTION_LABELS: Record<CollectionType, string> = {
  Hinário: 'Hinário Adventista',
  Coletânea: 'Coletânea Jovem',
  Outros: 'Outros',
};

export function formatDatePt(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts.map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return isoDate;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

export function formatDateTimePt(isoString: string): string {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return isoString;
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export const dataService = {
  isElectron,

  programs: {
    list: async (): Promise<Program[]> => {
      if (isElectron()) return window.electronAPI!.programs.list();
      return fetchJson<Program[]>('/api/programs');
    },
    get: async (id: string): Promise<ProgramWithActivities | null> => {
      if (isElectron()) return window.electronAPI!.programs.get(id);
      return fetchJson<ProgramWithActivities>(`/api/programs/${encodeURIComponent(id)}`);
    },
    create: async (input: { title: string; date: string; description?: string }): Promise<Program> => {
      if (isElectron()) return window.electronAPI!.programs.create(input);
      return fetchJson<Program>('/api/programs', { method: 'POST', body: JSON.stringify(input) });
    },
    update: async (id: string, input: { title: string; date: string; description?: string }): Promise<Program> => {
      if (isElectron()) return window.electronAPI!.programs.update(id, input);
      return fetchJson<Program>(`/api/programs/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    duplicate: async (id: string, input: { title: string; date: string; description?: string }): Promise<Program> => {
      if (isElectron()) return window.electronAPI!.programs.duplicate(id, input);
      return fetchJson<Program>(`/api/programs/${encodeURIComponent(id)}/duplicate`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    delete: async (id: string): Promise<void> => {
      if (isElectron()) return window.electronAPI!.programs.delete(id);
      await fetchJson(`/api/programs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  activities: {
    create: async (
      programId: string,
      input: { name: string; activist: string; role?: string; hymn_id?: string | null }
    ): Promise<Activity> => {
      if (isElectron()) return window.electronAPI!.activities.create(programId, input);
      return fetchJson<Activity>(`/api/programs/${encodeURIComponent(programId)}/activities`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    update: async (
      id: string,
      input: { name: string; activist: string; role?: string; hymn_id?: string | null }
    ): Promise<Activity> => {
      if (isElectron()) return window.electronAPI!.activities.update(id, input);
      return fetchJson<Activity>(`/api/activities/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    delete: async (id: string): Promise<void> => {
      if (isElectron()) return window.electronAPI!.activities.delete(id);
      await fetchJson(`/api/activities/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    reorder: async (programId: string, orderedIds: string[]): Promise<Activity[]> => {
      if (isElectron()) return window.electronAPI!.activities.reorder(programId, orderedIds);
      return fetchJson<Activity[]>(`/api/programs/${encodeURIComponent(programId)}/activities/reorder`, {
        method: 'POST',
        body: JSON.stringify({ orderedIds }),
      });
    },
  },

  announcements: {
    list: async (): Promise<Announcement[]> => {
      if (isElectron()) return window.electronAPI!.announcements.list();
      return fetchJson<Announcement[]>('/api/announcements');
    },
    create: async (input: { title: string; content: string }): Promise<Announcement> => {
      if (isElectron()) return window.electronAPI!.announcements.create(input);
      return fetchJson<Announcement>('/api/announcements', { method: 'POST', body: JSON.stringify(input) });
    },
    update: async (id: string, input: { title: string; content: string }): Promise<Announcement> => {
      if (isElectron()) return window.electronAPI!.announcements.update(id, input);
      return fetchJson<Announcement>(`/api/announcements/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    delete: async (id: string): Promise<void> => {
      if (isElectron()) return window.electronAPI!.announcements.delete(id);
      await fetchJson(`/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  folders: {
    list: async (collectionType?: CollectionType): Promise<Folder[]> => {
      if (isElectron()) return window.electronAPI!.folders.list(collectionType);
      const q = collectionType ? `?collectionType=${encodeURIComponent(collectionType)}` : '';
      return fetchJson<Folder[]>(`/api/folders${q}`);
    },
    create: async (input: { name: string; collection_type: CollectionType }): Promise<Folder> => {
      if (isElectron()) return window.electronAPI!.folders.create(input);
      return fetchJson<Folder>('/api/folders', { method: 'POST', body: JSON.stringify(input) });
    },
    delete: async (id: string): Promise<void> => {
      if (isElectron()) return window.electronAPI!.folders.delete(id);
      await fetchJson(`/api/folders/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },

  hymns: {
    list: async (): Promise<Hymn[]> => {
      if (isElectron()) return window.electronAPI!.hymns.list();
      return fetchJson<Hymn[]>('/api/hymns');
    },
    get: async (id: string): Promise<Hymn | null> => {
      if (isElectron()) return window.electronAPI!.hymns.get(id);
      return fetchJson<Hymn>(`/api/hymns/${encodeURIComponent(id)}`);
    },
    create: async (input: {
      number: string;
      collection_type: CollectionType;
      title: string;
      author?: string;
      folder_id?: string | null;
      folder_name?: string;
      sections: Array<{ section_type: HymnSectionType; content: string }>;
      adminPin?: string;
    }): Promise<Hymn> => {
      if (isElectron()) return window.electronAPI!.hymns.create(input);
      return fetchJson<Hymn>('/api/hymns', { method: 'POST', body: JSON.stringify(input) });
    },
    update: async (
      id: string,
      input: {
        number: string;
        collection_type: CollectionType;
        title: string;
        author?: string;
        folder_id?: string | null;
        folder_name?: string;
        sections: Array<{ section_type: HymnSectionType; content: string }>;
        adminPin?: string;
      }
    ): Promise<Hymn> => {
      if (isElectron()) return window.electronAPI!.hymns.update(id, input);
      return fetchJson<Hymn>(`/api/hymns/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    duplicateToOutros: async (id: string): Promise<Hymn> => {
      if (isElectron()) return window.electronAPI!.hymns.duplicateToOutros(id);
      return fetchJson<Hymn>(`/api/hymns/${encodeURIComponent(id)}/duplicate-outros`, {
        method: 'POST',
      });
    },
    delete: async (id: string, adminPin?: string): Promise<void> => {
      if (isElectron()) return window.electronAPI!.hymns.delete(id, adminPin);
      await fetchJson(`/api/hymns/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(adminPin ? { 'x-admin-pin': adminPin } : {}),
        },
        body: JSON.stringify({ adminPin }),
      });
    },
  },

  admin: {
    verifyPin: async (pin: string): Promise<{ valid: boolean }> => {
      if (isElectron()) return window.electronAPI!.admin.verifyPin(pin);
      return fetchJson<{ valid: boolean }>('/api/admin/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
    },
    changePin: async (currentPin: string, newPin: string): Promise<{ ok: boolean }> => {
      if (isElectron()) return window.electronAPI!.admin.changePin(currentPin, newPin);
      return fetchJson<{ ok: boolean }>('/api/admin/change-pin', {
        method: 'POST',
        body: JSON.stringify({ currentPin, newPin }),
      });
    },
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      if (isElectron()) return window.electronAPI!.settings.get();
      return fetchJson<AppSettings>('/api/settings');
    },
    save: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
      if (isElectron()) return window.electronAPI!.settings.save(settings);
      return fetchJson<AppSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    },
  },

  displays: {
    list: async (): Promise<DisplayInfo[]> => {
      if (isElectron()) return window.electronAPI!.displays.list();
      const width = typeof window !== 'undefined' ? window.screen.width : 1920;
      const height = typeof window !== 'undefined' ? window.screen.height : 1080;
      return [
        {
          id: 'primary-display',
          name: 'Monitor Principal do Sistema',
          width,
          height,
          isPrimary: true,
          scaleFactor: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
        },
      ];
    },
  },

  backup: {
    exportData: async (): Promise<BackupPayload> => {
      if (isElectron()) return window.electronAPI!.backup.exportData();
      return fetchJson<BackupPayload>('/api/backup/export');
    },
    restoreData: async (payload: BackupPayload): Promise<{ ok: boolean; message: string }> => {
      if (isElectron()) return window.electronAPI!.backup.restoreData(payload);
      return fetchJson<{ ok: boolean; message: string }>('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  projection: {
    getState: async (): Promise<ProjectionState> => {
      if (isElectron()) return window.electronAPI!.projection.getState();
      return fetchJson<ProjectionState>('/api/projection');
    },
    setState: async (state: Partial<ProjectionState>): Promise<ProjectionState> => {
      if (isElectron()) return window.electronAPI!.projection.setState(state);
      return fetchJson<ProjectionState>('/api/projection', {
        method: 'POST',
        body: JSON.stringify(state),
      });
    },
    openScreen: async (): Promise<ProjectionState> => {
      if (isElectron()) return window.electronAPI!.projection.openScreen();
      return fetchJson<ProjectionState>('/api/projection', {
        method: 'POST',
        body: JSON.stringify({ isScreenOpen: true }),
      });
    },
    closeScreen: async (): Promise<ProjectionState> => {
      if (isElectron()) return window.electronAPI!.projection.closeScreen();
      return fetchJson<ProjectionState>('/api/projection', {
        method: 'POST',
        body: JSON.stringify({ isScreenOpen: false }),
      });
    },
    subscribe: (
      onProjection: (state: ProjectionState) => void,
      onSettings?: (settings: AppSettings) => void
    ): (() => void) => {
      if (isElectron()) {
        const unsubState = window.electronAPI!.projection.onStateChanged(onProjection);
        const unsubSettings = onSettings
          ? window.electronAPI!.projection.onSettingsChanged(onSettings)
          : () => {};
        return () => {
          unsubState();
          unsubSettings();
        };
      }

      const es = new EventSource('/api/projection/stream');
      es.addEventListener('projection', (e) => {
        try {
          onProjection(JSON.parse((e as MessageEvent).data) as ProjectionState);
        } catch {
          // ignore malformed event
        }
      });
      if (onSettings) {
        es.addEventListener('settings', (e) => {
          try {
            onSettings(JSON.parse((e as MessageEvent).data) as AppSettings);
          } catch {
            // ignore malformed event
          }
        });
      }
      return () => es.close();
    },
  },
};
