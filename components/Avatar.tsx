import styles from "./Avatar.module.css";

type Props = { initials: string; host?: boolean; size?: "sm" | "lg" };

export function Avatar({ initials, host = false, size = "sm" }: Props) {
  return (
    <span className={`${styles.avatar} ${styles[size]} ${host ? styles.host : ""}`} aria-hidden="true">
      {initials}
    </span>
  );
}
