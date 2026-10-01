import { ptBR as t } from "@/messages/pt-BR";
import styles from "./WhereToWatch.module.css";

export type Provider = { name: string; logoUrl: string };
export type Providers = { flatrate: Provider[]; rent: Provider[]; buy: Provider[] } | null;

const d = t.movieDetails;

function Group({ label, providers }: { label: string; providers: Provider[] }) {
  if (providers.length === 0) return null;
  return (
    <div className={styles.group}>
      <p className={styles.groupLabel}>{label}</p>
      <ul className={styles.chips}>
        {providers.map((provider) => (
          <li key={provider.name} className={styles.chip}>
            {/* Logo decorativo: o nome do provedor já vai como texto ao lado. */}
            <img src={provider.logoUrl} alt="" width={20} height={20} />
            <span>{provider.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Props = {
  providers: Providers;
  /** Texto da etiqueta dourada acima do cartão (ex.: "Onde assistir" ou "Onde assistir · Brasil"). */
  label: string;
  className?: string;
};

/** Cartão de disponibilidade agrupado por assinatura/aluguel/compra, com o logo de cada provedor. */
export function WhereToWatch({ providers, label, className }: Props) {
  const empty = !providers || (providers.flatrate.length === 0 && providers.rent.length === 0 && providers.buy.length === 0);
  return (
    <section className={`${styles.where} ${className ?? ""}`} aria-label={d.where}>
      <p className="eyebrow">{label}</p>
      {empty ? (
        <p className={styles.group}>{d.noAvailability}</p>
      ) : (
        <>
          <Group label={d.flatrate} providers={providers.flatrate} />
          <Group label={d.rent} providers={providers.rent} />
          <Group label={d.buy} providers={providers.buy} />
        </>
      )}
    </section>
  );
}
