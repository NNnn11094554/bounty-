import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SPRING } from '../animations';
import { useBackHandler } from '../hooks/useBackHandler';
import { useBlockingOverlay } from '../store/overlays';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}

/** Модалка снизу: выезд со spring и лёгким перелётом, затемнение (без blur — он дорог телефону), закрытие свайпом вниз. */
export function BottomSheet({ open, onClose, children, testId }: Props) {
  useBackHandler(open, onClose);
  useBlockingOverlay(open);
  // если содержимое не помещается (маленький экран), оно прокручивается, а закрыть свайпом можно за шапку
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const dragControls = useDragControls();
  useEffect(() => {
    const el = contentRef.current;
    if (!open || !el) return;
    const measure = () => setScrollable(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [open, children]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 650) onClose();
  };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" data-testid={testId}>
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="pb-safe relative mx-auto flex max-h-[calc(100%-16px)] w-full max-w-[520px] flex-col rounded-t-[32px] will-change-transform border-t border-line bg-night-700 px-5 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING.sheet}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            onPointerDown={(e) => {
              if (!scrollable || !contentRef.current?.contains(e.target as Node)) dragControls.start(e);
            }}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={onDragEnd}
          >
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-white/20" />
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="absolute right-4 top-4 z-20 grid h-8 w-8 place-items-center rounded-full bg-night-900/70 text-white/80 ring-1 ring-white/10"
              data-testid="sheet-close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path
                  d="M2 2l10 10M12 2 2 12"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div ref={contentRef} className="-mx-5 min-h-0 overflow-y-auto overscroll-contain px-5">
              <div className="pb-5">{children}</div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
