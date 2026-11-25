import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { Principles } from "@/components/Principles";

export const metadata: Metadata = {
  title: "10 principles for protecting information in the age of AI",
  description: copy.principles.metaDescription,
};

export default function PrinciplesPage() {
  return <Principles />;
}
