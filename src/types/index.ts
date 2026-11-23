export type PageId =
  | 'dashboard'
  | 'programs'
  | 'program-details'
  | 'announcements'
  | 'hymns'
  | 'projection'
  | 'settings';

export type CollectionType = 'Hinário' | 'Coletânea' | 'Outros';

export type HymnSectionType = 'Estrofe' | 'Coro';

export type BackgroundType = 'color' | 'image';

export type ProjectionContentType =
  | 'idle'
  | 'activity'
  | 'hymn-title'
  | 'hymn-section'
  | 'announcement'
  | 'free-text';

export interface Program {
  id: string;
  title: string;
  date: string;
  description: string;
  created_at: string;
  updated_at: string;
  activity_count?: number;
}

export interface Activity {
  id: string;
  program_id: string;
  order_index: number;
  name: string;
  activist: string;
  role: string;
  hymn_id: string | null;
  created_at: string;
}

export interface ProgramWithActivities extends Program {
  activities: Activity[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  collection_type: CollectionType;
  created_at: string;
}

export interface HymnSection {
  id: string;
  hymn_id?: string;
  order_index: number;
  section_type: HymnSectionType;
  section_number: number;
  content: string;
}

export interface Hymn {
  id: string;
  number: string;
  collection_type: CollectionType;
  title: string;
  author: string;
  folder_id: string | null;
  folder_name: string;
  created_at: string;
  updated_at: string;
  verse_count?: number;
  chorus_count?: number;
  sections?: HymnSection[];
}

export interface AppSettings {
  church_name: string;
  waiting_text: string;
  main_bg_type: BackgroundType;
  main_bg_color: string;
  main_bg_image: string;
  activity_bg_type: BackgroundType;
  activity_bg_color: string;
  activity_bg_image: string;
  hymn_bg_type: BackgroundType;
  hymn_bg_color: string;
  hymn_bg_image: string;
  projection_display_id: string;
  projection_display_name: string;
  show_idle_text_on_image: boolean;
  update_manifest_url?: string;
  feedback_email?: string;
  feedback_whatsapp?: string;
  welcome_guide_seen?: boolean;
}

export interface DisplayInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
  scaleFactor?: number;
}

export interface ProjectionSlide {
  type: ProjectionContentType;
  title: string;
  subtitle?: string;
  body?: string;
  meta?: string;
  sectionLabel?: string;
  sourceId?: string;
  sectionIndex?: number;
}

export interface ProjectionState {
  isScreenOpen: boolean;
  isBlackScreen: boolean;
  liveSlide: ProjectionSlide;
  updatedAt: string;
}

export interface BackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  data: {
    programs: Program[];
    activities: Activity[];
    announcements: Announcement[];
    folders: Folder[];
    hymns: Hymn[];
    hymn_sections: HymnSection[];
    settings: Record<string, string>;
  };
}

export interface ElectronAPI {
  isElectron: boolean;
  programs: {
    list: () => Promise<Program[]>;
    get: (id: string) => Promise<ProgramWithActivities | null>;
    create: (input: { title: string; date: string; description?: string }) => Promise<Program>;
    update: (id: string, input: { title: string; date: string; description?: string }) => Promise<Program>;
    duplicate: (id: string, input: { title: string; date: string; description?: string }) => Promise<Program>;
    delete: (id: string) => Promise<void>;
  };
  activities: {
    create: (programId: string, input: { name: string; activist: string; role?: string; hymn_id?: string | null }) => Promise<Activity>;
    update: (id: string, input: { name: string; activist: string; role?: string; hymn_id?: string | null }) => Promise<Activity>;
    delete: (id: string) => Promise<void>;
    reorder: (programId: string, orderedIds: string[]) => Promise<Activity[]>;
  };
  announcements: {
    list: () => Promise<Announcement[]>;
    create: (input: { title: string; content: string }) => Promise<Announcement>;
    update: (id: string, input: { title: string; content: string }) => Promise<Announcement>;
    delete: (id: string) => Promise<void>;
  };
  folders: {
    list: (collectionType?: CollectionType) => Promise<Folder[]>;
    create: (input: { name: string; collection_type: CollectionType }) => Promise<Folder>;
    delete: (id: string) => Promise<void>;
  };
  hymns: {
    list: () => Promise<Hymn[]>;
    get: (id: string) => Promise<Hymn | null>;
    create: (input: {
      number: string;
      collection_type: CollectionType;
      title: string;
      author?: string;
      folder_id?: string | null;
      folder_name?: string;
      sections: Array<{ section_type: HymnSectionType; content: string }>;
      adminPin?: string;
    }) => Promise<Hymn>;
    update: (
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
    ) => Promise<Hymn>;
    duplicateToOutros: (id: string) => Promise<Hymn>;
    delete: (id: string, adminPin?: string) => Promise<void>;
  };
  admin: {
    verifyPin: (pin: string) => Promise<{ valid: boolean }>;
    changePin: (currentPin: string, newPin: string) => Promise<{ ok: boolean }>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    save: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  };
  displays: {
    list: () => Promise<DisplayInfo[]>;
  };
  backup: {
    exportData: () => Promise<BackupPayload>;
    restoreData: (payload: BackupPayload) => Promise<{ ok: boolean; message: string }>;
  };
  projection: {
    getState: () => Promise<ProjectionState>;
    setState: (state: Partial<ProjectionState>) => Promise<ProjectionState>;
    openScreen: () => Promise<ProjectionState>;
    closeScreen: () => Promise<ProjectionState>;
    onStateChanged: (callback: (state: ProjectionState) => void) => () => void;
    onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
