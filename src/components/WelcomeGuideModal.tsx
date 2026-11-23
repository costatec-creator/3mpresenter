import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Keyboard,
  Megaphone,
  MonitorPlay,
  Music2,
  Palette,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from './Modal.tsx';
import type { AppSettings } from '../types/index.ts';

interface WelcomeGuideModalProps {
  open: boolean;
  isFirstLaunch: boolean;
  settings: AppSettings;
  onComplete: (churchName: string) => Promise<void> | void;
  onClose: () => void;
}

export function WelcomeGuideModal({
  open,
  isFirstLaunch,
  settings,
  onComplete,
  onClose,
}: WelcomeGuideModalProps) {
  const [churchName, setChurchName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChurchName(settings.church_name ?? '');
  }, [open, settings.church_name]);

  async function handleFinish() {
    setSaving(true);
    try {
      await onComplete(churchName.trim() || settings.church_name || 'Igreja Central');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={isFirstLaunch ? handleFinish : onClose}
      title="Guia Completo do Utilizador — 3MPresenter"
      subtitle="Tudo o que pode fazer no programa, como operar durante o culto e regras de utilização."
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="max-h-[56vh] overflow-y-auto pr-1.5 space-y-4">
          {/* 1. Programas e Ordem do Culto */}
          <section className="rounded-xl border border-[#E5E1D8] bg-[#FAF9F5] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F233C]">
              <CalendarDays className="w-4 h-4 text-[#1E3A5F] shrink-0" />
              <span>1. Preparar o Culto (Programas e Actividades)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#0F233C]/90 leading-relaxed list-disc pl-5">
              <li>
                Em <strong>Programas</strong>, crie o programa do culto (com título, data e tema) e adicione cada momento da <strong>Ordem do Culto</strong> (oração, louvor, leitura, sermão).
              </li>
              <li>
                Pode reordenar as actividades com as setas <strong>↑ / ↓</strong> e usar o botão <strong>Duplicar</strong> para reaproveitar a estrutura de um culto noutro sábado.
              </li>
              <li>
                Ao criar ou editar uma actividade, pesquise pelo número ou nome para <strong>associar o hino logo ali</strong>.
              </li>
            </ul>
          </section>

          {/* 2. Hinos, Coletânea e Cânticos Locais */}
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F233C]">
              <Music2 className="w-4 h-4 text-[#1E3A5F] shrink-0" />
              <span>2. Hinos, Coletânea Jovem e Cânticos da Igreja</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#0F233C]/90 leading-relaxed list-disc pl-5">
              <li>
                Já inclui o <strong>Hinário Adventista (610 hinos)</strong> e a <strong>Coletânea Jovem (224 cânticos)</strong> prontos a usar, totalmente offline.
              </li>
              <li>
                Pesquise rapidamente por número (ex.: <span className="font-mono">32</span>, <span className="font-mono">2013-02</span>), título, autor ou pasta.
              </li>
              <li>
                Em <strong>Outros</strong>, a sua igreja pode criar pastas e adicionar cânticos locais ou coros da congregação.
              </li>
              <li>
                Se precisar adaptar a letra de um hino oficial, abra a letra e clique em <strong>Duplicar para Outros</strong> para criar uma cópia editável sem mexer no original.
              </li>
            </ul>
          </section>

          {/* 3. Anúncios e Texto Livre */}
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F233C]">
              <Megaphone className="w-4 h-4 text-[#1E3A5F] shrink-0" />
              <span>3. Anúncios e Texto Livre na Hora</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#0F233C]/90 leading-relaxed list-disc pl-5">
              <li>
                Em <strong>Anúncios</strong>, registe os avisos da igreja e clique diretamente em <strong>Projectar</strong> no cartão do anúncio quando precisar exibi-lo.
              </li>
              <li>
                Na aba <strong>Texto Livre</strong> da Projecção, pode escrever qualquer versículo bíblico, recado urgente ou aviso na hora e enviar imediatamente para o ecrã.
              </li>
            </ul>
          </section>

          {/* 4. Controlo de Projecção e Atalhos */}
          <section className="rounded-xl border border-[#E5E1D8] bg-[#FAF9F5] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F233C]">
              <MonitorPlay className="w-4 h-4 text-[#1E3A5F] shrink-0" />
              <span>4. Controlar a Projecção ao Vivo e Atalhos do Teclado</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#0F233C]/90 leading-relaxed list-disc pl-5">
              <li>
                Clique em <strong>Ligar Projector</strong> para abrir o ecrã inteiro no projector da igreja e depois em <strong>Iniciar Projecção (F5)</strong>.
              </li>
              <li>
                Na aba <strong>Ordem</strong>, ao chegar a uma actividade com hino associado, as estrofes abrem-se logo na lista (ou clique em <strong>Abrir Letra</strong>) — não precisa mudar de aba!
              </li>
              <li>
                <strong>Projectar ao Clicar vs Só Preparar:</strong> Com <em>Projectar ao Clicar</em> activo, cada clique ou seta muda logo no projector. Em <em>Só Preparar</em>, pode procurar o próximo conteúdo sem alterar o que a igreja está a ver até carregar em <strong>F5</strong>.
              </li>
              <li>
                <strong>Boas-Vindas vs Tela Preta:</strong> <em>Boas-Vindas</em> volta ao ecrã inicial com o nome da igreja; <em>Tela Preta</em> escurece totalmente o projector.
              </li>
            </ul>

            <div className="rounded-lg border border-[#E5E1D8] bg-white px-3.5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-[#0F233C]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E3A5F]">
                <Keyboard className="w-3.5 h-3.5" />
                Atalhos:
              </span>
              <span>
                <strong>F5</strong> Projectar agora
              </span>
              <span>
                <strong>← / →</strong> Recuar / Avançar
              </span>
              <span>
                <strong>B</strong> Tela Preta
              </span>
              <span>
                <strong>Duplo clique</strong> Projectar direto
              </span>
            </div>
          </section>

          {/* 5. Personalização, Fundos, Monitor e Cópias */}
          <section className="rounded-xl border border-[#E5E1D8] bg-white p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F233C]">
              <Palette className="w-4 h-4 text-[#1E3A5F] shrink-0" />
              <span>5. Mudar Fundos da Projecção, Monitor e Cópias de Segurança (Definições)</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#0F233C]/90 leading-relaxed list-disc pl-5">
              <li>
                <strong>Personalizar Fundos (Cor ou Imagem):</strong> Em <strong>Definições</strong>, pode escolher uma <strong>cor</strong> ou carregar uma <strong>imagem do seu computador</strong> separadamente para 3 áreas: <em>Ecrã Principal de Boas-Vindas</em> (com opção de mostrar ou ocultar o texto sobre a foto), <em>Fundo das Actividades</em> e <em>Fundo dos Hinos e Textos</em>.
              </li>
              <li>
                <strong>Escolher o Monitor / Projector:</strong> Seleccione em <strong>Monitor de Projecção</strong> qual ecrã físico (TV ou projector ligado ao computador) deve receber a projecção em ecrã inteiro.
              </li>
              <li>
                <strong>Cópia de Segurança (Backup):</strong> Exporte todos os programas, anúncios, cânticos e configurações para um ficheiro e restaure noutro computador sempre que precisar.
              </li>
              <li>
                <strong>100% Offline, Atualizações e Apoio:</strong> Não precisa de internet nos cultos. Quando estiver online, pode verificar novas versões em <strong>Definições</strong> e enviar dúvidas ou pedidos em <strong>Ajuda e Sugestões</strong>.
              </li>
            </ul>
          </section>

          {/* 6. Regras e O que Deve Respeitar */}
          <section className="rounded-xl border border-[#D4A64A]/60 bg-[#FAF9F5] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0F233C]">
              <ShieldAlert className="w-4 h-4 text-[#D4A64A] shrink-0" />
              <span>6. O que Deve Respeitar ao Utilizar o 3MPresenter</span>
            </div>
            <ul className="space-y-2 text-xs text-[#5F6B7A] leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#0F233C]">Respeitar a integridade dos acervos oficiais:</strong> O Hinário Adventista e a Coletânea Jovem estão protegidos contra edições acidentais para manter a fidelidade das letras. Utilize <strong>Outros</strong> ou <strong>Duplicar para Outros</strong> para adaptações da igreja.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#0F233C]">Uso reverente e exclusivo para a igreja:</strong> Utilize o programa exclusivamente para cultos, reuniões, louvor e evangelismo.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1E3A5F] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#0F233C]">Zelar pelos dados e respeitar a distribuição:</strong> Guarde cópias de segurança regularmente e não altere nem redistribua versões modificadas fora da orientação oficial. Para reportar erros ou pedir novos hinos, use <strong>Ajuda e Sugestões</strong>.
                </span>
              </li>
            </ul>
          </section>
        </div>

        {/* Quick Church Name Setup on First Launch */}
        {isFirstLaunch && (
          <div className="pt-1">
            <label className="block text-xs font-semibold text-[#0F233C] mb-1.5">
              Nome da sua Igreja (aparecerá no ecrã de boas-vindas do projector — pode alterar depois em Definições)
            </label>
            <input
              type="text"
              value={churchName ?? ''}
              onChange={(e) => setChurchName(e.target.value)}
              placeholder="Ex: Igreja Adventista Central"
              className="w-full px-3.5 py-2 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E1D8]">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#5F6B7A]">
            <BookOpenCheck className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>Pode consultar este guia sempre que precisar em &ldquo;Guia do Utilizador&rdquo; no menu lateral.</span>
          </span>

          <button
            type="button"
            disabled={saving}
            onClick={isFirstLaunch ? handleFinish : onClose}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {saving
              ? 'A guardar...'
              : isFirstLaunch
                ? 'Compreendi e Começar'
                : 'Fechar Guia'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
