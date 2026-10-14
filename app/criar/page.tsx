import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n-server";
import { CreateRoom } from "./CreateRoom";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getMessages()).create.title} — Matchflix` };
}

export default function CreatePage() {
  return <CreateRoom />;
}
