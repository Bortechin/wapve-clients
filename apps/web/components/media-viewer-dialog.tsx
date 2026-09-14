'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';

export function MediaViewerDialog({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string | null;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [zoom, setZoom] = useState(1);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setZoom(1);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col focus:outline-none">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.5, 3))}
                className="rounded-md bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                title="Yakınlaştır"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.5, 0.5))}
                className="rounded-md bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                title="Uzaklaştır"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
            </div>
            <Dialog.Close className="rounded-md bg-white/10 p-2 text-white hover:bg-white/20 transition-colors">
              <X className="h-6 w-6" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {src && (
              <img
                src={src}
                alt={alt}
                style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease' }}
                className="max-h-full max-w-full object-contain cursor-grab active:cursor-grabbing origin-center"
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
