'use client';

import { useEffect, useRef, useState } from 'react';

interface ContentShieldProps {
  studentName: string;
  studentPhone: string;
  studentId: string;
  children: React.ReactNode;
}

export default function ContentShield({
  studentName,
  studentPhone,
  studentId,
  children,
}: ContentShieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watermarkPos, setWatermarkPos] = useState({ top: '22%', left: '28%' });
  const [warningFlash, setWarningFlash] = useState(false);

  const shortId = studentId.slice(0, 8).toUpperCase();
  const forensicLabel = `${studentName} • ${studentPhone || shortId}`;

  const pauseEmbeddedMedia = () => {
    const iframes = containerRef.current?.querySelectorAll('iframe');
    iframes?.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      } catch {
        // Ignore cross-origin errors
      }
    });
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback if fullscreen blocked by browser policy
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const moveWatermark = () => {
      const top = Math.floor(Math.random() * 64) + 14;
      const left = Math.floor(Math.random() * 52) + 12;
      setWatermarkPos({ top: `${top}%`, left: `${left}%` });
    };

    moveWatermark();
    const interval = setInterval(moveWatermark, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const activateShield = (temporary = false) => {
      pauseEmbeddedMedia();
      setIsBlurred(true);
      if (temporary) {
        setWarningFlash(true);
        setTimeout(() => {
          setWarningFlash(false);
          if (document.hasFocus() && !document.hidden) {
            setIsBlurred(false);
          }
        }, 3000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        activateShield(false);
      } else {
        setTimeout(() => setIsBlurred(false), 500);
      }
    };

    const handleWindowBlur = () => {
      activateShield(false);
    };

    const handleWindowFocus = () => {
      setTimeout(() => setIsBlurred(false), 400);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('').catch(() => {});
        activateShield(true);
      }

      if (
        e.key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u'].includes(e.key.toLowerCase())) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
        activateShield(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className={`relative select-none overflow-hidden bg-black ${
        isFullscreen ? 'w-screen h-screen flex items-center justify-center' : ''
      }`}
    >
      {/* Protected Video / PDF Layer */}
      <div
        className={`w-full h-full ${
          isBlurred || warningFlash
            ? 'opacity-0 pointer-events-none transition-opacity duration-150'
            : 'transition-opacity duration-200'
        }`}
      >
        {children}
      </div>

      {/* Icon-Only Fullscreen Toggle (Bottom-Right Standard Position) */}
      {!isBlurred && !warningFlash && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
          title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
          className="absolute bottom-2.5 right-2.5 z-30 w-9 h-9 rounded-lg bg-black/70 hover:bg-black/90 text-white/90 hover:text-white flex items-center justify-center transition cursor-pointer"
        >
          {isFullscreen ? (
            /* Exit Fullscreen Icon */
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            /* Enter Fullscreen Icon */
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8V5a2 2 0 0 1 2-2h3" />
              <path d="M16 3h3a2 2 0 0 1 2 2v3" />
              <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
              <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
            </svg>
          )}
        </button>
      )}

      {/* Blackout Screen on Focus Loss / Capture Attempt */}
      {(isBlurred || warningFlash) && (
        <div className="absolute inset-0 z-40 bg-[#070B14] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center text-xl font-black mb-3">
            !
          </div>
          <p className="text-sm sm:text-base font-black text-white mb-1">
            تم إيقاف العرض مؤقتاً لحماية حقوق الملكية
          </p>
          <p className="text-xs text-slate-400 max-w-sm">
            اضغط داخل نافذة الدرس لمتابعة المشاهدة. جميع الجلسات مسجلة ببيانات الطالب.
          </p>
        </div>
      )}

      {/* Full-Frame Diagonal Watermark Grid + Moving Forensic Badge */}
      {!isBlurred && !warningFlash && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-[0.16]"
          >
            <div className="-rotate-24 scale-125 grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-14 p-6 w-full h-full place-items-center">
              {Array.from({ length: 12 }).map((_, idx) => (
                <span
                  key={idx}
                  className="font-mono text-[11px] sm:text-xs font-bold text-white tracking-wider whitespace-nowrap"
                >
                  {forensicLabel}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{ top: watermarkPos.top, left: watermarkPos.left }}
            className="pointer-events-none absolute z-30 transition-all duration-1000 ease-in-out opacity-50"
          >
            <div className="bg-slate-950/65 border border-white/15 backdrop-blur-[1px] px-3 py-1 rounded-md text-[11px] sm:text-xs font-mono font-bold text-white whitespace-nowrap shadow">
              {forensicLabel}
            </div>
          </div>
        </>
      )}
    </div>
  );
}