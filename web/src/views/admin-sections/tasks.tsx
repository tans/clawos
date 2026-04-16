/** @jsxImportSource hono/jsx */

import type { AdminTask } from "../../lib/types";

export function renderTasksSection(tasks: AdminTask[]) {
  return (
    <section id="tasks" class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h2 class="card-title">任务管理</h2>
          <button class="btn btn-primary btn-sm" type="button" onclick={"openCreateTaskModal()"}>新增任务</button>
        </div>
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
      <dialog id="task-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg">新增任务</h3>
          <form method="post" action="/admin/tasks/save" class="mt-4 space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">任务标题 *</span>
                </label>
                <input id="task-title" name="title" class="input input-bordered w-full" placeholder="任务标题" required />
              </div>
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">优先级</span>
                </label>
                <select id="task-priority" name="priority" class="select select-bordered w-full" defaultValue="medium">
                  <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
                </select>
              </div>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">截止日期</span>
              </label>
              <input id="task-due-date" name="dueDate" class="input input-bordered w-full" type="date" />
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">任务描述</span>
              </label>
              <textarea
                id="task-description"
                name="description"
                class="textarea textarea-bordered w-full"
                placeholder="描述（可选）"
                rows={2}
              />
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">图片</span>
              </label>
              <input id="task-image-url" name="imageUrl" class="input input-bordered w-full" placeholder="选择文件后自动上传并回填地址" readonly />
              <input id="task-image-file" class="file-input file-input-bordered w-full mt-2" type="file" accept="image/*" />
              <p id="task-image-upload-status" class="text-xs text-base-content/60 mt-1">选择图片后自动上传</p>
            </div>

            <button class="btn btn-primary w-full" type="submit">提交任务</button>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </section>
  );
}