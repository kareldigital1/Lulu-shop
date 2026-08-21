import { AdminDashboard } from "@/presentation/components/admin/admin-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Backoffice | Tata Lulu Shop",
  description: "Espace privé d'administration de Tata Lulu Shop.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: null,
  twitter: null,
};

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return <AdminDashboard />;
}
