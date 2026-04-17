import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
}

export const Modal = ({ title, open, onClose, children, panelClassName }: ModalProps) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn("w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-900/10", panelClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button variant="secondary" type="button" onClick={onClose}>
            ปิด
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
};
