import Image from "next/image";

/** Pôsteres vetoriais fictícios do modo de demonstração. */
export const demoPosters = {
  silencio: { src: "/demo/silencio.svg", title: "Silêncio" },
  horizonte: { src: "/demo/horizonte.svg", title: "Horizonte" },
  ultimaSessao: { src: "/demo/ultima-sessao.svg", title: "A última sessão" },
} as const;

export type PosterImage = { src: string; title: string };

type Props = {
  poster: PosterImage;
  className?: string;
  priority?: boolean;
};

export function Poster({ poster, className, priority }: Props) {
  return (
    <Image
      src={poster.src}
      alt={`Pôster: ${poster.title}`}
      width={360}
      height={520}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
