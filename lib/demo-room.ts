/** Sala fictícia do modo de demonstração (M1). Substituída por dados reais no M2/M3. */
export const demoRoom = {
  name: "Cinema de sexta",
  code: "MFX 824",
  country: "Brasil",
  genres: "Todos os gêneros",
  participants: [
    { initials: "AS", name: "Arthur", host: true, you: true },
    { initials: "LC", name: "Lucas", host: false, you: false },
    { initials: "BM", name: "Bruno", host: false, you: false },
  ],
} as const;
