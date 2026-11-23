import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { dataService } from './services/dataService.ts';
import { useToast } from './hooks/useToast.ts';
import { Layout } from './components/Layout.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { ProjectionSlide } from './components/ProjectionSlide.tsx';
import { FeedbackModal } from './components/FeedbackModal.tsx';
import { WelcomeGuideModal } from './components/WelcomeGuideModal.tsx';
import { DashboardPage } from './pages/dashboard/DashboardPage.tsx';
import { ProgramsPage } from './pages/programs/ProgramsPage.tsx';
import { ProgramDetailsPage } from './pages/programs/ProgramDetailsPage.tsx';
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage.tsx';
import { HymnsPage } from './pages/hymns/HymnsPage.tsx';
import { ProjectionControlPage } from './pages/projection/ProjectionControlPage.tsx';
import { ProjectionWindowPage } from './pages/projection/ProjectionWindowPage.tsx';
import { SettingsPage } from './pages/settings/SettingsPage.tsx';
import {
  checkForAppUpdate,
  DEFAULT_FEEDBACK_EMAIL,
  DEFAULT_FEEDBACK_WHATSAPP,
  DEFAULT_UPDATE_MANIFEST_URL,
  type UpdateCheckResult,
} from './config/appMeta.ts';
import type { AppSettings, PageId, ProjectionState } from './types/index.ts';

const INITIAL_SETTINGS: AppSettings = {
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
  update_manifest_url: DEFAULT_UPDATE_MANIFEST_URL,
  feedback_email: DEFAULT_FEEDBACK_EMAIL,
  feedback_whatsapp: DEFAULT_FEEDBACK_WHATSAPP,
  welcome_guide_seen: true,
};

const INITIAL_PROJECTION: ProjectionState = {
  isScreenOpen: false,
  isBlackScreen: false,
  liveSlide: {
    type: 'idle',
    title: 'Igreja Central',
    body: 'Sejam bem-vindos à Casa do Senhor',
  },
  updatedAt: '',
};

const PAGE_TITLES: Record<PageId, { title: string; subtitle?: string }> = {
  dashboard: { title: 'Painel', subtitle: 'Visão Geral' },
  programs: { title: 'Programas', subtitle: 'Gestão de Cultos' },
  'program-details': { title: 'Ordem do Culto', subtitle: 'Programas' },
  announcements: { title: 'Anúncios da Igreja', subtitle: 'Avisos à Congregação' },
  hymns: { title: 'Hinos e Cânticos', subtitle: 'Repositório Musical' },
  projection: { title: 'Controlo de Projecção', subtitle: 'Ecrã da Igreja' },
  settings: { title: 'Definições', subtitle: 'Configurações do Sistema' },
};

export default function App() {
  const isProjectionScreen =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('screen') === 'projection';

  if (isProjectionScreen) {
    return <ProjectionWindowPage />;
  }

  return <ControlPanelApp />;
}

function ControlPanelApp() {
  const { toasts, showToast, dismissToast } = useToast();

  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [projectionProgramId, setProjectionProgramId] = useState<string | null>(null);
  const [projectionHymnId, setProjectionHymnId] = useState<string | null>(null);
  const [projectionAnnouncementId, setProjectionAnnouncementId] = useState<string | null>(null);

  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [projectionState, setProjectionState] = useState<ProjectionState>(INITIAL_PROJECTION);

  // Web preview fullscreen presentation overlay when not running inside Electron
  const [browserScreenOverlay, setBrowserScreenOverlay] = useState(false);

  // Admin Principal session unlock (always starts locked for church distribution safety)
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([dataService.settings.get(), dataService.projection.getState()])
      .then(([s, p]) => {
        if (!active) return;
        setSettings(s);
        setProjectionState(p);
        if (!s.welcome_guide_seen) {
          setGuideModalOpen(true);
        }
        checkForAppUpdate(s.update_manifest_url).then((res) => {
          if (active && res.status === 'update-available') {
            setUpdateInfo(res);
          }
        });
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
    if (!browserScreenOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBrowserScreenOverlay(false);
        dataService.projection.closeScreen().then(setProjectionState).catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [browserScreenOverlay]);

  function handleNavigate(page: PageId) {
    if (page !== 'projection') {
      setProjectionHymnId(null);
      setProjectionAnnouncementId(null);
    }
    setCurrentPage(page);
  }

  function handleOpenProgram(programId: string) {
    setSelectedProgramId(programId);
    setCurrentPage('program-details');
  }

  function handleProjectProgram(programId: string) {
    setProjectionProgramId(programId);
    setProjectionHymnId(null);
    setProjectionAnnouncementId(null);
    setCurrentPage('projection');
  }

  function handleProjectHymn(hymnId: string) {
    setProjectionHymnId(hymnId);
    setProjectionAnnouncementId(null);
    setCurrentPage('projection');
  }

  function handleProjectAnnouncement(announcementId: string) {
    setProjectionAnnouncementId(announcementId);
    setProjectionHymnId(null);
    setCurrentPage('projection');
  }

  const headerInfo = PAGE_TITLES[currentPage];

  return (
    <>
      <Layout
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onOpenFeedback={() => setFeedbackModalOpen(true)}
        onOpenGuide={() => setGuideModalOpen(true)}
        pageTitle={headerInfo.title}
        pageSubtitle={headerInfo.subtitle}
        churchName={settings.church_name}
        isProjectionLive={projectionState.liveSlide.type !== 'idle'}
        isBlackScreen={projectionState.isBlackScreen}
      >
        <div key={currentPage} className="transition-opacity duration-150">
          {currentPage === 'dashboard' && (
            <DashboardPage
              settings={settings}
              projectionState={projectionState}
              updateInfo={updateInfo}
              onNavigate={handleNavigate}
              onOpenProgram={handleOpenProgram}
              onProjectProgram={handleProjectProgram}
            />
          )}

          {currentPage === 'programs' && (
            <ProgramsPage onOpenProgram={handleOpenProgram} onNotify={showToast} />
          )}

          {currentPage === 'program-details' && selectedProgramId && (
            <ProgramDetailsPage
              programId={selectedProgramId}
              onBack={() => handleNavigate('programs')}
              onOpenProjection={handleProjectProgram}
              onNotify={showToast}
            />
          )}

          {currentPage === 'announcements' && (
            <AnnouncementsPage
              onProjectAnnouncement={handleProjectAnnouncement}
              onNotify={showToast}
            />
          )}

          {currentPage === 'hymns' && (
            <HymnsPage
              adminPin={adminPin}
              onAdminLock={() => setAdminPin(null)}
              onProjectHymn={handleProjectHymn}
              onNotify={showToast}
            />
          )}

          {currentPage === 'projection' && (
            <ProjectionControlPage
              settings={settings}
              projectionState={projectionState}
              initialProgramId={projectionProgramId}
              initialHymnId={projectionHymnId}
              initialAnnouncementId={projectionAnnouncementId}
              onProjectionStateChange={setProjectionState}
              onOpenBrowserFullscreen={() => setBrowserScreenOverlay(true)}
              onNotify={showToast}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              settings={settings}
              adminPin={adminPin}
              updateInfo={updateInfo}
              onAdminUnlock={(pin) => setAdminPin(pin)}
              onAdminLock={() => setAdminPin(null)}
              onUpdateInfoChange={setUpdateInfo}
              onSettingsUpdated={setSettings}
              onOpenFeedback={() => setFeedbackModalOpen(true)}
              onNotify={showToast}
            />
          )}
        </div>
      </Layout>

      {/* Browser Preview Fullscreen Projection Overlay (when outside Electron) */}
      {browserScreenOverlay && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            type="button"
            onClick={() => {
              setBrowserScreenOverlay(false);
              dataService.projection.closeScreen().then(setProjectionState).catch(() => {});
            }}
            className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-black/60 text-white/85 hover:text-white border border-white/20 backdrop-blur-sm transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar Ecrã (Esc)</span>
          </button>
          <ProjectionSlide
            slide={projectionState.liveSlide}
            settings={settings}
            isBlackScreen={projectionState.isBlackScreen}
          />
        </div>
      )}

      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        settings={settings}
        onNotify={showToast}
      />

      <WelcomeGuideModal
        open={guideModalOpen}
        isFirstLaunch={!settings.welcome_guide_seen}
        settings={settings}
        onClose={() => setGuideModalOpen(false)}
        onComplete={async (churchName) => {
          try {
            const saved = await dataService.settings.save({
              church_name: churchName,
              welcome_guide_seen: true,
            });
            setSettings(saved);
          } catch {
            // Even if save fails momentarily, close gracefully
          }
          setGuideModalOpen(false);
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
