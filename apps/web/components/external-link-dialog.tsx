'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { ShieldAlert, X } from 'lucide-react';

export function ExternalLinkDialog({
  url,
  open,
  onOpenChange,
}: {
  url: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#151B23] shadow-lg focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Dış Bağlantı Uyarısı
            </h2>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="p-6 text-slate-300">
            <p className="mb-4">
              Uygulama dışı bir bağlantıya gitmek üzeresiniz. Bu bağlantı bizim kontrolümüzde
              değildir ve güvenilir olmayabilir.
            </p>
            <div className="break-all rounded-lg bg-black/40 p-3 font-mono text-sm text-slate-400">
              {url}
            </div>
          </div>
          <div className="flex justify-end gap-3 bg-black/20 px-6 py-4">
            <Dialog.Close className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5">
              İptal
            </Dialog.Close>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpenChange(false)}
                className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Yine de Git
              </a>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
