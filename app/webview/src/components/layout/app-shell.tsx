import {
  BellRing,
  Bot,
  Download,
  Globe,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { PageKey } from "@/App";
import { fetchAppUpdateStatus, fetchBrandProfile, fetchHealthVersion, readUserErrorMessage, startAppUpdate } from "@/lib/api";
import { openOpenclawConsole } from "@/lib/desktop";
import { Button } from "../ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "../ui/sidebar";

const navItems: Array<{ key: PageKey; label: string; icon: ComponentType<{ size?: number }> }> = [
  { key: "dashboard", label: "控制台", icon: SquareTerminal },
  { key: "channels", label: "通讯设置", icon: Globe },
  { key: "agents", label: "模型配置", icon: Bot },
  { key: "skills", label: "功能配置", icon: Sparkles },
  { key: "settings", label: "更多设置", icon: Settings2 },
];

type Props = {
  page: PageKey;
  title: string;
  description: string;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
};

export function AppShell({ page, title, description, onNavigate, children }: Props) {
  const [version, setVersion] = useState("v-");
  const [updateMeta, setUpdateMeta] = useState("检查更新中...");
  const [brandName, setBrandName] = useState("ClawOS");
  const [brandDomain, setBrandDomain] = useState("clawos.cc");
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [runningUpdate, setRunningUpdate] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    async function refresh(silent: boolean) {
      try {
        if (!silent) {
          setUpdateMeta("正在获取版本信息...");
        }
        const [currentVersion, status, brand] = await Promise.all([fetchHealthVersion(), fetchAppUpdateStatus(), fetchBrandProfile()]);
        if (!active) return;

        setVersion(currentVersion ? `v${currentVersion}` : "v-");
        setBrandName(typeof brand.name === "string" && brand.name.trim() ? brand.name.trim() : "ClawOS");
        setBrandDomain(typeof brand.domain === "string" && brand.domain.trim() ? brand.domain.trim() : "clawos.cc");

        if (status.error || status.supported === false) {
          setRemoteVersion(null);
          setUpdateMeta("版本信息暂不可用");
          return;
        }

        const nextRemoteVersion =
          typeof status.remoteVersion === "string" && status.remoteVersion.trim() ? status.remoteVersion.trim() : null;
        if (status.hasUpdate && nextRemoteVersion) {
          setRemoteVersion(nextRemoteVersion);
          setUpdateMeta(`发现新版本 v${nextRemoteVersion}`);
          return;
        }

        setRemoteVersion(null);
        setUpdateMeta(currentVersion ? `当前已是最新版本 v${currentVersion}` : "当前已是最新版本");
      } catch (error) {
        if (!active) return;
        setRemoteVersion(null);
        setUpdateMeta(readUserErrorMessage(error, "版本信息暂不可用"));
      }
    }

    void refresh(false);
    timer = window.setInterval(() => {
      void refresh(true);
    }, 5 * 60 * 1000);

    return () => {
      active = false;
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="none" className="border-r border-sidebar-border">
        <SidebarHeader className="gap-3 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar px-3 py-3">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_14%,transparent)]" />
            <p className="eyebrow">{brandName}</p>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 overflow-hidden">
          <SidebarGroup className="p-0">
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = page === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton isActive={active} onClick={() => onNavigate(item.key)} className="cursor-pointer">
                      <Icon size={15} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <SidebarSeparator className="mx-0" />
          <div className="mt-2 rounded-lg border border-sidebar-border bg-sidebar px-3 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{brandDomain}</span>
              <strong className="font-semibold text-foreground">{version}</strong>
            </div>
            <div className="mt-2 text-xs leading-5 text-muted-foreground">{updateMeta}</div>
            <div className="mt-3 flex flex-col gap-2">
              {remoteVersion ? (
                <Button
                  size="sm"
                  disabled={runningUpdate}
                  onClick={() => {
                    setRunningUpdate(true);
                    void startAppUpdate()
                      .then(() => {
                        setUpdateMeta("更新任务已启动");
                        onNavigate("dashboard");
                      })
                      .catch((error) => {
                        setUpdateMeta(readUserErrorMessage(error, "启动更新失败"));
                      })
                      .finally(() => {
                        setRunningUpdate(false);
                      });
                  }}
                >
                  <Download size={14} />
                  {runningUpdate ? "启动中..." : `更新到 v${remoteVersion}`}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void openOpenclawConsole().catch((error) => {
                    setUpdateMeta(readUserErrorMessage(error, "打开 openclaw Console 失败"));
                  });
                }}
              >
                打开 openclaw 控制台
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="shell-main">
        <header className="topbar">
          <div className="flex min-w-0 items-start gap-3">
            <SidebarTrigger className="mt-1 md:hidden" />
            <div className="min-w-0">
              <p className="eyebrow">Windows 运维桌面</p>
              <h2>{title}</h2>
              {description ? <p className="topbar-copy">{description}</p> : null}
            </div>
          </div>
          <div className="topbar-actions">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <BellRing size={14} />
              刷新页面
            </Button>
            <Button
              size="sm"
              onClick={() => {
                void openOpenclawConsole().catch((error) => {
                  setUpdateMeta(readUserErrorMessage(error, "打开 openclaw Console 失败"));
                });
              }}
            >
              <ShieldCheck size={14} />
              启动 openclaw
            </Button>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
