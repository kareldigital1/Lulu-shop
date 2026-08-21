import type { Metadata } from "next";
import { AdminDashboard } from "@/presentation/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Maintenance système | Tata Lulu Shop",
  description: "Espace technique privé de Tata Lulu Shop.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: null,
  twitter: null,
};

export const dynamic = "force-dynamic";

export default function AdminSystemPage() {
  return <AdminDashboard initialView="system" />;
}
