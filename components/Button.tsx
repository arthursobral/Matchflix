import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Button.module.css";

const icons = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2",
  close: "M6 6l12 12M6 18 18 6",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
};

type Props = {
  children: ReactNode;
  icon?: keyof typeof icons;
  variant?: "primary" | "secondary" | "gold";
  /** Com `href` vira link; com `onClick` vira botão. Sem nenhum dos dois, é exibido como indisponível. */
  href?: string;
  onClick?: () => void;
  unavailableHint?: string;
};

export function Button({ children, icon, variant = "primary", href, onClick, unavailableHint }: Props) {
  const className = `${styles.button} ${styles[variant]} ${icon ? "" : styles.plain}`;
  const content = (
    <>
      <span className={styles.label}>{children}</span>
      {icon && (
        <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
          <path d={icons[icon]} />
        </svg>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <button type="button" className={className} aria-disabled="true" title={unavailableHint}>
      {content}
    </button>
  );
}
