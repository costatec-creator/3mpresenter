import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  ExternalLink,
  FileText,
  Link2,
  Link2Off,
  ListOrdered,
  Megaphone,
  Monitor,
  MonitorOff,
  Music2,
  Play,
  Search,
  Square,
  X,
} from 'lucide-react';
import { dataService, formatDatePt } from '../../services/dataService.ts';
import {
  formatHymnNumber,
  ProjectionSlide as SlideRenderer,
  toRomanNumeral,
} from '../../components/ProjectionSlide.tsx';
import type {
  Activity,
  Announcement,
  AppSettings,
  Hymn,
  Program,
  ProgramWithActivities,
  ProjectionSlide,
  ProjectionState,
} from '../../types/index.ts';

interface ProjectionControlPageProps {
  settings: AppSettings;
  projectionState: ProjectionState;
  initialProgramId?: string | null;
  initialHymnId?: string | null;
  initialAnnouncementId?: string | null;
  onProjectionStateChange: (state: ProjectionState) => void;
  onOpenBrowserFullscreen: () => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type SourceTab = 'activities' | 'hymns' | 'announcements' | 'free-text';

export function ProjectionControlPage({
  settings,
  projectionState,
  initialProgramId,
  initialHymnId,
  initialAnnouncementId,
  onProjectionStateChange,
  onOpenBrowserFullscreen,
  onNotify,
}: ProjectionControlPageProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(initialProgramId || '');
  const [selectedProgram, setSelectedProgram] = useState<ProgramWithActivities | null>(null);

  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [selectedHymn, setSelectedHymn] = useState<Hymn | null>(null);
  const [hymnSearch, setHymnSearch] = useState('');
  const [isSearchingHymn, setIsSearchingHymn] = useState(false);
  const hymnSearchInputRef = useRef<HTMLInputElement | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [activeTab, setActiveTab] = useState<SourceTab>(
    initialHymnId ? 'hymns' : initialAnnouncementId ? 'announcements' : 'activities'
  );

  // Free text fields
  const [freeTitle, setFreeTitle] = useState('');
  const [freeBody, setFreeBody] = useState('');

  // Sync mode: when active and projection is live, clicking/advancing moves the projector too
  const [syncLive, setSyncLive] = useState<boolean>(true);

  // Preview state (preserves live slide when returning to Projection page)
  const [previewSlide, setPreviewSlide] = useState<ProjectionSlide>(() =>
    projectionState.liveSlide.type !== 'idle'
      ? projectionState.liveSlide
      : {
          type: 'idle',
          title: settings.church_name,
          body: settings.waiting_text,
        }
  );

  // Track active indices / keys for Recuar / Avançar navigation
  const [programHymnsMap, setProgramHymnsMap] = useState<Record<string, Hymn>>({});
  const [expandedOrderActivityId, setExpandedOrderActivityId] = useState<string | null>(null);
  const [selectedOrderKey, setSelectedOrderKey] = useState<string | null>(null);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number>(-1);
  const [showBlackPreview, setShowBlackPreview] = useState<boolean>(projectionState.isBlackScreen);
  const activeOrderItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setShowBlackPreview(projectionState.isBlackScreen);
  }, [projectionState.isBlackScreen]);

  const isLiveActive = projectionState.liveSlide.type !== 'idle';

  useEffect(() => {
    async function loadInitial() {
      try {
        const [pList, hList, aList] = await Promise.all([
          dataService.programs.list(),
          dataService.hymns.list(),
          dataService.announcements.list(),
        ]);
        setPrograms(pList);
        setHymns(hList);
        setAnnouncements(aList);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Erro ao carregar dados de projecção.', 'error');
      }
    }
    loadInitial();
  }, []);

  useEffect(() => {
    if (initialProgramId) {
      setSelectedProgramId(initialProgramId);
      setActiveTab('activities');
    }
  }, [initialProgramId]);

  useEffect(() => {
    if (initialHymnId) {
      setActiveTab('hymns');
      loadHymnDetail(initialHymnId);
    }
  }, [initialHymnId]);

  useEffect(() => {
    if (!initialAnnouncementId || announcements.length === 0) return;
    const found = announcements.find((a) => a.id === initialAnnouncementId);
    if (found) {
      setActiveTab('announcements');
      setSelectedOrderKey(null);
      setSelectedSectionIndex(-1);
      setShowBlackPreview(false);
      const slide: ProjectionSlide = {
        type: 'announcement',
        title: found.title,
        body: found.content,
        meta: 'Anúncios',
        sourceId: found.id,
      };
      setPreviewSlide(slide);
      if (syncLive && isLiveActive) {
        sendSlideToProjector(slide);
      }
    }
  }, [initialAnnouncementId, announcements]);

  useEffect(() => {
    if (!selectedProgramId) {
      setSelectedProgram(null);
      setProgramHymnsMap({});
      setExpandedOrderActivityId(null);
      setSelectedOrderKey(null);
      return;
    }
    let active = true;
    dataService.programs
      .get(selectedProgramId)
      .then(async (prog) => {
        if (!active) return;
        if (!prog) {
          setSelectedProgram(null);
          setProgramHymnsMap({});
          return;
        }
        setSelectedProgram(prog);
        setExpandedOrderActivityId(null);
        setSelectedOrderKey(null);

        const hymnIds = Array.from(
          new Set(
            prog.activities
              .map((a) => a.hymn_id)
              .filter((id): id is string => Boolean(id))
          )
        );
        if (hymnIds.length === 0) {
          setProgramHymnsMap({});
          return;
        }
        const loaded = await Promise.all(
          hymnIds.map((hid) => dataService.hymns.get(hid).catch(() => null))
        );
        if (!active) return;
        const map: Record<string, Hymn> = {};
        for (const h of loaded) {
          if (h) map[h.id] = h;
        }
        setProgramHymnsMap(map);
      })
      .catch(() => {
        if (active) {
          setSelectedProgram(null);
          setProgramHymnsMap({});
        }
      });
    return () => {
      active = false;
    };
  }, [selectedProgramId]);

  const sendSlideToProjector = useCallback(
    async (slide: ProjectionSlide) => {
      try {
        const updated = await dataService.projection.setState({
          isBlackScreen: false,
          liveSlide: slide,
        });
        onProjectionStateChange(updated);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'Erro ao projectar conteúdo.', 'error');
      }
    },
    [onProjectionStateChange, onNotify]
  );

  const applySlideSelection = useCallback(
    (slide: ProjectionSlide) => {
      setShowBlackPreview(false);
      setPreviewSlide(slide);
      if (syncLive && isLiveActive) {
        sendSlideToProjector(slide);
      }
    },
    [syncLive, isLiveActive, sendSlideToProjector]
  );

  // Total hymn slides = 1 (Title cover) + sections.length
  const totalHymnSlides = selectedHymn ? 1 + (selectedHymn.sections?.length ?? 0) : 0;

  async function loadHymnDetail(hymnId: string) {
    try {
      const full = await dataService.hymns.get(hymnId);
      if (full) {
        setSelectedHymn(full);
        setHymnSearch('');
        setIsSearchingHymn(false);
        // Start on Slide 0: Hymn Title Cover ("Hino Nº 001" / "Ó Deus de Amor")
        selectHymnSlide(full, 0);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar hino.', 'error');
    }
  }

  function buildActivitySlide(act: Activity): ProjectionSlide {
    return {
      type: 'activity',
      title: act.name,
      subtitle: act.activist,
      body: act.role || '',
      meta: '',
      sourceId: act.id,
    };
  }

  function buildHymnSlideAt(hymn: Hymn, slideIdx: number): ProjectionSlide | null {
    const formattedNum = formatHymnNumber(hymn.number);
    const coverHeading =
      hymn.collection_type === 'Coletânea'
        ? `Coletânea Jovem · ${formattedNum}`
        : `Hino Nº ${formattedNum}`;

    if (slideIdx === 0) {
      return {
        type: 'hymn-title',
        title: coverHeading,
        subtitle: hymn.title,
        sourceId: hymn.id,
        sectionIndex: 0,
      };
    }

    const secIdx = slideIdx - 1;
    const sections = hymn.sections || [];
    const sec = sections[secIdx];
    if (!sec) return null;
    const label =
      sec.section_type === 'Estrofe'
        ? toRomanNumeral(sec.section_number)
        : sec.section_number > 1
          ? `Coro ${toRomanNumeral(sec.section_number)}`
          : 'Coro';

    return {
      type: 'hymn-section',
      title: `${coverHeading} — ${hymn.title}`,
      sectionLabel: label,
      body: sec.content,
      meta: '',
      sourceId: hymn.id,
      sectionIndex: slideIdx,
    };
  }

  type OrderTimelineStep =
    | { key: string; kind: 'activity'; activity: Activity; activityIndex: number }
    | {
        key: string;
        kind: 'hymn-slide';
        activity: Activity;
        activityIndex: number;
        hymn: Hymn;
        slideIdx: number;
        label: string;
        previewText: string;
      };

  const orderTimeline = useMemo<OrderTimelineStep[]>(() => {
    if (!selectedProgram) return [];
    const steps: OrderTimelineStep[] = [];
    selectedProgram.activities.forEach((act, activityIndex) => {
      steps.push({
        key: `act:${act.id}`,
        kind: 'activity',
        activity: act,
        activityIndex,
      });

      const linkedHymn = act.hymn_id ? programHymnsMap[act.hymn_id] : undefined;
      if (linkedHymn) {
        const formattedNum = formatHymnNumber(linkedHymn.number);
        const coverTitle =
          linkedHymn.collection_type === 'Coletânea'
            ? `Coletânea Jovem · ${formattedNum} · ${linkedHymn.title}`
            : `Hino Nº ${formattedNum} · ${linkedHymn.title}`;
        steps.push({
          key: `hymn:${act.id}:0`,
          kind: 'hymn-slide',
          activity: act,
          activityIndex,
          hymn: linkedHymn,
          slideIdx: 0,
          label: 'Título (1ª Tela)',
          previewText: coverTitle,
        });

        (linkedHymn.sections || []).forEach((sec, idx) => {
          const slideIdx = idx + 1;
          const label =
            sec.section_type === 'Estrofe'
              ? `Estrofe ${toRomanNumeral(sec.section_number)}`
              : sec.section_number > 1
                ? `Coro ${toRomanNumeral(sec.section_number)}`
                : 'Coro';
          steps.push({
            key: `hymn:${act.id}:${slideIdx}`,
            kind: 'hymn-slide',
            activity: act,
            activityIndex,
            hymn: linkedHymn,
            slideIdx,
            label,
            previewText: sec.content,
          });
        });
      }
    });
    return steps;
  }, [selectedProgram, programHymnsMap]);

  const selectedOrderIdx = useMemo(
    () => (selectedOrderKey ? orderTimeline.findIndex((s) => s.key === selectedOrderKey) : -1),
    [orderTimeline, selectedOrderKey]
  );

  useEffect(() => {
    if (activeTab === 'activities' && activeOrderItemRef.current) {
      activeOrderItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeTab, selectedOrderKey]);

  const selectOrderStep = useCallback(
    (step: OrderTimelineStep, forceLive = false) => {
      setSelectedOrderKey(step.key);
      setSelectedSectionIndex(-1);
      setShowBlackPreview(false);

      if (step.kind === 'activity') {
        setExpandedOrderActivityId(step.activity.hymn_id ? step.activity.id : null);
        const slide = buildActivitySlide(step.activity);
        setPreviewSlide(slide);
        if (forceLive || (syncLive && isLiveActive)) {
          sendSlideToProjector(slide);
        }
      } else {
        setExpandedOrderActivityId(step.activity.id);
        const slide = buildHymnSlideAt(step.hymn, step.slideIdx);
        if (!slide) return;
        setPreviewSlide(slide);
        if (forceLive || (syncLive && isLiveActive)) {
          sendSlideToProjector(slide);
        }
      }
    },
    [syncLive, isLiveActive, sendSlideToProjector]
  );

  const openInlineActivityHymn = useCallback(
    async (act: Activity, idx: number) => {
      if (!act.hymn_id) return;
      let hymn = programHymnsMap[act.hymn_id];
      if (!hymn) {
        try {
          const loaded = await dataService.hymns.get(act.hymn_id);
          if (loaded) {
            hymn = loaded;
            setProgramHymnsMap((prev) => ({ ...prev, [loaded.id]: loaded }));
          }
        } catch (err) {
          onNotify(err instanceof Error ? err.message : 'Erro ao carregar letra do hino.', 'error');
          return;
        }
      }
      if (!hymn) return;
      setExpandedOrderActivityId(act.id);
      const slide = buildHymnSlideAt(hymn, 0);
      if (!slide) return;
      setSelectedOrderKey(`hymn:${act.id}:0`);
      setSelectedSectionIndex(-1);
      setShowBlackPreview(false);
      setPreviewSlide(slide);
      if (syncLive && isLiveActive) {
        sendSlideToProjector(slide);
      }
      void idx;
    },
    [programHymnsMap, syncLive, isLiveActive, sendSlideToProjector, onNotify]
  );

  const selectHymnSlide = useCallback(
    (hymn: Hymn, slideIdx: number, forceLive = false) => {
      const slide = buildHymnSlideAt(hymn, slideIdx);
      if (!slide) return;
      setSelectedSectionIndex(slideIdx);
      setSelectedOrderKey(null);
      setShowBlackPreview(false);
      setPreviewSlide(slide);
      if (forceLive || (syncLive && isLiveActive)) {
        sendSlideToProjector(slide);
      }
    },
    [syncLive, isLiveActive, sendSlideToProjector]
  );

  function selectAnnouncement(ann: Announcement, forceLive = false) {
    setSelectedOrderKey(null);
    setSelectedSectionIndex(-1);
    setShowBlackPreview(false);
    const slide: ProjectionSlide = {
      type: 'announcement',
      title: ann.title,
      body: ann.content,
      meta: 'Anúncios',
      sourceId: ann.id,
    };
    setPreviewSlide(slide);
    if (forceLive || (syncLive && isLiveActive)) {
      sendSlideToProjector(slide);
    }
  }

  function applyFreeTextToPreview() {
    if (!freeTitle.trim() && !freeBody.trim()) {
      onNotify('Escreva um título ou texto para pré-visualizar.', 'error');
      return;
    }
    setSelectedOrderKey(null);
    setSelectedSectionIndex(-1);
    applySlideSelection({
      type: 'free-text',
      title: freeTitle.trim() || settings.church_name,
      body: freeBody.trim(),
      meta: freeTitle.trim() ? settings.church_name : '',
    });
  }

  const handleProjectNow = useCallback(async () => {
    await sendSlideToProjector(previewSlide);
  }, [previewSlide, sendSlideToProjector]);

  async function handleClearScreen() {
    try {
      const idleSlide: ProjectionSlide = {
        type: 'idle',
        title: settings.church_name,
        body: settings.waiting_text,
      };
      setShowBlackPreview(false);
      setSelectedOrderKey(null);
      setExpandedOrderActivityId(null);
      setSelectedSectionIndex(-1);
      setPreviewSlide(idleSlide);
      const updated = await dataService.projection.setState({
        isBlackScreen: false,
        liveSlide: idleSlide,
      });
      onProjectionStateChange(updated);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao limpar ecrã.', 'error');
    }
  }

  const handleToggleBlackScreen = useCallback(async () => {
    const nextBlack = !projectionState.isBlackScreen;
    setShowBlackPreview(nextBlack);
    try {
      const updated = await dataService.projection.setState({
        isBlackScreen: nextBlack,
      });
      onProjectionStateChange(updated);
    } catch (err) {
      setShowBlackPreview(projectionState.isBlackScreen);
      onNotify(err instanceof Error ? err.message : 'Erro ao alternar tela preta.', 'error');
    }
  }, [projectionState.isBlackScreen, onProjectionStateChange, onNotify]);

  async function handleOpenOrCloseScreen() {
    try {
      if (dataService.isElectron()) {
        if (projectionState.isScreenOpen) {
          const updated = await dataService.projection.closeScreen();
          onProjectionStateChange(updated);
          onNotify('Ecrã de projecção fechado.', 'info');
        } else {
          const updated = await dataService.projection.openScreen();
          onProjectionStateChange(updated);
          onNotify('Janela de projecção aberta em ecrã inteiro.');
        }
      } else {
        const updated = await dataService.projection.openScreen();
        onProjectionStateChange(updated);
        onOpenBrowserFullscreen();
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao controlar ecrã.', 'error');
    }
  }

  const handleNavigateSlide = useCallback(
    (dir: -1 | 1) => {
      if (activeTab === 'hymns' && selectedHymn && totalHymnSlides > 0) {
        const nextIdx =
          selectedSectionIndex < 0
            ? 0
            : Math.max(0, Math.min(totalHymnSlides - 1, selectedSectionIndex + dir));
        selectHymnSlide(selectedHymn, nextIdx);
        return;
      }

      if (activeTab === 'activities' && orderTimeline.length > 0) {
        const nextIdx =
          selectedOrderIdx < 0
            ? 0
            : Math.max(0, Math.min(orderTimeline.length - 1, selectedOrderIdx + dir));
        selectOrderStep(orderTimeline[nextIdx]);
      }
    },
    [
      activeTab,
      selectedHymn,
      totalHymnSlides,
      selectedSectionIndex,
      orderTimeline,
      selectedOrderIdx,
      selectHymnSlide,
      selectOrderStep,
    ]
  );

  // Keyboard shortcuts: F5 -> Projectar, ArrowLeft/PageUp -> Recuar, ArrowRight/PageDown -> Avançar, B -> Tela Preta
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

      if (e.key === 'F5') {
        e.preventDefault();
        handleProjectNow();
        return;
      }

      if (!isInputFocused) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          handleNavigateSlide(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          handleNavigateSlide(-1);
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          handleToggleBlackScreen();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleProjectNow, handleNavigateSlide, handleToggleBlackScreen]);

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const hymnSearchResults = useMemo(() => {
    const rawQ = hymnSearch.trim();
    if (!rawQ) return { items: [] as Hymn[], total: 0 };

    const q = normalizeText(rawQ);
    const qDotNormalized = q.replace(/\./g, '-');
    const isNumericQuery = /^\d+$/.test(rawQ);
    const queryNum = isNumericQuery ? Number.parseInt(rawQ, 10) : NaN;

    const scored: Array<{ hymn: Hymn; rank: number }> = [];
    for (const h of hymns) {
      const numRaw = h.number.trim();
      const numNormalized = numRaw.toLowerCase();
      const parsedNum = /^\d+$/.test(numRaw) ? Number.parseInt(numRaw, 10) : NaN;
      const titleNormalized = normalizeText(h.title);
      const folderNormalized = normalizeText(h.folder_name || '');

      let rank = -1;
      if (isNumericQuery && !Number.isNaN(parsedNum) && parsedNum === queryNum) {
        rank = 0;
      } else if (numNormalized === q || numNormalized === qDotNormalized) {
        rank = 0;
      } else if (numNormalized.startsWith(q) || numNormalized.startsWith(qDotNormalized)) {
        rank = 1;
      } else if (numNormalized.includes(q) || numNormalized.includes(qDotNormalized)) {
        rank = 2;
      } else if (titleNormalized.startsWith(q)) {
        rank = 3;
      } else if (titleNormalized.includes(q)) {
        rank = 4;
      } else if (folderNormalized.includes(q)) {
        rank = 5;
      }

      if (rank >= 0) {
        scored.push({ hymn: h, rank });
      }
    }

    scored.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const na = Number.parseInt(a.hymn.number, 10);
      const nb = Number.parseInt(b.hymn.number, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return a.hymn.number.localeCompare(b.hymn.number);
    });

    return {
      items: scored.slice(0, 40).map((s) => s.hymn),
      total: scored.length,
    };
  }, [hymns, hymnSearch]);

  // Check whether technician preview matches what is currently live on the projector
  const isPreviewSyncedWithLive =
    isLiveActive &&
    !projectionState.isBlackScreen &&
    previewSlide.type === projectionState.liveSlide.type &&
    previewSlide.title === projectionState.liveSlide.title &&
    previewSlide.subtitle === projectionState.liveSlide.subtitle &&
    previewSlide.sectionLabel === projectionState.liveSlide.sectionLabel &&
    previewSlide.body === projectionState.liveSlide.body;

  const canGoPrev =
    (activeTab === 'hymns' && totalHymnSlides > 0 && selectedSectionIndex > 0) ||
    (activeTab === 'activities' && orderTimeline.length > 0 && selectedOrderIdx > 0);

  const canGoNext =
    (activeTab === 'hymns' && totalHymnSlides > 0 && selectedSectionIndex < totalHymnSlides - 1) ||
    (activeTab === 'activities' &&
      orderTimeline.length > 0 &&
      selectedOrderIdx < orderTimeline.length - 1);

  return (
    <div className="space-y-4">
      {/* Top Program Selector & Presentation Command Bar */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] px-5 py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
          <label
            htmlFor="proj-program-select"
            className="text-sm font-semibold text-[#0F233C] whitespace-nowrap"
          >
            Selecionar Programa
          </label>
          <select
            id="proj-program-select"
            value={selectedProgramId ?? ''}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="flex-1 max-w-md px-3.5 py-2 text-sm bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#0F233C]"
          >
            <option value="">Escolha um programa...</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({formatDatePt(p.date)})
              </option>
            ))}
          </select>
        </div>

        {/* Main Presentation Commands */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleProjectNow}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-[#D4A64A]" />
            <span>Projectar (F5)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenOrCloseScreen}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
              projectionState.isScreenOpen
                ? 'bg-[#D4A64A]/15 border-[#D4A64A] text-[#0F233C]'
                : 'bg-white border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA]'
            }`}
          >
            {projectionState.isScreenOpen ? (
              <MonitorOff className="w-4 h-4 text-[#1E3A5F]" />
            ) : (
              <Monitor className="w-4 h-4 text-[#1E3A5F]" />
            )}
            <span>
              {dataService.isElectron() && projectionState.isScreenOpen
                ? 'Desligar Projector'
                : 'Ligar Projector'}
            </span>
          </button>

          {!dataService.isElectron() && (
            <a
              href="/?screen=projection"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#5F6B7A] hover:text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
              title="Abrir ecrã independente para o projector noutra janela"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ecrã Projector</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleClearScreen}
            title="Voltar para a tela inicial de boas-vindas da igreja"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-[#E5E1D8] bg-white text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
          >
            <Eraser className="w-4 h-4 text-[#5F6B7A]" />
            <span>Boas-Vindas</span>
          </button>

          <button
            type="button"
            onClick={handleToggleBlackScreen}
            title="Escurecer o ecrã do projector (tecla B)"
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
              projectionState.isBlackScreen
                ? 'bg-[#0F233C] border-[#0F233C] text-white'
                : 'bg-white border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA]'
            }`}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Tela Preta</span>
          </button>
        </div>
      </section>

      {/* Main Two-Column Control Workspace sized to fit cleanly in one viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Content Selection */}
        <section className="lg:col-span-5 bg-white rounded-xl border border-[#E5E1D8] overflow-hidden flex flex-col h-[540px] lg:h-[590px]">
          {/* Content Type Tabs */}
          <div className="p-2 bg-[#FAF9F5] border-b border-[#E5E1D8] grid grid-cols-2 sm:grid-cols-4 gap-1 shrink-0">
            {(
              [
                { id: 'activities', label: 'Ordem', icon: ListOrdered },
                { id: 'hymns', label: 'Hinos', icon: Music2 },
                { id: 'announcements', label: 'Anúncios', icon: Megaphone },
                { id: 'free-text', label: 'Texto Livre', icon: FileText },
              ] as Array<{ id: SourceTab; label: string; icon: typeof ListOrdered }>
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#1E3A5F] text-white shadow-sm'
                      : 'text-[#5F6B7A] hover:text-[#0F233C] hover:bg-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#D4A64A]' : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panel Body */}
          <div className="p-4 flex-1 overflow-y-auto">
            {activeTab === 'activities' && (
              <div>
                {!selectedProgram ? (
                  <div className="py-16 text-center">
                    <ListOrdered className="w-9 h-9 text-[#1E3A5F]/35 mx-auto mb-2.5" />
                    <p className="text-sm font-medium text-[#0F233C]">
                      Nenhum programa seleccionado
                    </p>
                    <p className="text-xs text-[#5F6B7A] mt-1">
                      Escolha um programa acima para carregar as actividades.
                    </p>
                  </div>
                ) : selectedProgram.activities.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm font-medium text-[#0F233C]">
                      Este programa ainda não tem actividades.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedProgram.activities.map((act, idx) => {
                      const actKey = `act:${act.id}`;
                      const isActivitySelected = selectedOrderKey === actKey;
                      const isExpanded = expandedOrderActivityId === act.id;
                      const inlineHymnSteps =
                        isExpanded && act.hymn_id
                          ? orderTimeline.filter(
                              (s): s is Extract<OrderTimelineStep, { kind: 'hymn-slide' }> =>
                                s.kind === 'hymn-slide' && s.activity.id === act.id
                            )
                          : [];

                      return (
                        <div key={act.id} className="space-y-1.5">
                          <div
                            className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-2.5 ${
                              isActivitySelected
                                ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.06]'
                                : isExpanded
                                  ? 'border-[#D4A64A]/70 bg-[#FAF9F5]'
                                  : 'border-[#E5E1D8] bg-white hover:bg-[#FAF9F5]'
                            }`}
                          >
                            <button
                              ref={isActivitySelected ? activeOrderItemRef : undefined}
                              type="button"
                              onClick={() =>
                                selectOrderStep({
                                  key: actKey,
                                  kind: 'activity',
                                  activity: act,
                                  activityIndex: idx,
                                })
                              }
                              onDoubleClick={() =>
                                selectOrderStep(
                                  {
                                    key: actKey,
                                    kind: 'activity',
                                    activity: act,
                                    activityIndex: idx,
                                  },
                                  true
                                )
                              }
                              title="Clique para seleccionar ou duplo clique para projectar"
                              className="flex-1 text-left min-w-0 flex items-center gap-2.5"
                            >
                              <span className="w-7 h-7 rounded-md bg-[#FAF9F5] border border-[#E5E1D8] flex items-center justify-center text-xs font-semibold text-[#1E3A5F] tabular-nums shrink-0">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[#0F233C] truncate">
                                  {act.name}
                                </div>
                                <div className="text-xs text-[#5F6B7A] truncate">
                                  {act.activist}
                                  {act.role ? ` · ${act.role}` : ''}
                                </div>
                              </div>
                            </button>

                            {act.hymn_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isExpanded && selectedOrderKey?.startsWith(`hymn:${act.id}:`)) {
                                    setExpandedOrderActivityId(null);
                                  } else {
                                    openInlineActivityHymn(act, idx);
                                  }
                                }}
                                title="Abrir letra do hino aqui mesmo na ordem do culto"
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border shrink-0 whitespace-nowrap transition-colors ${
                                  isExpanded
                                    ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white'
                                    : 'border-[#D4A64A]/70 bg-[#FAF9F5] text-[#0F233C] hover:bg-[#D4A64A]/20'
                                }`}
                              >
                                <Music2
                                  className={`w-3.5 h-3.5 ${isExpanded ? 'text-[#D4A64A]' : 'text-[#1E3A5F]'}`}
                                />
                                <span>{isExpanded ? 'Letra Aberta' : 'Abrir Letra'}</span>
                              </button>
                            )}
                          </div>

                          {/* Inline Hymn Slides inside Ordem */}
                          {isExpanded && inlineHymnSteps.length > 0 && (
                            <div className="ml-4 pl-3 border-l-2 border-[#D4A64A]/70 space-y-1.5 py-1">
                              {inlineHymnSteps.map((hStep) => {
                                const isSlideActive = selectedOrderKey === hStep.key;
                                return (
                                  <button
                                    key={hStep.key}
                                    ref={isSlideActive ? activeOrderItemRef : undefined}
                                    type="button"
                                    onClick={() => selectOrderStep(hStep)}
                                    onDoubleClick={() => selectOrderStep(hStep, true)}
                                    title="Clique para seleccionar ou duplo clique para projectar"
                                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                                      isSlideActive
                                        ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.07]'
                                        : 'border-[#E5E1D8] bg-white hover:bg-[#FAF9F5]'
                                    }`}
                                  >
                                    <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">
                                      {hStep.label}
                                    </div>
                                    <p className="text-xs text-[#0F233C] whitespace-pre-line line-clamp-2 leading-relaxed">
                                      {hStep.previewText}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'hymns' && (
              <div className="space-y-3">
                {(!selectedHymn || isSearchingHymn) ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-[#5F6B7A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          ref={hymnSearchInputRef}
                          type="text"
                          value={hymnSearch}
                          onChange={(e) => setHymnSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && hymnSearchResults.items.length > 0) {
                              e.preventDefault();
                              loadHymnDetail(hymnSearchResults.items[0].id);
                            } else if (e.key === 'Escape' && selectedHymn) {
                              e.preventDefault();
                              setHymnSearch('');
                              setIsSearchingHymn(false);
                            }
                          }}
                          placeholder="Pesquisar hino ou cântico (ex: 001, 2013-02, Calebe)..."
                          className="w-full pl-9 pr-8 py-2 text-sm bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] text-[#0F233C]"
                        />
                        {hymnSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setHymnSearch('');
                              hymnSearchInputRef.current?.focus();
                            }}
                            title="Limpar pesquisa"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6B7A] hover:text-[#0F233C]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {selectedHymn && (
                        <button
                          type="button"
                          onClick={() => {
                            setHymnSearch('');
                            setIsSearchingHymn(false);
                          }}
                          className="px-3 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-white text-[#5F6B7A] hover:text-[#0F233C] hover:bg-[#FAF9F5] shrink-0"
                        >
                          Voltar
                        </button>
                      )}
                    </div>

                    {hymnSearch.trim().length === 0 ? (
                      <div className="py-16 text-center px-4">
                        <Music2 className="w-9 h-9 text-[#1E3A5F]/35 mx-auto mb-2.5" />
                        <p className="text-sm font-medium text-[#0F233C]">
                          Pesquise um hino para projectar
                        </p>
                        <p className="text-xs text-[#5F6B7A] mt-1 leading-relaxed">
                          Digite o número ou parte do título acima. Após seleccionar, apenas o hino escolhido ficará visível para evitar cliques acidentais.
                        </p>
                      </div>
                    ) : hymnSearchResults.total === 0 ? (
                      <div className="py-12 text-center">
                        <p className="text-sm font-medium text-[#0F233C]">
                          Nenhum hino encontrado para &ldquo;{hymnSearch.trim()}&rdquo;
                        </p>
                        <p className="text-xs text-[#5F6B7A] mt-1">
                          Verifique o número ou experimente outra palavra do título.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-[#5F6B7A] px-0.5">
                          <span>
                            {hymnSearchResults.total === 1
                              ? '1 hino encontrado'
                              : `${hymnSearchResults.total} hinos encontrados`}
                            {hymnSearchResults.total > hymnSearchResults.items.length
                              ? ` (a mostrar ${hymnSearchResults.items.length})`
                              : ''}
                          </span>
                          <span>Clique para abrir</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 max-h-[410px] overflow-y-auto pr-1">
                          {hymnSearchResults.items.map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => loadHymnDetail(h.id)}
                              className={`text-left px-3 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                                selectedHymn?.id === h.id
                                  ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.06]'
                                  : 'border-[#E5E1D8] hover:bg-[#FAF9F5]'
                              }`}
                            >
                              <span className="text-xs font-medium text-[#0F233C] truncate">
                                <span className="tabular-nums font-semibold text-[#1E3A5F]">
                                  {formatHymnNumber(h.number)} —
                                </span>{' '}
                                {h.title}
                              </span>
                              <span className="text-[11px] text-[#5F6B7A] shrink-0">
                                {h.collection_type}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    {/* Locked Selected Hymn Header */}
                    <div className="flex items-center justify-between gap-2.5 pb-2.5 border-b border-[#E5E1D8]">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6B7A]">
                          {selectedHymn.collection_type === 'Coletânea'
                            ? `Coletânea Jovem${selectedHymn.folder_name ? ` · ${selectedHymn.folder_name}` : ''}`
                            : selectedHymn.collection_type}
                        </div>
                        <h4 className="text-sm font-semibold text-[#1E3A5F] truncate">
                          {selectedHymn.collection_type === 'Coletânea'
                            ? `${formatHymnNumber(selectedHymn.number)} — ${selectedHymn.title}`
                            : `Hino Nº ${formatHymnNumber(selectedHymn.number)} — ${selectedHymn.title}`}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchingHymn(true);
                          setHymnSearch('');
                          setTimeout(() => hymnSearchInputRef.current?.focus(), 0);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] shrink-0 whitespace-nowrap"
                      >
                        <Search className="w-3.5 h-3.5 text-[#1E3A5F]" />
                        <span>Trocar Hino</span>
                      </button>
                    </div>

                    {/* Selected Hymn Slides Only */}
                    <div className="space-y-1.5">
                      {/* Slide 0: Title Cover */}
                      <button
                        type="button"
                        onClick={() => selectHymnSlide(selectedHymn, 0)}
                        onDoubleClick={() => selectHymnSlide(selectedHymn, 0, true)}
                        title="Clique para seleccionar ou duplo clique para projectar"
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          previewSlide.type === 'hymn-title' &&
                          previewSlide.sourceId === selectedHymn.id
                            ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.06]'
                            : 'border-[#E5E1D8] hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">
                          Título (1ª Tela)
                        </div>
                        <p className="text-xs text-[#0F233C] font-medium truncate">
                          {selectedHymn.collection_type === 'Coletânea'
                            ? `Coletânea Jovem · ${formatHymnNumber(selectedHymn.number)}`
                            : `Hino Nº ${formatHymnNumber(selectedHymn.number)}`}{' '}
                          · {selectedHymn.title}
                        </p>
                      </button>

                      {/* Slides 1..N: Stanzas and Choruses */}
                      {(selectedHymn.sections || []).map((sec, idx) => {
                        const slideIdx = idx + 1;
                        const label =
                          sec.section_type === 'Estrofe'
                            ? `Estrofe ${toRomanNumeral(sec.section_number)}`
                            : sec.section_number > 1
                              ? `Coro ${toRomanNumeral(sec.section_number)}`
                              : 'Coro';
                        const isSelected =
                          previewSlide.type === 'hymn-section' &&
                          previewSlide.sourceId === selectedHymn.id &&
                          previewSlide.sectionIndex === slideIdx;

                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => selectHymnSlide(selectedHymn, slideIdx)}
                            onDoubleClick={() => selectHymnSlide(selectedHymn, slideIdx, true)}
                            title="Clique para seleccionar ou duplo clique para projectar"
                            className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.06]'
                                : 'border-[#E5E1D8] hover:bg-[#FAF9F5]'
                            }`}
                          >
                            <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">
                              {label}
                            </div>
                            <p className="text-xs text-[#0F233C] whitespace-pre-line line-clamp-2 leading-relaxed">
                              {sec.content}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'announcements' && (
              <div className="space-y-2">
                {announcements.length === 0 ? (
                  <p className="text-sm text-[#5F6B7A] text-center py-12">
                    Nenhum anúncio registado.
                  </p>
                ) : (
                  announcements.map((ann) => {
                    const isSelected =
                      previewSlide.type === 'announcement' && previewSlide.sourceId === ann.id;
                    return (
                      <button
                        key={ann.id}
                        type="button"
                        onClick={() => selectAnnouncement(ann)}
                        onDoubleClick={() => selectAnnouncement(ann, true)}
                        title="Clique para seleccionar ou duplo clique para projectar"
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-[#1E3A5F] bg-[#1E3A5F]/[0.06]'
                            : 'border-[#E5E1D8] hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-[#0F233C]">{ann.title}</div>
                        <p className="text-xs text-[#5F6B7A] mt-1 line-clamp-2 leading-relaxed">
                          {ann.content}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'free-text' && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#0F233C] mb-1">
                    Título ou Referência
                  </label>
                  <input
                    type="text"
                    value={freeTitle}
                    onChange={(e) => setFreeTitle(e.target.value)}
                    placeholder="Ex: Salmos 23:1 / Aviso Especial"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F233C] mb-1">
                    Texto para Projecção
                  </label>
                  <textarea
                    rows={6}
                    value={freeBody}
                    onChange={(e) => setFreeBody(e.target.value)}
                    placeholder="Escreva a mensagem, texto bíblico ou aviso que deseja projectar..."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-y"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={applyFreeTextToPreview}
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E]"
                  >
                    Carregar no Ecrã
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Single Focused Operator Screen + Direct Projector Sync */}
        <section className="lg:col-span-7 bg-white rounded-xl border border-[#E5E1D8] p-5 flex flex-col gap-4 lg:min-h-[590px]">
          {/* Header with State & Direct Sync Switch */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E5E1D8] shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#0F233C]">
                  {isPreviewSyncedWithLive ? 'Pré-visualização · A projectar' : 'Pré-visualização'}
                </h3>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    projectionState.isBlackScreen
                      ? 'bg-[#0F233C] text-white'
                      : isLiveActive
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-[#FAF9F5] text-[#5F6B7A] border border-[#E5E1D8]'
                  }`}
                >
                  {projectionState.isBlackScreen
                    ? 'Tela Preta'
                    : isLiveActive
                      ? 'A Projectar'
                      : 'Em Espera'}
                </span>
              </div>
              <p className="text-xs text-[#5F6B7A] mt-1">
                {syncLive
                  ? isLiveActive
                    ? 'Cada clique ou seta (← →) muda logo no projector.'
                    : 'Clique em "Iniciar Projecção (F5)" abaixo para enviar para o projector.'
                  : 'Modo preparação: o projector não muda até clicar em Projectar (F5).'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSyncLive((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                syncLive
                  ? 'bg-[#1E3A5F]/10 border-[#1E3A5F]/30 text-[#1E3A5F]'
                  : 'bg-[#FAF9F5] border-[#E5E1D8] text-[#5F6B7A] hover:text-[#0F233C]'
              }`}
              title="Alternar se o projector acompanha automaticamente ao clicar ou usar as setas"
            >
              {syncLive ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
              <span>{syncLive ? 'Projectar ao Clicar' : 'Só Preparar'}</span>
            </button>
          </div>

          {/* Framed 16:9 Stage with Generous Breathing Room */}
          <div className="flex-1 flex items-center justify-center rounded-xl bg-[#FAF9F5] border border-[#E5E1D8]/90 p-5 sm:p-6 min-h-0">
            <div className="w-full max-w-[540px] aspect-video rounded-lg overflow-hidden border border-[#E5E1D8] shadow-md">
              <SlideRenderer
                slide={previewSlide}
                settings={settings}
                isBlackScreen={showBlackPreview}
                compact
              />
            </div>
          </div>

          {/* Bottom Controls: Recuar / Avançar + Live Status Indicator */}
          <div className="pt-3 border-t border-[#E5E1D8] space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={() => handleNavigateSlide(-1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Recuar</span>
                </button>
                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={() => handleNavigateSlide(1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <span>Avançar</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleProjectNow}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 text-[#D4A64A]" />
                <span>{isLiveActive ? 'Enviar para o Projector (F5)' : 'Iniciar Projecção (F5)'}</span>
              </button>
            </div>

            {/* Compact Live Reference Bar */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E1D8] text-xs">
              <span className="text-[#5F6B7A] truncate">
                <strong className="text-[#0F233C]">No projector agora:</strong>{' '}
                {projectionState.isBlackScreen
                  ? 'Tela Preta activa'
                  : isLiveActive
                    ? `${projectionState.liveSlide.title}${
                        projectionState.liveSlide.sectionLabel
                          ? ` (${projectionState.liveSlide.sectionLabel})`
                          : ''
                      }`
                    : 'Ecrã de espera da igreja'}
              </span>
              {!isPreviewSyncedWithLive && isLiveActive && (
                <span className="text-[#1E3A5F] font-semibold shrink-0">
                  Pré-visualização diferente do projector
                </span>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
