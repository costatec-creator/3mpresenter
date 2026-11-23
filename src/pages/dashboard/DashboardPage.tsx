import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Download,
  Megaphone,
  MonitorPlay,
  Music2,
  Plus,
} from 'lucide-react';
import { dataService, formatDatePt } from '../../services/dataService.ts';
import type { UpdateCheckResult } from '../../config/appMeta.ts';
import type {
  Announcement,
  AppSettings,
  Hymn,
  PageId,
  Program,
  ProjectionState,
} from '../../types/index.ts';

interface DashboardPageProps {
  settings: AppSettings;
  projectionState: ProjectionState;
  updateInfo?: UpdateCheckResult | null;
  onNavigate: (page: PageId) => void;
  onOpenProgram: (programId: string) => void;
  onProjectProgram: (programId: string) => void;
}

export function DashboardPage({
  settings,
  projectionState,
  updateInfo,
  onNavigate,
  onOpenProgram,
  onProjectProgram,
}: DashboardPageProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [p, a, h] = await Promise.all([
          dataService.programs.list(),
          dataService.announcements.list(),
          dataService.hymns.list(),
        ]);
        if (!active) return;
        setPrograms(p);
        setAnnouncements(a);
        setHymns(h);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingPrograms = [...programs]
    .filter((p) => p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const displayedPrograms = upcomingPrograms.length > 0 ? upcomingPrograms : programs.slice(0, 4);

  const hinarioCount = hymns.filter((h) => h.collection_type === 'Hinário').length;
  const coletaneaCount = hymns.filter((h) => h.collection_type === 'Coletânea').length;
  const outrosCount = hymns.filter((h) => h.collection_type === 'Outros').length;

  return (
    <div className="space-y-8">
      {/* Discrete New Version Banner (only shown if online and newer version published) */}
      {updateInfo?.status === 'update-available' && (
        <section className="bg-[#1E3A5F] text-white rounded-xl border border-[#1E3A5F] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#D4A64A]">
              Nova Versão Disponível · v{updateInfo.latestVersion}
            </div>
            <p className="text-sm text-white/90 mt-0.5 truncate">
              {updateInfo.releaseNotes
                ? updateInfo.releaseNotes
                : 'Há uma nova atualização do 3MPresenter disponível para download.'}
            </p>
          </div>
          {updateInfo.downloadUrl ? (
            <a
              href={updateInfo.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#D4A64A] text-[#0F233C] hover:bg-[#DFB561] transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Versão {updateInfo.latestVersion}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white/15 text-white hover:bg-white/25 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Ver Detalhes</span>
            </button>
          )}
        </section>
      )}

      {/* Welcome & Projection Quick Control Banner */}
      <section className="bg-white rounded-xl border border-[#E5E1D8] p-6 sm:p-7 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#5F6B7A]">
            {settings.church_name || '3MPresenter'} · Gestão do Culto
          </p>
          <h2 className="font-editorial text-3xl font-semibold text-[#0F233C] leading-tight text-balance">
            Bem-vindo ao Painel de Controlo
          </h2>
          <p className="text-sm text-[#5F6B7A] max-w-2xl leading-relaxed">
            Organize a ordem dos cultos, mantenha os anúncios da congregação actualizados,
            consulte o hinário e controle a projecção em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('programs')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#1E3A5F]" />
            <span>Gerir Programas</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('projection')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors shadow-sm whitespace-nowrap"
          >
            <MonitorPlay className="w-4 h-4 text-[#D4A64A]" />
            <span>Controlo de Projecção</span>
          </button>
        </div>
      </section>

      {/* Summary Row: 4 Operational Access Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          type="button"
          onClick={() => onNavigate('programs')}
          className="text-left bg-white rounded-xl border border-[#E5E1D8] p-5 hover:border-[#2D5A8E]/40 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#5F6B7A]">Programas</span>
            <CalendarDays className="w-5 h-5 text-[#1E3A5F]" />
          </div>
          <div className="text-3xl font-semibold text-[#0F233C] tabular-nums">
            {loading ? '—' : programs.length}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5F6B7A]">
            <span>{upcomingPrograms.length} agendados</span>
            <span className="text-[#1E3A5F] font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Abrir <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('announcements')}
          className="text-left bg-white rounded-xl border border-[#E5E1D8] p-5 hover:border-[#2D5A8E]/40 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#5F6B7A]">Anúncios</span>
            <Megaphone className="w-5 h-5 text-[#1E3A5F]" />
          </div>
          <div className="text-3xl font-semibold text-[#0F233C] tabular-nums">
            {loading ? '—' : announcements.length}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5F6B7A]">
            <span>Avisos registados</span>
            <span className="text-[#1E3A5F] font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
              Consultar <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('hymns')}
          className="text-left bg-white rounded-xl border border-[#E5E1D8] p-5 hover:border-[#2D5A8E]/40 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#5F6B7A]">Hinos e Cânticos</span>
            <Music2 className="w-5 h-5 text-[#1E3A5F]" />
          </div>
          <div className="text-3xl font-semibold text-[#0F233C] tabular-nums">
            {loading ? '—' : hymns.length}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5F6B7A]">
            <span className="truncate">
              {hinarioCount} Hinário · {coletaneaCount} Coletânea · {outrosCount} Outros
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('projection')}
          className="text-left bg-white rounded-xl border border-[#E5E1D8] p-5 hover:border-[#D4A64A] hover:shadow-sm transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[#5F6B7A]">Projecção</span>
            <MonitorPlay className="w-5 h-5 text-[#D4A64A]" />
          </div>
          <div className="text-xl font-semibold text-[#0F233C] leading-tight pt-1">
            {projectionState.isBlackScreen
              ? 'Tela Preta'
              : projectionState.isScreenOpen
                ? 'Ecrã Activo'
                : 'Pronto a Projectar'}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#5F6B7A]">
            <span className="truncate">
              {projectionState.liveSlide.type === 'idle'
                ? 'Em espera'
                : projectionState.liveSlide.title}
            </span>
            <span className="text-[#1E3A5F] font-medium inline-flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
              Controlar <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </button>
      </section>

      {/* Main Two-Column Grid: Próximos Programas & Anúncios Recentes */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Próximos Programas */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#E5E1D8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E1D8] flex items-center justify-between gap-4">
            <div>
              <h3 className="font-editorial text-xl font-semibold text-[#0F233C]">
                {upcomingPrograms.length > 0 ? 'Próximos Programas' : 'Programas Recentes'}
              </h3>
              <p className="text-xs text-[#5F6B7A]">
                Seleccione um programa para gerir a ordem do culto ou projectar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('programs')}
              className="text-xs font-medium text-[#1E3A5F] hover:text-[#2D5A8E] whitespace-nowrap"
            >
              Ver todos
            </button>
          </div>

          <div className="divide-y divide-[#E5E1D8]">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-12 bg-[#FAF9F5] rounded-lg animate-pulse" />
                <div className="h-12 bg-[#FAF9F5] rounded-lg animate-pulse" />
              </div>
            ) : displayedPrograms.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-[#0F233C]">
                  Ainda não existem programas registados.
                </p>
                <p className="text-xs text-[#5F6B7A] mt-1">
                  Crie o primeiro programa de culto para organizar as actividades.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('programs')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Programa
                </button>
              </div>
            ) : (
              displayedPrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-[#FAF9F5]/80 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-[#5F6B7A] tabular-nums">
                      {formatDatePt(prog.date)} · {prog.activity_count ?? 0}{' '}
                      {(prog.activity_count ?? 0) === 1 ? 'actividade' : 'actividades'}
                    </div>
                    <h4 className="text-sm font-semibold text-[#0F233C] truncate mt-0.5">
                      {prog.title}
                    </h4>
                    {prog.description && (
                      <p className="text-xs text-[#5F6B7A] truncate mt-0.5">{prog.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenProgram(prog.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E5E1D8] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors whitespace-nowrap"
                    >
                      Ver detalhes
                    </button>
                    <button
                      type="button"
                      onClick={() => onProjectProgram(prog.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors whitespace-nowrap"
                    >
                      Projectar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Anúncios Recentes */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#E5E1D8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E1D8] flex items-center justify-between gap-4">
            <div>
              <h3 className="font-editorial text-xl font-semibold text-[#0F233C]">
                Anúncios da Igreja
              </h3>
              <p className="text-xs text-[#5F6B7A]">Últimos avisos disponíveis para a congregação.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('announcements')}
              className="text-xs font-medium text-[#1E3A5F] hover:text-[#2D5A8E] whitespace-nowrap"
            >
              Gerir
            </button>
          </div>

          <div className="divide-y divide-[#E5E1D8]">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-14 bg-[#FAF9F5] rounded-lg animate-pulse" />
                <div className="h-14 bg-[#FAF9F5] rounded-lg animate-pulse" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-[#0F233C]">Sem anúncios registados.</p>
                <p className="text-xs text-[#5F6B7A] mt-1">
                  Registe avisos para partilhar durante o culto.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('announcements')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Anúncio
                </button>
              </div>
            ) : (
              announcements.slice(0, 4).map((ann) => (
                <div key={ann.id} className="px-6 py-4 hover:bg-[#FAF9F5]/80 transition-colors">
                  <div className="text-xs text-[#5F6B7A] tabular-nums">
                    {formatDatePt(ann.created_at)}
                  </div>
                  <h4 className="text-sm font-semibold text-[#0F233C] mt-0.5">{ann.title}</h4>
                  <p className="text-xs text-[#5F6B7A] mt-1 line-clamp-2 leading-relaxed">
                    {ann.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
