/** @jsxImportSource hono/jsx */

import type { Product } from "../../lib/types";

export function renderProductsSection(products: Product[]) {
  return (
    <section id="products" class="card mb-6 bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h2 class="card-title">商品管理</h2>
          <button class="btn btn-primary btn-sm" type="button" onclick={"openCreateProductModal()"}>新增商品</button>
        </div>
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead><tr><th>ID</th><th>名称</th><th>价格</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {products.length === 0 ? <tr><td colSpan={5} class="text-center">暂无商品</td></tr> : products.map((product) => (
                <tr>
                  <td>{product.id}</td><td>{product.name}</td><td>{product.priceCny || "-"}</td><td>{product.published ? "已发布" : "草稿"}</td>
                  <td class="flex gap-2">
                    <button
                      class="btn btn-xs btn-outline"
                      type="button"
                      data-product={encodeURIComponent(JSON.stringify(product))}
                      onclick={"openEditProductModalFromEncoded(this.dataset.product)"}
                    >
                      编辑
                    </button>
                    <form method="post" action="/admin/products/delete"><input type="hidden" name="id" value={product.id} /><button class="btn btn-xs btn-error" type="submit">删除</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <dialog id="product-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg" id="product-modal-title">新增商品</h3>
          <form method="post" action="/admin/products/save" class="mt-4 space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <label class="label">
                <span class="label-text">商品 ID *</span>
                <input id="product-id" name="id" class="input input-bordered w-full" placeholder="如 pro-plan" required />
              </label>
              <label class="label">
                <span class="label-text">商品名称 *</span>
                <input id="product-name" name="name" class="input input-bordered w-full" placeholder="如 Pro Plan" required />
              </label>
            </div>

            <label class="label">
              <span class="label-text">商品描述</span>
              <textarea
                id="product-description"
                name="description"
                class="textarea textarea-bordered w-full"
                placeholder="描述（可选）"
                rows={2}
              />
            </label>

            <label class="label">
              <span class="label-text">图片</span>
              <div class="space-y-2">
                <input id="product-image-url" name="imageUrl" class="input input-bordered w-full" placeholder="选择文件后自动上传并回填地址" readonly />
                <input id="product-image-file" class="file-input file-input-bordered w-full" type="file" accept="image/*" />
                <p id="product-image-upload-status" class="text-xs text-base-content/60">选择图片后自动上传</p>
              </div>
            </label>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="label">
                <span class="label-text">价格</span>
                <input id="product-price" name="priceCny" class="input input-bordered w-full" placeholder="如 199/月" />
              </label>
              <label class="label">
                <span class="label-text">购买链接</span>
                <input id="product-link" name="link" class="input input-bordered w-full" placeholder="https://..." />
              </label>
            </div>

            <label class="label cursor-pointer justify-start gap-3">
              <input id="product-published" class="checkbox" type="checkbox" name="published" value="true" />
              <span class="label-text">发布到前台</span>
            </label>

            <button class="btn btn-primary w-full" type="submit">保存商品</button>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </section>
  );
}
