import type { Metadata } from "next";
import { getMessages } from "@/lib/i18n-server";
import { PickMovie } from "./PickMovie";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).meta.pick };
}

export default function PickPage() {
  return <PickMovie />;
}
