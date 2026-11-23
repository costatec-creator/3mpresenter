import { useEffect, useState } from 'react';
import { Check, Copy, Mail, MessageCircle } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { APP_VERSION } from '../config/appMeta.ts';
import type { AppSettings } from '../types/index.ts';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onNotify: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CATEGORIES = [
  'Sugestão de Melhoria',
  'Pedido de Hino ou Colecção',
  'Reportar Problema',
  'Dúvida / Pedido de Ajuda',
] as const;

export function FeedbackModal({ open, onClose, settings, onNotify }: FeedbackModalProps) {
  const [sender, setSender] = useState('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSender(settings.church_name || '');
    setCategory(CATEGORIES[0]);
    setMessage('');
    setCopied(false);
  }, [open, settings.church_name]);

  const trimmedMessage = message.trim();
  const formattedBody = [
    `3MPresenter v${APP_VERSION}`,
    `Igreja / Remetente: ${sender.trim() || settings.church_name || 'Não informado'}`,
    `Assunto: ${category}`,
    '',
    trimmedMessage,
  ].join('\n');

  const emailTarget = (settings.feedback_email ?? '').trim();
  const whatsappDigits = (settings.feedback_whatsapp ?? '').replace(/\D+/g, '');

  const mailtoHref = `mailto:${encodeURIComponent(emailTarget)}?subject=${encodeURIComponent(
    `[3MPresenter v${APP_VERSION}] ${category}`
  )}&body=${encodeURIComponent(formattedBody)}`;

  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(formattedBody)}`
    : '';

  async function handleCopy() {
    if (!trimmedMessage) {
      onNotify('Escreva a sua mensagem antes de copiar.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(formattedBody);
      setCopied(true);
      onNotify('Mensagem copiada! Pode colar no WhatsApp ou E-mail.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify('Não foi possível copiar automaticamente. Seleccione o texto manualmente.', 'error');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajuda e Sugestões"
      subtitle="Envie uma dúvida, pedido de hino ou sugestão para melhorar o programa."
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Igreja ou Seu Nome
            </label>
            <input
              type="text"
              value={sender ?? ''}
              onChange={(e) => setSender(e.target.value)}
              placeholder="Ex: Igreja Central / Irmão João"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
              Assunto
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0F233C] mb-1.5">
            Mensagem <span className="text-red-600">*</span>
          </label>
          <textarea
            rows={5}
            value={message ?? ''}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escreva aqui a sua sugestão, dúvida, erro encontrado ou hino que gostaria de ver adicionado..."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E5E1D8] rounded-lg focus:outline-none focus:border-[#1E3A5F] resize-y"
          />
        </div>

        <p className="text-xs text-[#5F6B7A] bg-[#FAF9F5] border border-[#E5E1D8] rounded-lg px-3.5 py-2.5 leading-relaxed">
          Se este computador não tiver internet no momento, clique em <strong>Copiar Mensagem</strong> e envie mais tarde pelo seu telemóvel.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#E5E1D8]">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[#E5E1D8] bg-[#FAF9F5] text-[#0F233C] hover:bg-[#F3F1EA] transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-700" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#1E3A5F]" />
            )}
            <span>{copied ? 'Copiado!' : 'Copiar Mensagem'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {whatsappHref && (
              <a
                href={trimmedMessage ? whatsappHref : '#'}
                target={trimmedMessage ? '_blank' : undefined}
                rel={trimmedMessage ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!trimmedMessage) {
                    e.preventDefault();
                    onNotify('Escreva a sua mensagem primeiro.', 'error');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enviar por WhatsApp</span>
              </a>
            )}

            <a
              href={trimmedMessage ? mailtoHref : '#'}
              onClick={(e) => {
                if (!trimmedMessage) {
                  e.preventDefault();
                  onNotify('Escreva a sua mensagem primeiro.', 'error');
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#1E3A5F] text-white hover:bg-[#2D5A8E] transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-[#D4A64A]" />
              <span>Enviar por E-mail</span>
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}
