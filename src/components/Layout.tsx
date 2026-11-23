import type { ReactNode } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  MessageSquarePlus,
  MonitorPlay,
  Music2,
  Settings,
} from 'lucide-react';
import type { PageId } from '../types/index.ts';

interface LayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenFeedback?: () => void;
  onOpenGuide?: () => void;
  pageTitle: string;
  pageSubtitle?: string;
  churchName: string;
  isProjectionLive: boolean;
  isBlackScreen: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
  { id: 'programs', label: 'Programas', icon: CalendarDays },
  { id: 'announcements', label: 'Anúncios', icon: Megaphone },
  { id: 'hymns', label: 'Hinos', icon: Music2 },
  { id: 'projection', label: 'Projecção', icon: MonitorPlay },
  { id: 'settings', label: 'Definições', icon: Settings },
];

export function Layout({
  currentPage,
  onNavigate,
  onOpenFeedback,
  onOpenGuide,
  pageTitle,
  pageSubtitle,
  churchName,
  isProjectionLive,
  isBlackScreen,
  headerAction,
  children,
}: LayoutProps) {
  const activeNavId = currentPage === 'program-details' ? 'programs' : currentPage;

  return (
    <div className="min-h-screen flex bg-[#FAF9F5] text-[#0F233C]">
      {/* Left Fixed Sidebar */}
      <aside className="w-[260px] shrink-0 bg-white border-r border-[#E5E1D8] flex flex-col justify-between sticky top-0 h-screen select-none">
        <div>
          {/* Top Brand Identity */}
          <div className="px-6 py-6 border-b border-[#E5E1D8]">
            <div className="flex items-center gap-3.5">
              {/* 3MP inside blue square with small gold detail at bottom */}
              <div className="relative w-11 h-11 rounded-lg bg-[#1E3A5F] flex flex-col items-center justify-center shadow-sm shrink-0 overflow-hidden">
                <span className="text-white font-bold text-sm tracking-tight leading-none pt-0.5">
                  3MP
                </span>
                <span className="absolute bottom-0 inset-x-0 h-[4px] bg-[#D4A64A]" />
              </div>
              <div className="min-w-0">
                <div className="font-editorial text-xl font-bold text-[#0F233C] leading-tight truncate">
                  3MPresenter
                </div>
                <div className="text-xs font-medium text-[#5F6B7A] truncate">
                  Painel de Controlo
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="px-3.5 py-5 space-y-1" aria-label="Menu principal">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1E3A5F] text-white shadow-sm'
                      : 'text-[#5F6B7A] hover:text-[#0F233C] hover:bg-[#F3F1EA]'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? 'text-[#D4A64A]' : 'text-[#5F6B7A]'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.id === 'projection' && isProjectionLive && (
                    <span
                      className={`ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                        isActive
                          ? 'bg-white/15 text-[#D4A64A]'
                          : 'bg-[#1E3A5F]/10 text-[#1E3A5F]'
                      }`}
                    >
                      {isBlackScreen ? 'Preta' : 'No Ar'}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Guide, Feedback & Copyright */}
        <div className="px-4 py-4 border-t border-[#E5E1D8] space-y-2.5">
          {(onOpenGuide || onOpenFeedback) && (
            <div className="space-y-1.5">
              {onOpenGuide && (
                <button
                  type="button"
                  onClick={onOpenGuide}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#0F233C] bg-[#FAF9F5] border border-[#E5E1D8] hover:bg-[#F3F1EA] transition-colors"
                >
                  <BookOpenCheck className="w-4 h-4 text-[#1E3A5F] shrink-0" />
                  <span>Guia do Utilizador</span>
                </button>
              )}
              {onOpenFeedback && (
                <button
                  type="button"
                  onClick={onOpenFeedback}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#1E3A5F] bg-[#FAF9F5] border border-[#E5E1D8] hover:bg-[#F3F1EA] transition-colors"
                >
                  <MessageSquarePlus className="w-4 h-4 text-[#D4A64A] shrink-0" />
                  <span>Ajuda e Sugestões</span>
                </button>
              )}
            </div>
          )}
          <div className="px-2 pt-1 text-xs text-[#5F6B7A] leading-relaxed">
            <p className="font-medium text-[#0F233C]">© 3MPresenter</p>
            <p>Todos os direitos reservados.</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Horizontal Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#E5E1D8] px-8 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#5F6B7A]">
                <span className="truncate">{churchName || '3MPresenter'}</span>
                {pageSubtitle && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="truncate">{pageSubtitle}</span>
                  </>
                )}
              </div>
              <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#0F233C] leading-tight truncate mt-0.5">
                {pageTitle}
              </h1>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {headerAction}
              {activeNavId !== 'projection' && (
                <button
                  type="button"
                  onClick={() => onNavigate('projection')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#1E3A5F]/20 bg-[#FAF9F5] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <MonitorPlay className="w-4 h-4 shrink-0" />
                  <span>Controlo de Projecção</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Central Controlled-Width Content */}
        <main className="flex-1 px-8 py-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
