'use client';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SupportTicketDetail } from '@wapve/contracts';
import { ApiClientError } from '@/lib/api';
import styles from './support-workspace.module.css';

export const categories = {
  ACCOUNT: 'Hesap',
  TECHNICAL: 'Teknik destek',
  SAFETY: 'Güvenlik',
  BILLING: 'Wapve+ / Woost',
  FEEDBACK: 'Geri bildirim',
  OTHER: 'Genel',
};
export const statuses = {
  NEW: 'Yeni',
  IN_PROGRESS: 'İşlemde',
  WAITING_CUSTOMER: 'Müşteri bekleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapandı',
  SPAM: 'Spam',
};
export const priorities = { LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil' };
export const date = (value: string) =>
  new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
export function supportError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.details.code === 'SUPPORT_LOGIN_FAILED')
      return 'E-posta, şifre veya destek erişimi doğrulanamadı.';
    if (error.details.code === 'SUPPORT_2FA_INVALID')
      return 'Doğrulama kodu geçersiz. Yeni TOTP kodunu deneyin.';
    if (error.status === 429) return 'Çok fazla işlem yapıldı. Bir süre sonra tekrar deneyin.';
    if (!error.message.startsWith('errors.')) return error.message;
  }
  return 'İşlem tamamlanamadı. Bağlantıyı ve bilgileri kontrol edip tekrar deneyin.';
}
export function WorkspaceHeader({ children }: { children?: ReactNode }) {
  return (
    <header className={styles.topbar}>
      <Link href="/support" className={styles.brand}>
        <Image src="/icon.png" width={34} height={34} alt="" />
        <span>
          Wapve<small>DESTEK MERKEZİ</small>
        </span>
      </Link>
      <div className={styles.topActions}>{children}</div>
    </header>
  );
}
export function StatusBadge({ status }: { status: keyof typeof statuses }) {
  return (
    <span className={styles.badge} data-status={status}>
      {statuses[status]}
    </span>
  );
}
export function Conversation({
  ticket,
  staff = false,
}: {
  ticket: SupportTicketDetail;
  staff?: boolean;
}) {
  const base = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/support/${staff ? `staff/tickets/${ticket.id}` : `customer/tickets/${ticket.reference}`}`;
  return (
    <div className={styles.thread}>
      {ticket.messages.map((message) => (
        <article key={message.id} className={styles.message} data-internal={message.internal}>
          <div className={styles.messageHeader}>
            <strong>
              {message.authorName}{' '}
              {message.internal
                ? '· Dahili not'
                : message.authorType === 'AGENT'
                  ? '· Wapve Destek'
                  : ''}
            </strong>
            <time dateTime={message.createdAt}>{date(message.createdAt)}</time>
          </div>
          <p className={styles.body}>{message.body}</p>
          {message.attachments.length > 0 && (
            <div className={styles.files}>
              {message.attachments.map((file) => (
                <a key={file.id} href={`${base}/attachments/${file.id}`} download>
                  {file.originalName} · {(file.size / 1024).toFixed(0)} KB
                </a>
              ))}
            </div>
          )}
          {staff && message.emailStatus && (
            <small className={styles.muted}>
              {
                {
                  PENDING: 'E-posta sırada',
                  SENDING: 'E-posta gönderiliyor',
                  SENT: 'E-posta gönderildi (SMTP kabul etti)',
                  FAILED: 'E-posta gönderilemedi · yönetici kontrolü gerekebilir',
                }[message.emailStatus]
              }
            </small>
          )}
        </article>
      ))}
    </div>
  );
}
