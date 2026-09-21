import styles from "./Avatar.module.css";

export function Avatar({ initials, host = false }: { initials: string; host?: boolean }) {
  return (
    <span className={`${styles.avatar} ${host ? styles.host : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}
