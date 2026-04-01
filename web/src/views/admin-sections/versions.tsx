/** @jsxImportSource hono/jsx */

import type { LatestRelease } from "../../lib/types";

function releaseCard(label: string, channel: string, data: LatestRelease | null) {
  return (
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body">
        <h3 class="card-title text-base">{label}</h3>
        <p class="text-xs text-base-content/60">当前版本：{data?.version || "dev"}</p>
        <form method="post" action="/admin/releases/save" class="mt-2 space-y-2">
          <input type="hidden" name="channel" value={channel} />
          <input class="input input-bordered input-sm w-full" name="version" placeholder="例如 1.2.3" required />
          <button class="btn btn-primary btn-sm w-full" type="submit">更新版本</button>
        </form>
      </div>
    </div>
  );
}

export function renderVersionsSection(releases: {
  stable: LatestRelease | null;
  beta: LatestRelease | null;
  alpha: LatestRelease | null;
}) {
  return (
    <section id="versions" class="mb-6 grid gap-3 md:grid-cols-3">
      {releaseCard("Stable 版本", "stable", releases.stable)}
      {releaseCard("Beta 版本", "beta", releases.beta)}
      {releaseCard("Alpha 版本", "alpha", releases.alpha)}
    </section>
  );
}
