import Link from "next/link";
import type { ReactNode } from "react";
import { getMessages } from "@/lib/i18n-server";
import { LocaleToggle } from "./LocaleToggle";
import styles from "./Shell.module.css";

export async function Shell({ children }: { children: ReactNode }) {
  const t = await getMessages();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          {t.brand}
        </Link>
        <span className={`eyebrow ${styles.tagline}`}>{t.tagline}</span>
        <Link href="/#como-funciona" className={styles.howItWorks}>
          {t.nav.howItWorks}
        </Link>
        <LocaleToggle className={styles.locale} />
      </header>
      {children}
      <footer className={styles.footer}>
        <p>{t.footer}</p>
        <p className={styles.attribution}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG de marca, não uma foto a otimizar */}
          <img src="/tmdb-logo.svg" alt="TMDB" width={138} height={10} className={styles.tmdbLogo} />
          {t.footerAttribution}
        </p>
      </footer>
    </div>
  );
}
