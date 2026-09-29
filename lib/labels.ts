import { ptBR as t } from "@/messages/pt-BR";

export function countryLabel(value: string) {
  return t.create.country.options.find((o) => o.value === value)?.label ?? value;
}

export function genresLabel(genres: string[]) {
  if (genres.length === 0) return t.room.allGenres;
  return genres.map((g) => t.create.genres.options.find((o) => o.value === g)?.label ?? g).join(", ");
}
