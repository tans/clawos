import type { AdminTask, Product, SiteSettings } from "../../lib/types";

export type AdminSection = "settings" | "products" | "tasks";

export interface AdminPageProps {
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  notice?: string;
  activeSection: AdminSection;
}
