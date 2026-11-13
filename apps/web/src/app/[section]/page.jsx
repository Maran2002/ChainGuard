import { notFound } from "next/navigation";
import WorkspacePlaceholder from "../../components/workspace-placeholder";

const pages = {
  directory: { title: "Intelligence directory", eyebrow: "INTELLIGENCE", description: "Search configured wallet intelligence with source and coverage context.", icon: "directory" },
  investigate: { title: "Investigations", eyebrow: "OVERVIEW", description: "Explore wallet relationships from retrieved transaction data.", icon: "investigate" },
  history: { title: "Screening history", eyebrow: "INTELLIGENCE", description: "Review screening records associated with your account.", icon: "history" },
  admin: { title: "Workspace administration", eyebrow: "WORKSPACE", description: "Manage users, intelligence records, and ingestion status.", icon: "admin" },
  settings: { title: "Settings", eyebrow: "WORKSPACE", description: "Configure your ChainGuard workspace preferences.", icon: "settings" },
};

export default async function SectionPage({ params }) {
  const { section } = await params;
  const page = pages[section];
  if (!page) notFound();
  return <WorkspacePlaceholder {...page} />;
}
