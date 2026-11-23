import { useEffect, useState } from 'react';
import { dataService } from '../../services/dataService.ts';
import { ProjectionSlide } from '../../components/ProjectionSlide.tsx';
import type { AppSettings, ProjectionState } from '../../types/index.ts';

const FALLBACK_SETTINGS: AppSettings = {
  church_name: 'Igreja Central',
  waiting_text: 'Sejam bem-vindos à Casa do Senhor',
  main_bg_type: 'color',
  main_bg_color: '#1E3A5F',
  main_bg_image: '',
  activity_bg_type: 'color',
  activity_bg_color: '#13294B',
  activity_bg_image: '',
  hymn_bg_type: 'color',
  hymn_bg_color: '#1E3A5F',
  hymn_bg_image: '',
  projection_display_id: '',
  projection_display_name: '',
  show_idle_text_on_image: false,
};

const FALLBACK_STATE: ProjectionState = {
  isScreenOpen: true,
  isBlackScreen: false,
  liveSlide: {
    type: 'idle',
    title: '',
    body: '',
  },
  updatedAt: '',
};

export function ProjectionWindowPage() {
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [projectionState, setProjectionState] = useState<ProjectionState>(FALLBACK_STATE);
  const [hideCursor, setHideCursor] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([dataService.settings.get(), dataService.projection.getState()])
      .then(([s, p]) => {
        if (!active) return;
        setSettings(s);
        setProjectionState(p);
      })
      .catch(() => {});

    const unsub = dataService.projection.subscribe(
      (nextProj) => {
        if (active) setProjectionState(nextProj);
      },
      (nextSettings) => {
        if (active) setSettings(nextSettings);
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      setHideCursor(false);
      clearTimeout(timer);
      timer = setTimeout(() => setHideCursor(true), 2000);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dataService.projection.closeScreen().catch(() => {});
        if (!window.electronAPI) {
          window.close();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={`w-screen h-screen overflow-hidden bg-black ${hideCursor ? 'cursor-none' : ''}`}>
      <ProjectionSlide
        slide={projectionState.liveSlide}
        settings={settings}
        isBlackScreen={projectionState.isBlackScreen}
      />
    </div>
  );
}
