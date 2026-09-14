'use client';

import * as Dialog from '@radix-ui/react-dialog';
import type { ServerChannel } from '@wapve/contracts';
import { Hash, Info, X } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n';
import { MarkdownRenderer } from './markdown-renderer';

export function ChannelTopicDialog({
  channel,
  locale,
  messages,
  open,
  onOpenChange,
}: {
  channel: ServerChannel;
  locale: 'tr' | 'en';
  messages: Dictionary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay channel-topic-dialog-overlay" />
        <Dialog.Content className="channel-topic-dialog">
          <header>
            <span className="channel-topic-dialog-symbol">
              <Hash size={19} />
            </span>
            <div>
              <Dialog.Title>{messages.channelTopic}</Dialog.Title>
              <Dialog.Description>#{channel.name}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label={messages.close}>
                <X size={20} />
              </button>
            </Dialog.Close>
          </header>
          <div className="channel-topic-dialog-body">
            <Info size={19} aria-hidden="true" />
            <MarkdownRenderer
              content={channel.topic ?? ''}
              locale={locale}
              showLinkPreview={false}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
