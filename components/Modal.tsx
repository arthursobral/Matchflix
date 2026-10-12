"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Modal.module.css";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Diálogo simples e genérico: fundo escurecido, fecha com Esc ou clique fora. `<dialog>`
 * nativo com showModal(): o navegador prende o foco do teclado dentro dele e deixa a página
 * atrás inerte. Ao fechar, o foco volta para quem abriu.
 */
export function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Guardado no primeiro render: depois disso o foco já foi para dentro do modal.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [opener]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault(); // Esc: quem decide fechar é o dono do modal
        onClose();
      }}
    >
      <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className={styles.panel}>{children}</div>
      </div>
    </dialog>
  );
}
