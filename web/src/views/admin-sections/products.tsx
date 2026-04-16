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
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">商品 ID *</span>
                </label>
                <input id="product-id" name="id" class="input input-bordered w-full" placeholder="如 pro-plan" required />
              </div>
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">商品名称 *</span>
                </label>
                <input id="product-name" name="name" class="input input-bordered w-full" placeholder="如 Pro Plan" required />
              </div>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">商品描述</span>
              </label>
              <textarea
                id="product-description"
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
              <input id="product-image-url" name="imageUrl" class="input input-bordered w-full" placeholder="选择文件后自动上传并回填地址" readonly />
              <input id="product-image-file" class="file-input file-input-bordered w-full mt-2" type="file" accept="image/*" />
              <p id="product-image-upload-status" class="text-xs text-base-content/60 mt-1">选择图片后自动上传</p>
            </div>

            <div class="form-control w-full">
              <label class="label">
                <span class="label-text">详情图片（可多张）</span>
              </label>
              <input id="product-image-urls" name="imageUrls" class="input input-bordered w-full" placeholder="已上传的详情图片地址（逗号分隔）" readonly />
              <div id="product-image-urls-preview" class="flex flex-wrap gap-2 mt-2"></div>
              <input id="product-images-files" class="file-input file-input-bordered w-full mt-2" type="file" accept="image/*" multiple />
              <p id="product-images-upload-status" class="text-xs text-base-content/60 mt-1">选择多张图片后自动上传，自动追加到详情图</p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">价格</span>
                </label>
                <input id="product-price" name="priceCny" class="input input-bordered w-full" placeholder="如 199/月" />
              </div>
              <div class="form-control w-full">
                <label class="label">
                  <span class="label-text">购买链接</span>
                </label>
                <input id="product-link" name="link" class="input input-bordered w-full" placeholder="https://..." />
              </div>
            </div>

            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3">
                <input id="product-published" class="checkbox" type="checkbox" name="published" value="true" />
                <span class="label-text">发布到前台</span>
              </label>
            </div>

            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-3">
                <input id="product-requires-logistics" class="checkbox" type="checkbox" name="requiresLogistics" value="true" />
                <span class="label-text">需要物流配送（用户需填写收货信息）</span>
              </label>
            </div>

            <button class="btn btn-primary w-full" type="submit">保存商品</button>
          </form>
        </div>
        <form method="dialog" class="modal-backdrop"><button type="submit">close</button></form>
      </dialog>

      <script dangerouslySetInnerHTML={{ __html: `
        var currentImageUrls = [];

        window.openCreateProductModal = function() {
          currentImageUrls = [];
          document.getElementById('product-modal-title').textContent = '新增商品';
          document.getElementById('product-id').value = '';
          document.getElementById('product-id').disabled = false;
          document.getElementById('product-name').value = '';
          document.getElementById('product-description').value = '';
          document.getElementById('product-image-url').value = '';
          document.getElementById('product-image-urls').value = '';
          document.getElementById('product-price').value = '';
          document.getElementById('product-link').value = '';
          document.getElementById('product-published').checked = false;
          document.getElementById('product-requires-logistics').checked = false;
          updateImageUrlsPreview();
          document.getElementById('product-modal').showModal();
        };

        window.openEditProductModalFromEncoded = function(encodedProduct) {
          try {
            var product = JSON.parse(decodeURIComponent(encodedProduct));
            currentImageUrls = product.imageUrls || [];
            document.getElementById('product-modal-title').textContent = '编辑商品';
            document.getElementById('product-id').value = product.id || '';
            document.getElementById('product-id').disabled = true;
            document.getElementById('product-name').value = product.name || '';
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-image-url').value = product.imageUrl || '';
            document.getElementById('product-image-urls').value = currentImageUrls.join(',');
            document.getElementById('product-price').value = product.priceCny || '';
            document.getElementById('product-link').value = product.link || '';
            document.getElementById('product-published').checked = !!product.published;
            document.getElementById('product-requires-logistics').checked = !!product.requiresLogistics;
            updateImageUrlsPreview();
            document.getElementById('product-modal').showModal();
          } catch (e) {
            console.error('Failed to parse product:', e);
          }
        };

        function updateImageUrlsPreview() {
          var preview = document.getElementById('product-image-urls-preview');
          if (!preview) return;
          var html = '';
          currentImageUrls.forEach(function(url, index) {
            html += '<div class="relative group">';
            html += '<img src="' + url + '" class="w-20 h-20 object-cover rounded" />';
            html += '<button type="button" class="absolute -top-2 -right-2 btn btn-xs btn-circle btn-error" onclick="removeImageUrl(' + index + ')">×</button>';
            html += '</div>';
          });
          preview.innerHTML = html;
        }

        window.removeImageUrl = function(index) {
          currentImageUrls.splice(index, 1);
          document.getElementById('product-image-urls').value = currentImageUrls.join(',');
          updateImageUrlsPreview();
        };

        // Main image upload
        document.getElementById('product-image-file').addEventListener('change', async function(e) {
          var file = e.target.files[0];
          if (!file) return;
          var status = document.getElementById('product-image-upload-status');
          status.textContent = '上传中...';
          try {
            var formData = new FormData();
            formData.append('file', file);
            var res = await fetch('/admin/upload/image', { method: 'POST', body: formData });
            var data = await res.json();
            if (data.url) {
              document.getElementById('product-image-url').value = data.url;
              status.textContent = '上传成功';
            } else {
              status.textContent = '上传失败';
            }
          } catch (err) {
            status.textContent = '上传失败';
          }
        });

        // Detail images upload (multiple)
        document.getElementById('product-images-files').addEventListener('change', async function(e) {
          var files = Array.from(e.target.files);
          if (!files.length) return;
          var status = document.getElementById('product-images-upload-status');
          status.textContent = '上传中... (' + files.length + '张)';
          try {
            for (var i = 0; i < files.length; i++) {
              var formData = new FormData();
              formData.append('file', files[i]);
              var res = await fetch('/admin/upload/image', { method: 'POST', body: formData });
              var data = await res.json();
              if (data.url) {
                currentImageUrls.push(data.url);
              }
            }
            document.getElementById('product-image-urls').value = currentImageUrls.join(',');
            updateImageUrlsPreview();
            status.textContent = '上传成功';
            e.target.value = '';
          } catch (err) {
            status.textContent = '上传失败';
          }
        });
      `}} />
    </section>
  );
}