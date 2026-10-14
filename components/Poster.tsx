"use client";

import Image from "next/image";
import { useMessages } from "./LocaleProvider";

export type PosterImage = { src: string; title: string };

type Props = {
  poster: PosterImage;
  className?: string;
  priority?: boolean;
};

export function Poster({ poster, className, priority }: Props) {
  const t = useMessages();
  return (
    <Image
      src={poster.src}
      alt={t.posterAlt(poster.title)}
      width={360}
      height={520}
      className={className}
      priority={priority}
      unoptimized
    />
  );
}
