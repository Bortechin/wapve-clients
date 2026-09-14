import Link from 'next/link';
import { WapveLogo } from '@wapve/ui';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <div className="not-found-logo">
          <WapveLogo />
        </div>
        <span className="not-found-code">404</span>
        <h1>Bu dalga burada değil</h1>
        <p>Aradığın bağlantı taşınmış, silinmiş veya hiç oluşturulmamış olabilir.</p>
        <div className="not-found-actions">
          <Link className="primary" href="/">
            Ana sayfa
          </Link>
          <Link href="/login">Giriş yap</Link>
        </div>
      </section>
    </main>
  );
}
