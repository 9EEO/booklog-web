import { AnimatePresence, motion } from "framer-motion";
import type { PropsWithChildren } from "react";

type BottomSheetModalProps = PropsWithChildren<{
  isOpen: boolean;
  ariaLabel: string;
  role?: "dialog" | "alertdialog";
  backdropClassName?: string;
  panelClassName?: string;
}>;

export const BottomSheetModal = ({
  isOpen,
  ariaLabel,
  role = "dialog",
  backdropClassName = "",
  panelClassName = "",
  children,
}: BottomSheetModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        className={`modal-backdrop ${backdropClassName}`}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
      >
        <motion.div
          className={`modal-panel ${panelClassName}`}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
