import { Copy, MonitorPlay } from 'lucide-react';
import { COLLECTION_LABELS } from '../../services/dataService.ts';
import { Modal } from '../../components/Modal.tsx';
import type { Hymn } from '../../types/index.ts';

interface HymnLyricsModalProps {
  hymn: Hymn | null;
  onClose: () => void;
  onProjectHymn: (hymn: Hymn) => void;
  onDuplicateToOutros?: (hymn: Hymn) => void;
}

export function HymnLyricsModal({
  hymn,
  onClose,
  onProjectHymn,
  onDuplicateToOutros,
}: HymnLyricsModalProps) {
  if (!hymn) return null;

  const sections = hymn.sections || [];
  const isOfficial = hymn.collection_type !== 'Outros';

  return (
    <Modal
      open={Boolean(hymn)}
      onClose={onClose}
      title={
        hymn.collection_type === 'Coletânea'
          ? `${hymn.number} — ${hymn.title}`
          : `Hino ${hymn.number} — ${hymn.title}`
      }
      subtitle={`${COLLECTION_LABELS[hymn.collection_type]}${hymn.folder_name ? ` · ${hymn.folder_name}` : ''}${hymn.author ? ` · ${hymn.author}` : ''}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        {sections.length === 0 ? (
          <p className="text-sm text-[#5F6B7A] py-6 text-center">
            Este hino ainda não possui estrofes ou coros registados.
          </p>
        ) : (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            {sections.map((sec) => {
              const label =
                sec.section_type === 'Estrofe'
                  ? `Estrofe ${sec.section_number}`
                  : sec.section_number > 1
                    ? `Coro ${sec.section_number}`
                    : 'Coro';

              return (
                <div
                  key={sec.id}
                  className={`p-4 rounded-xl border ${
                    sec.section_type === 'Coro'
                      ? 'bg-[#FAF9F5] border-[#D4A64A]/45'
                      : 'bg-white border-[#E5E1D8]'
                  }`}
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-2">{label}</div>
                  <p className="text-sm text-[#0F233C] whitespace-pre-line leading-relaxed">
                    {sec.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E5E1D8]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
          >
            Fechar
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {isOfficial && onDuplicateToOutros && (
              <button
                type="button"
                onClick={() => onDuplicateToOutros(hymn)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#0F233C] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg hover:bg-[#F3F1EA]"
                title="Criar uma cópia editável na colecção Outros sem alterar o hino oficial"
              >
                <Copy className="w-4 h-4 text-[#1E3A5F]" />
                <span>Duplicar para Outros</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onProjectHymn(hymn);
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-lg hover:bg-[#2D5A8E]"
            >
              <MonitorPlay className="w-4 h-4 text-[#D4A64A]" />
              <span>Enviar para Projecção</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
