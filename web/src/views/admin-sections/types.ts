import type {
  AdminInstallerHistoryItem,
  AdminTask,
  LatestRelease,
  Product,
  SiteSettings,
} from "../../lib/types";

export type AdminSection = "settings" | "versions" | "products" | "tasks";

export interface AdminPageProps {
  products: Product[];
  tasks: AdminTask[];
  settings: SiteSettings;
  releases: {
    latest: LatestRelease | null;
    history: AdminInstallerHistoryItem[];
  };
  notice?: string;
  activeSection: AdminSection;
}
