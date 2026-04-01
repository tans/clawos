/** @jsxImportSource hono/jsx */

import type { AdminTask } from "../../lib/types";

export function renderTasksSection(tasks: AdminTask[]) {
  return (
    <section id="tasks" class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">任务管理</h2>
        <form method="post" action="/admin/tasks/save" class="grid gap-3 md:grid-cols-4">
          <input class="input input-bordered w-full md:col-span-2" name="title" placeholder="任务标题" required />
          <select class="select select-bordered w-full" name="priority" defaultValue="medium">
            <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
          </select>
          <input class="input input-bordered w-full" type="date" name="dueDate" />
          <textarea class="textarea textarea-bordered w-full md:col-span-4" name="description" placeholder="任务描述" />
          <input id="task-image-url" class="input input-bordered w-full md:col-span-3" name="imageUrl" placeholder="选择文件后自动上传并回填地址" readonly />
          <div class="space-y-2 md:col-span-1">
            <input id="task-image-file" class="file-input file-input-bordered w-full" type="file" accept="image/*" />
            <p id="task-image-upload-status" class="text-xs text-base-content/60">选择图片后自动上传</p>
          </div>
          <button class="btn btn-primary md:col-span-4" type="submit">新增任务</button>
        </form>
        <div class="divider" />
        <div class="space-y-2">
          {tasks.length === 0 ? <p class="text-sm text-base-content/60">暂无任务</p> : tasks.map((task) => (
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-box border border-base-300 p-3">
              <div>
                <p class={`font-medium ${task.done ? "line-through text-base-content/50" : ""}`}>{task.title}</p>
                <p class="text-xs text-base-content/60">优先级：{task.priority} {task.dueDate ? `· 截止 ${task.dueDate}` : ""}</p>
                {task.imageUrl ? <a class="link link-primary text-xs" href={task.imageUrl} target="_blank" rel="noreferrer">查看图片</a> : null}
              </div>
              <div class="flex gap-2">
                <form method="post" action="/admin/tasks/toggle"><input type="hidden" name="id" value={task.id} /><button class="btn btn-xs btn-outline" type="submit">{task.done ? "标记未完成" : "标记完成"}</button></form>
                <form method="post" action="/admin/tasks/delete"><input type="hidden" name="id" value={task.id} /><button class="btn btn-xs btn-error" type="submit">删除</button></form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
