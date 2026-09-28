"use client";

import { useId, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import styles from "./NicknamePrompt.module.css";

type Props = {
  title: string;
  lead: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel: string;
  onConfirm: (nickname: string) => Promise<void>;
  onCancel: () => void;
};

/**
 * Etapa leve para pedir o apelido de quem cria ou entra numa sala. Nenhuma tela já
 * aprovada precisou ganhar um campo novo por causa disso (ver docs/m2-criar-entrar-salas.md).
 */
export function NicknamePrompt({ title, lead, label, placeholder, confirmLabel, busyLabel, cancelLabel, onConfirm, onCancel }: Props) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function confirm() {
    const trimmed = nickname.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.lead}>{lead}</p>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && confirm()}
        placeholder={placeholder}
        maxLength={24}
        autoFocus
        autoComplete="off"
        disabled={busy}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button icon="arrow" onClick={confirm}>
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
