'use client';

import { useCallback, useRef, useState } from 'react';

export type UploadQueueItem = {
  id: string;
  file: File;
  status: 'ready' | 'uploading' | 'complete' | 'error';
  progress: number;
};

function uploadId(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`;
}

export function useUploadQueue() {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const aborters = useRef(new Map<string, AbortController>());

  const add = useCallback((files: File[]) => {
    setItems((current) => [
      ...current,
      ...files.slice(0, Math.max(0, 10 - current.length)).map((file) => ({
        id: uploadId(file),
        file,
        status: 'ready' as const,
        progress: 0,
      })),
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    aborters.current.get(id)?.abort();
    aborters.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    aborters.current.forEach((controller) => controller.abort());
    aborters.current.clear();
    setItems([]);
  }, []);

  const run = useCallback(
    async (
      upload: (
        file: File,
        onProgress: (progress: number) => void,
        signal: AbortSignal,
        index: number,
      ) => Promise<unknown>,
    ): Promise<boolean> => {
      const pending = items.filter((item) => item.status !== 'complete');
      let allSucceeded = true;
      for (const [index, item] of pending.entries()) {
        const controller = new AbortController();
        aborters.current.set(item.id, controller);
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: 'uploading', progress: 0 }
              : candidate,
          ),
        );
        try {
          await upload(
            item.file,
            (progress) =>
              setItems((current) =>
                current.map((candidate) =>
                  candidate.id === item.id ? { ...candidate, progress } : candidate,
                ),
              ),
            controller.signal,
            index,
          );
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, status: 'complete', progress: 100 }
                : candidate,
            ),
          );
        } catch (error) {
          if ((error as Error).name !== 'AbortError') allSucceeded = false;
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id ? { ...candidate, status: 'error' } : candidate,
            ),
          );
        } finally {
          aborters.current.delete(item.id);
        }
      }
      return allSucceeded;
    },
    [items],
  );

  return { items, add, remove, clear, run };
}
