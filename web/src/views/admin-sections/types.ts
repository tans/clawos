import type { AdminTask, DownloadItem, Product, SiteSettings } from "../../lib/types";

export type AdminSection = "settings" | "products" | "tasks" | "downloads";

export interface AdminPageProps {
  downloads?: DownloadItem[];
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  notice?: string;
  activeSection: AdminSection;
}
