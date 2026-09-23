import type { Metadata } from "next";
import { PickMovie } from "./PickMovie";

export const metadata: Metadata = { title: "Escolher filme — Matchflix" };

export default function PickPage() {
  return <PickMovie />;
}
