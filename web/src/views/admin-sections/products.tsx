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
                      onclick={`openEditProductModal(${JSON.stringify(product).replaceAll('"', "&quot;")})`}
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
          <form method="post" action="/admin/products/save" class="mt-4 grid gap-3 md:grid-cols-2">
            <input id="product-id" class="input input-bordered" name="id" placeholder="商品ID (如 pro-plan)" required />
            <input id="product-name" class="input input-bordered" name="name" placeholder="商品名称" required />
            <input id="product-description" class="input input-bordered md:col-span-2" name="description" placeholder="商品描述" />
            <input id="product-image-url" class="input input-bordered md:col-span-2" name="imageUrl" placeholder="商品图片 URL" />
            <div class="md:col-span-2 flex gap-2">
              <input id="product-image-file" class="file-input file-input-bordered flex-1" type="file" accept="image/*" />
              <button class="btn btn-outline" type="button" onclick={"uploadAdminImage('product-image-file','product-image-url','product')"}>上传图片</button>
            </div>
            <input id="product-price" class="input input-bordered" name="priceCny" placeholder="价格 (如 199/月)" />
            <input id="product-link" class="input input-bordered" name="link" placeholder="购买链接" />
            <label class="label cursor-pointer justify-start gap-3 md:col-span-2">
              <input id="product-published" class="checkbox" type="checkbox" name="published" value="true" />
              <span class="label-text">发布到前台</span>
            </label>
            <button class="btn btn-primary md:col-span-2" type="submit">保存商品</button>
          </form>
          <div class="modal-action">
            <form method="dialog"><button class="btn" type="submit">关闭</button></form>
          </div>
        </div>
      </dialog>
    </section>
  );
}
