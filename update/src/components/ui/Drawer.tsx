import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from '@phosphor-icons/react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  position = 'right',
  children,
}) => {
  const dialogRef = useDialogFocus(isOpen, onClose);

  if (typeof document === 'undefined') return null;

  const motionVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
      container: 'fixed inset-y-0 right-0 max-w-md w-full border-l border-rule',
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
      container: 'fixed inset-y-0 left-0 max-w-md w-full border-r border-rule',
    },
    bottom: {
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
      container: 'fixed inset-x-0 bottom-0 max-h-[85vh] w-full border-t border-rule rounded-t-[12px]',
    },
  }[position];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className="fixed inset-0 z-50 overflow-hidden outline-none"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={motionVariants.initial}
            animate={motionVariants.animate}
            exit={motionVariants.exit}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={`${motionVariants.container} bg-surface shadow-dropdown z-10 flex flex-col`}
          >
            {/* Header */}
            <div className="p-6 border-b border-rule flex items-start justify-between shrink-0">
              <div>
                {title && (
                  <h3 className="text-xl font-semibold text-ink font-display">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-muted mt-1">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1.5 rounded-[7px] text-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
