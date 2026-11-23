import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AppSettings, ProjectionSlide } from '../types/index.ts';

interface ProjectionSlideProps {
  slide: ProjectionSlide;
  settings: AppSettings;
  isBlackScreen?: boolean;
  compact?: boolean;
}

interface AutoFitBoxProps {
  children: (fontSizePx: number) => ReactNode;
  deps: unknown[];
  minPx: number;
  maxPx: number;
  className?: string;
}

export function toRomanNumeral(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return String(num);
  const map: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = Math.floor(num);
  let out = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

export function formatHymnNumber(num: string): string {
  const trimmed = (num || '').trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(3, '0');
  }
  return trimmed;
}

function normalizeHex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(withHash) ? withHash : fallback;
}

/**
 * Dynamically calculates the largest font size (in px) so that the rendered
 * content fits completely inside the available width and height without clipping.
 */
function AutoFitBox({ children, deps, minPx, maxPx, className = '' }: AutoFitBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState<number>(Math.round((minPx + maxPx) / 2));

  const fitText = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const availW = container.clientWidth;
    const availH = container.clientHeight;
    if (availW <= 10 || availH <= 10) return;

    let low = minPx;
    let high = maxPx;
    let best = minPx;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measure.style.fontSize = `${mid}px`;

      const fitsHeight = measure.scrollHeight <= availH;
      const fitsWidth = measure.scrollWidth <= availW;

      if (fitsHeight && fitsWidth) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    measure.style.fontSize = `${best}px`;
    setFontSize(best);
  }, [minPx, maxPx]);

  useLayoutEffect(() => {
    fitText();
  }, [fitText, ...deps]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      fitText();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitText]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center overflow-hidden ${className}`}
    >
      <div
        ref={measureRef}
        style={{ fontSize: `${fontSize}px` }}
        className="w-full flex flex-col items-center justify-center text-center"
      >
        {children(fontSize)}
      </div>
    </div>
  );
}

export function ProjectionSlide({
  slide,
  settings,
  isBlackScreen = false,
  compact = false,
}: ProjectionSlideProps) {
  if (isBlackScreen) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center select-none">
        {compact && (
          <span className="text-xs tracking-wide text-neutral-500 font-medium">
            Tela Preta Activa
          </span>
        )}
      </div>
    );
  }

  // Strictly separate background per slide context so Idle, Activities, and Hymns never conflict
  let bgType = settings.main_bg_type;
  let rawColor = settings.main_bg_color;
  let bgImage = settings.main_bg_image;
  let defaultFallbackColor = '#1E3A5F';

  if (slide.type === 'activity') {
    bgType = settings.activity_bg_type;
    rawColor = settings.activity_bg_color;
    bgImage = settings.activity_bg_image;
    defaultFallbackColor = '#13294B';
  } else if (
    slide.type === 'hymn-title' ||
    slide.type === 'hymn-section' ||
    slide.type === 'announcement' ||
    slide.type === 'free-text'
  ) {
    bgType = settings.hymn_bg_type;
    rawColor = settings.hymn_bg_color;
    bgImage = settings.hymn_bg_image;
    defaultFallbackColor = '#1E3A5F';
  }

  const bgColor = normalizeHex(rawColor, defaultFallbackColor);
  const hasImage = bgType === 'image' && Boolean(bgImage);
  const hideIdleOverlay = slide.type === 'idle' && hasImage && !settings.show_idle_text_on_image;

  const minFont = compact ? 10 : 22;
  const maxFont = compact ? 42 : 128;

  const textShadowStyle = {
    textShadow: '0 2px 16px rgba(0, 0, 0, 0.55), 0 1px 3px rgba(0, 0, 0, 0.45)',
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center text-center select-none font-sans"
      style={{
        backgroundColor: bgColor,
        backgroundImage: hasImage ? `url(${bgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {!hideIdleOverlay && (
        <div
          className={`absolute inset-0 pointer-events-none ${
            hasImage
              ? 'bg-gradient-to-b from-black/60 via-black/48 to-black/68'
              : 'bg-gradient-to-b from-white/[0.04] via-transparent to-black/28'
          }`}
        />
      )}

      <div
        className={`relative z-10 w-full h-full flex flex-col justify-between ${
          compact ? 'px-7 py-4.5' : 'px-14 py-10'
        }`}
      >
        {slide.type === 'idle' && !hideIdleOverlay && (
          <AutoFitBox
            minPx={compact ? 12 : 26}
            maxPx={compact ? 32 : 92}
            deps={[settings.church_name, settings.waiting_text, compact]}
          >
            {(fs) => (
              <div className="max-w-[92%] mx-auto flex flex-col items-center">
                <h1
                  className="font-editorial font-semibold text-white tracking-tight leading-[1.12] text-balance"
                  style={{ fontSize: '1.22em', ...textShadowStyle }}
                >
                  {settings.church_name || 'Igreja Central'}
                </h1>

                <div
                  className="bg-[#D4A64A] rounded-full"
                  style={{
                    width: `${Math.max(36, fs * 1.6)}px`,
                    height: `${Math.max(2, Math.round(fs * 0.07))}px`,
                    marginTop: `${Math.max(6, fs * 0.32)}px`,
                    marginBottom: `${Math.max(6, fs * 0.32)}px`,
                  }}
                />

                <p
                  className="font-sans text-white/95 font-medium leading-[1.35] max-w-[92%]"
                  style={{ fontSize: '0.58em', ...textShadowStyle }}
                >
                  {settings.waiting_text || 'Sejam bem-vindos à Casa do Senhor'}
                </p>
              </div>
            )}
          </AutoFitBox>
        )}

        {slide.type === 'activity' && (
          <AutoFitBox
            minPx={minFont}
            maxPx={compact ? 32 : 98}
            deps={[slide.title, slide.subtitle, slide.body, compact]}
          >
            {(fs) => (
              <div className="max-w-[92%] mx-auto flex flex-col items-center">
                <h1
                  className="font-editorial font-semibold text-white leading-[1.14] tracking-tight text-balance"
                  style={{ fontSize: '1.16em', ...textShadowStyle }}
                >
                  {slide.title}
                </h1>

                <div
                  className="bg-[#D4A64A] rounded-full"
                  style={{
                    width: `${Math.max(36, fs * 1.5)}px`,
                    height: `${Math.max(2, Math.round(fs * 0.07))}px`,
                    marginTop: `${Math.max(6, fs * 0.32)}px`,
                    marginBottom: `${Math.max(6, fs * 0.32)}px`,
                  }}
                />

                {slide.subtitle && (
                  <p
                    className="font-sans text-white font-semibold leading-snug"
                    style={{ fontSize: '0.62em', ...textShadowStyle }}
                  >
                    {slide.subtitle}
                  </p>
                )}

                {slide.body && (
                  <p
                    className="font-sans text-white/85 font-medium leading-snug"
                    style={{
                      fontSize: '0.44em',
                      marginTop: `${Math.max(3, fs * 0.16)}px`,
                      ...textShadowStyle,
                    }}
                  >
                    {slide.body}
                  </p>
                )}
              </div>
            )}
          </AutoFitBox>
        )}

        {/* First Hymn Slide: Hino Nº 001 + Title below */}
        {slide.type === 'hymn-title' && (
          <AutoFitBox
            minPx={minFont}
            maxPx={compact ? 32 : 96}
            deps={[slide.title, slide.subtitle, compact]}
          >
            {(fs) => (
              <div className="max-w-[92%] mx-auto flex flex-col items-center">
                <p
                  className="font-sans font-semibold text-[#D4A64A] tracking-wide"
                  style={{
                    fontSize: '0.62em',
                    marginBottom: `${Math.max(4, fs * 0.28)}px`,
                    ...textShadowStyle,
                  }}
                >
                  {slide.title}
                </p>

                <div
                  className="bg-[#D4A64A]/80 rounded-full"
                  style={{
                    width: `${Math.max(36, fs * 1.4)}px`,
                    height: `${Math.max(2, Math.round(fs * 0.07))}px`,
                    marginBottom: `${Math.max(6, fs * 0.35)}px`,
                  }}
                />

                {slide.subtitle && (
                  <h1
                    className="font-editorial font-semibold text-white leading-[1.15] tracking-tight text-balance"
                    style={{ fontSize: '1.15em', ...textShadowStyle }}
                  >
                    {slide.subtitle}
                  </h1>
                )}
              </div>
            )}
          </AutoFitBox>
        )}

        {/* Subsequent Hymn Slides: Centered smaller stanza marker at top, lyrics centered */}
        {slide.type === 'hymn-section' && (
          <>
            <div
              className={`w-full flex items-center justify-center shrink-0 ${
                compact ? 'mb-2' : 'mb-3'
              }`}
              style={textShadowStyle}
            >
              {slide.sectionLabel && (
                <span
                  className={`font-sans font-semibold text-[#D4A64A] tracking-widest uppercase ${
                    compact ? 'text-[11px]' : 'text-2xl'
                  }`}
                >
                  {slide.sectionLabel}
                </span>
              )}
            </div>

            <div className="flex-1 min-h-0 w-full">
              <AutoFitBox
                minPx={minFont}
                maxPx={maxFont}
                deps={[slide.body, slide.sectionLabel, compact]}
              >
                {() => (
                  <p
                    className="font-sans text-white font-semibold whitespace-pre-line leading-[1.35] tracking-[-0.01em] max-w-[98%] mx-auto"
                    style={textShadowStyle}
                  >
                    {slide.body}
                  </p>
                )}
              </AutoFitBox>
            </div>
          </>
        )}

        {(slide.type === 'announcement' || slide.type === 'free-text') && (
          <>
            {slide.meta && (
              <div
                className={`shrink-0 font-sans text-[#D4A64A] font-semibold uppercase tracking-wider ${
                  compact ? 'text-[10px] mb-2' : 'text-lg mb-3'
                }`}
                style={textShadowStyle}
              >
                {slide.meta}
              </div>
            )}

            <div className="flex-1 min-h-0 w-full">
              <AutoFitBox
                minPx={minFont}
                maxPx={compact ? 28 : 88}
                deps={[slide.title, slide.body, compact]}
              >
                {(fs) => (
                  <div className="max-w-[94%] mx-auto flex flex-col items-center">
                    <h1
                      className="font-editorial font-semibold text-white leading-[1.15] tracking-tight text-balance"
                      style={{ fontSize: '1.02em', ...textShadowStyle }}
                    >
                      {slide.title}
                    </h1>

                    <div
                      className="bg-[#D4A64A] rounded-full"
                      style={{
                        width: `${Math.max(36, fs * 1.4)}px`,
                        height: `${Math.max(2, Math.round(fs * 0.07))}px`,
                        marginTop: `${Math.max(5, fs * 0.28)}px`,
                        marginBottom: `${Math.max(5, fs * 0.28)}px`,
                      }}
                    />

                    {slide.body && (
                      <p
                        className="font-sans text-white/95 font-medium whitespace-pre-line leading-[1.38] max-w-[95%]"
                        style={{ fontSize: '0.68em', ...textShadowStyle }}
                      >
                        {slide.body}
                      </p>
                    )}
                  </div>
                )}
              </AutoFitBox>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
