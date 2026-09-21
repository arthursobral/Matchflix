import type { Metadata } from "next";
import { ptBR as t } from "@/messages/pt-BR";
import { CreateRoom } from "./CreateRoom";

export const metadata: Metadata = { title: `${t.create.title} — Matchflix` };

export default function CreatePage() {
  return <CreateRoom />;
}
