'use client';

import {
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  FileText,
  HelpCircle,
  LoaderCircle,
  Paperclip,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { SupportTurnstile } from './support-turnstile';
import { supportError } from './support-workspace-shared';
import { SUPPORT_ARTICLES, type SupportArticle } from './support-data';
import styles from './support-center.module.css';

export function SupportTicketForm({
  locale = 'tr',
  onBack,
  onOpenArticle,
}: {
  locale?: string;
  onBack?: (() => void) | undefined;
  onOpenArticle?: ((article: SupportArticle) => void) | undefined;
}) {
  const tr = locale === 'tr';

  const [category, setCategory] = useState<
    'ACCOUNT' | 'BILLING' | 'TECHNICAL' | 'SAFETY' | 'FEEDBACK' | 'OTHER'
  >('TECHNICAL');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [entityId, setEntityId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<{ ticketNumber: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smart Deflection: suggest articles matching keywords in subject
  const suggestedArticles = useMemo(() => {
    const q = subject.trim().toLowerCase();
    if (q.length < 3) return [];
    return SUPPORT_ARTICLES.filter((art) => {
      const title = (tr ? art.title.tr : art.title.en).toLowerCase();
      const tags = art.tags.join(' ').toLowerCase();
      return (
        title.includes(q) ||
        tags.includes(q) ||
        q
          .split(' ')
          .some((word) => word.length > 2 && (title.includes(word) || tags.includes(word)))
      );
    }).slice(0, 3);
  }, [subject, tr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || subject.trim().length < 3 || description.trim().length < 10) {
      setError(
        tr
          ? 'Lütfen adını, geçerli bir e-posta adresini, en az 3 karakterlik konuyu ve en az 10 karakterlik açıklamayı gir.'
          : 'Please enter your name, a valid email, a subject of at least 3 characters, and a description of at least 10 characters.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = JSON.stringify({
        category,
        locale: tr ? 'tr' : 'en',
        turnstileToken,
        requesterName: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        description: description.trim(),
        entityId: entityId.trim() || undefined,
      });
      const multipart = new FormData();
      multipart.append('payload', payload);
      for (const file of files) multipart.append('file', file);
      const response = await apiRequest<{ success: boolean; ticketNumber: string }>(
        files.length ? '/support/tickets/with-attachments' : '/support/tickets',
        {
          method: 'POST',
          body: files.length ? multipart : payload,
        },
      );

      if (response?.ticketNumber) {
        setCreatedTicket(response);
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      setError(
        tr
          ? supportError(error)
          : 'An error occurred while submitting your ticket. Please try again.',
      );
    } finally {
      setSubmitting(false);
      setTurnstileToken('');
      setTurnstileReset((value) => value + 1);
    }
  }

  function handleCopyTicket() {
    if (!createdTicket) return;
    void navigator.clipboard.writeText(createdTicket.ticketNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (createdTicket) {
    return (
      <div className={styles.ticketFormContainer}>
        <div className={styles.ticketSuccessCard}>
          <div className={styles.ticketSuccessBadge}>
            <CheckCircle size={36} />
          </div>
          <h2>{tr ? 'Talebiniz Başarıyla Alındı!' : 'Request Successfully Received!'}</h2>
          <p>
            {tr
              ? 'Talebin destek inceleme kuyruğuna alındı. Takip numaranı sakla; ek bilgi gerekirse verdiğin e-posta adresi üzerinden seninle iletişim kurulabilir.'
              : 'Your request has been added to the support review queue. Keep the reference number; the team may contact the email address you provided if more information is needed.'}
          </p>

          <div>
            <span style={{ fontSize: 13, color: 'rgba(241, 245, 249, 0.6)' }}>
              {tr ? 'Talep Takip Numaranız:' : 'Your Ticket Reference:'}
            </span>
            <br />
            <div className={styles.ticketNumberPill}>
              <span>{createdTicket.ticketNumber}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            <button type="button" className={styles.feedbackBtn} onClick={handleCopyTicket}>
              <Copy size={15} />
              <span>
                {copied
                  ? tr
                    ? 'Kopyalandı!'
                    : 'Copied!'
                  : tr
                    ? 'Numarayı Kopyala'
                    : 'Copy Reference'}
              </span>
            </button>
            {onBack ? (
              <button type="button" className={styles.ticketBtn} onClick={onBack}>
                {tr ? 'Destek Merkezine Dön' : 'Return to Help Center'}
              </button>
            ) : (
              <Link href="/support" className={styles.ticketBtn}>
                {tr ? 'Destek Merkezine Dön' : 'Return to Help Center'}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.ticketFormContainer}>
      <div className={styles.breadcrumbBar}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={styles.breadcrumbLink}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {tr ? 'Wapve Destek' : 'Wapve Support'}
          </button>
        ) : (
          <Link href="/support" className={styles.breadcrumbLink}>
            {tr ? 'Wapve Destek' : 'Wapve Support'}
          </Link>
        )}
        <span>/</span>
        <span className={styles.breadcrumbCurrent}>
          {tr ? 'Bir talep gönder' : 'Submit a request'}
        </span>
      </div>

      <div className={styles.ticketNoticeCard}>
        <AlertTriangle size={24} className={styles.ticketNoticeIcon} />
        <div>
          <h3>{tr ? 'Wapve Destek formuna hoş geldin.' : 'Welcome to Wapve Support.'}</h3>
          <p>
            {tr
              ? 'Lütfen ekibimize bir bilet göndermek için aşağıdaki formu eksiksiz doldur.'
              : 'Please fill out the form below to submit a ticket to our support team.'}
          </p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {tr ? 'Göndermeden önce: ' : 'Before submitting: '}
            <span style={{ fontWeight: 400, color: 'rgba(254, 243, 199, 0.75)' }}>
              {tr
                ? 'Yardım Merkezindeki ilgili rehberleri kontrol et.'
                : 'Check the Help Center articles for fast solutions.'}
            </span>
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className={styles.ticketFormCard}>
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Category Selection */}
        <div className={styles.ticketFormGroup}>
          <label className={styles.ticketLabel}>
            {tr ? 'Sorununla ilgili konu başlığını seç' : 'Choose a request category'}
            <span>*</span>
          </label>
          <select
            className={styles.ticketSelect}
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
          >
            <option value="TECHNICAL">
              {tr
                ? 'Teknik Sorun & Hata Bildirimi (Ses, Ekran, Masaüstü vb.)'
                : 'Technical Issue & Bugs (Voice, Video, Desktop)'}
            </option>
            <option value="ACCOUNT">
              {tr
                ? 'Hesap Erişimi ve Güvenlik (Şifre, 2FA vb.)'
                : 'Account Access & Security (Password, 2FA)'}
            </option>
            <option value="BILLING">
              {tr ? 'Wapve+ ve Woost Desteği' : 'Wapve+ & Woost Support'}
            </option>
            <option value="SAFETY">
              {tr
                ? 'Güven ve Emniyet (Kural İhlali, Raporlama)'
                : 'Trust & Safety (Policy Violations, Reports)'}
            </option>
            <option value="FEEDBACK">
              {tr ? 'Öneri, Geri Bildirim ve İstekler' : 'Feedback & Feature Requests'}
            </option>
            <option value="OTHER">{tr ? 'Diğer Konular' : 'Other Inquiries'}</option>
          </select>
        </div>

        {/* Full Name */}
        <div className={styles.ticketFormGroup}>
          <label className={styles.ticketLabel}>
            {tr ? 'Adın Soyadın' : 'Your Full Name'}
            <span>*</span>
          </label>
          <input
            type="text"
            required
            minLength={2}
            maxLength={80}
            className={styles.ticketInput}
            placeholder={tr ? 'Örn: Salim Yılmaz' : 'e.g. Salim Yilmaz'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Email Address */}
        <div className={styles.ticketFormGroup}>
          <label className={styles.ticketLabel}>
            {tr ? 'E-posta adresin' : 'Your email address'}
            <span>*</span>
          </label>
          <input
            type="email"
            required
            maxLength={255}
            className={styles.ticketInput}
            placeholder={tr ? 'ornek@alanadi.com' : 'you@domain.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className={styles.ticketHelpText}>
            {tr
              ? 'Bu adres talebinle ilişkilendirilir ve ek bilgi gerekirse sana ulaşmak için kullanılabilir.'
              : 'This address is associated with the request and may be used to contact you if more information is needed.'}
          </div>
        </div>

        {/* Subject */}
        <div className={styles.ticketFormGroup}>
          <label className={styles.ticketLabel}>
            {tr ? 'Konu başlığı' : 'Subject'}
            <span>*</span>
          </label>
          <input
            type="text"
            required
            minLength={3}
            maxLength={200}
            className={styles.ticketInput}
            placeholder={
              tr
                ? 'Örn: Mikrofonum ses kanalında çalışmıyor'
                : 'e.g. Microphone not working in voice channel'
            }
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Smart Deflection Suggestions */}
        {suggestedArticles.length > 0 && (
          <div className={styles.deflectionCard}>
            <div className={styles.deflectionHeader}>
              <HelpCircle size={16} />
              <span>
                {tr
                  ? 'Göndermeden önce bu makaleler sorununu çözebilir mi?'
                  : 'Could these articles solve your issue?'}
              </span>
            </div>
            <div className={styles.deflectionList}>
              {suggestedArticles.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => onOpenArticle?.(art)}
                  className={styles.deflectionItem}
                  style={{
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <ExternalLink size={13} />
                  <span>{tr ? art.title.tr : art.title.en}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className={styles.ticketFormGroup}>
          <label className={styles.ticketLabel}>
            {tr ? 'Sorunun ayrıntılı açıklaması' : 'Description'}
            <span>*</span>
          </label>
          <textarea
            required
            minLength={10}
            maxLength={4000}
            className={styles.ticketTextarea}
            placeholder={
              tr
                ? 'Lütfen karşılaştığın sorunu, işletim sistemini, hatanın ne zaman oluştuğunu ve denediğin adımları detaylıca anlat...'
                : 'Please detail what happened, your operating system, and steps you already tried...'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Related Entity ID */}
        <div className={styles.ticketFormGroup}>
          <label className={styles.ticketLabel}>
            {tr
              ? 'İlgili Sunucu veya Kullanıcı Kimliği (Opsiyonel)'
              : 'Related Server or User ID (Optional)'}
          </label>
          <input
            type="text"
            maxLength={100}
            className={styles.ticketInput}
            placeholder={
              tr ? 'Örn: Sunucu linki veya kullanıcı adı' : 'e.g. Server link or username'
            }
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
          />
        </div>

        {/* File Attachments Section */}
        <div className={styles.fileUploadSection}>
          <div className={styles.fileUploadHeader}>
            <label className={styles.ticketLabel} style={{ margin: 0 }}>
              {tr ? 'Dosya ekle (İsteğe bağlı)' : 'Attachments (Optional)'}
            </label>
            <span className={styles.fileUploadHint}>
              {tr ? 'En fazla 3 dosya · Her biri maks. 10 MB' : 'Up to 3 files · Max 10 MB each'}
            </span>
          </div>

          <button
            type="button"
            className={styles.fileUploadTrigger}
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting || files.length >= 3}
          >
            <Paperclip className={styles.fileUploadTriggerIcon} />
            <span className={styles.fileUploadTriggerTitle}>
              {files.length >= 3
                ? tr
                  ? 'Maksimum dosya sınırına ulaşıldı (3 dosya)'
                  : 'Maximum file limit reached (3 files)'
                : tr
                  ? 'Dosya Ekle veya Seçmek İçin Tıkla'
                  : 'Add Files or Click to Browse'}
            </span>
            <span className={styles.fileUploadTriggerFormats}>
              PNG, JPG, WebP, PDF, TXT, LOG
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.log"
            disabled={submitting}
            style={{ display: 'none' }}
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              if (!selected.length) return;
              const total = [...files, ...selected];
              if (total.length > 3) {
                setError(
                  tr
                    ? 'En fazla 3 dosya ekleyebilirsin.'
                    : 'You can attach up to 3 files.',
                );
                event.target.value = '';
                return;
              }
              if (selected.some((file) => file.size > 10 * 1024 * 1024)) {
                setError(
                  tr
                    ? 'Her dosya en fazla 10 MB olabilir.'
                    : 'Each file must be 10 MB or smaller.',
                );
                event.target.value = '';
                return;
              }
              setFiles(total);
              setError(null);
              event.target.value = '';
            }}
          />

          {files.length > 0 && (
            <div className={styles.fileList}>
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className={styles.fileItem}>
                  <div className={styles.fileInfo}>
                    <FileText size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                    <span className={styles.fileName}>{file.name}</span>
                    <span className={styles.fileSize}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.fileRemoveBtn}
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    title={tr ? 'Dosyayı kaldır' : 'Remove file'}
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Note */}
        <div className={styles.ticketSecurityNote}>
          <ShieldCheck size={16} />
          <span>
            {tr
              ? 'Talebini takip etmek ve ek dosya iletmek için e-postana gelen güvenli bağlantıyı kullanabilirsin. Şifreni veya doğrulama kodlarını asla paylaşma.'
              : 'Use the secure link sent to your email to track your ticket and add files. Never share passwords or verification codes.'}
          </span>
        </div>

        <SupportTurnstile onToken={setTurnstileToken} resetKey={turnstileReset} />

        {/* Submit Button */}
        <button type="submit" disabled={submitting} className={styles.ticketSubmitBtn}>
          {submitting ? (
            <>
              <LoaderCircle size={18} className="spin" />
              <span>{tr ? 'Talebiniz Gönderiliyor...' : 'Submitting Request...'}</span>
            </>
          ) : (
            <>
              <Send size={16} />
              <span>{tr ? 'Talebi Gönder' : 'Submit Ticket'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
