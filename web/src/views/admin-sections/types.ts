import type { AdminTask, DownloadItem, Product, SiteSettings } from "../../lib/types";

export type AdminSection = "settings" | "downloads" | "products" | "tasks";

export interface AdminPageProps {
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  downloads: DownloadItem[];
  notice?: string;
  activeSection: AdminSection;
}
