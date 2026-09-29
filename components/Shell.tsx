import Link from "next/link";
import type { ReactNode } from "react";
import { ptBR as t } from "@/messages/pt-BR";
import styles from "./Shell.module.css";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          {t.brand}
        </Link>
        <span className={`eyebrow ${styles.tagline}`}>{t.tagline}</span>
        <span className={`eyebrow ${styles.beta}`}>{t.beta}</span>
        <Link href="/#como-funciona" className={styles.howItWorks}>
          {t.nav.howItWorks}
        </Link>
        <button type="button" className={styles.locale} aria-disabled="true" title={t.nav.soon}>
          {t.nav.locale}
        </button>
      </header>
      {children}
      <footer className={styles.footer}>
        <p>{t.footer}</p>
        <p className={styles.attribution}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marca, não uma foto a otimizar */}
          <img src="/tmdb-logo.svg" alt="TMDB" className={styles.tmdbLogo} />
          {t.footerAttribution}
        </p>
      </footer>
    </div>
  );
}
