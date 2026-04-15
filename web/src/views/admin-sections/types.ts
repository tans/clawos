import type { AdminTask, DownloadItem, Order, Product, SiteSettings } from "../../lib/types";

export type AdminSection = "settings" | "products" | "tasks" | "downloads" | "orders";

export interface AdminPageProps {
  downloads?: DownloadItem[];
  orders?: Order[];
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  notice?: string;
  activeSection: AdminSection;
}
