import type { AdminTask, LatestRelease, Product, SiteSettings } from "../../lib/types";

export type AdminSection = "settings" | "versions" | "products" | "tasks";

export interface AdminPageProps {
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  releases: {
    stable: LatestRelease | null;
    beta: LatestRelease | null;
    alpha: LatestRelease | null;
  };
  notice?: string;
  activeSection: AdminSection;
}
