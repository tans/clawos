# ClawOS 发布上传中转（Relay）实施指南

适用场景：GitHub Actions（尤其是 `windows-latest`）直接上传到 `https://clawos.minapp.xin` 时，跨境链路抖动大，分片上传长期无进度或超时。

## 目标

把链路从：

- `GitHub Runner -> 源站 (clawos.minapp.xin)`

改为：

- `GitHub Runner -> 中转节点 (relay.global.minapp.xin) -> 源站 (clawos.minapp.xin)`

通过更稳定的国际入口（香港/日本/新加坡等机房）降低丢包和长尾时延。

## 最小实现（Nginx 反向代理）

在中转机（建议 2C4G+，100Mbps+）部署 Nginx，示例配置：

```nginx
server {
  listen 443 ssl http2;
  server_name relay.global.minapp.xin;

  # 证书略（可用 Let's Encrypt）
  ssl_certificate     /etc/letsencrypt/live/relay.global.minapp.xin/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/relay.global.minapp.xin/privkey.pem;

  # 大文件上传与长连接超时
  client_max_body_size 1024m;
  proxy_request_buffering off;
  proxy_buffering off;
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  send_timeout 3600s;

  location / {
    proxy_pass https://clawos.minapp.xin;
    proxy_http_version 1.1;

    # 保留关键头，避免后端鉴权/路由异常
    proxy_set_header Host clawos.minapp.xin;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;

    # 如果后端需要 Authorization / x-platform / x-channel，默认会透传
  }
}
```

> 若使用 Caddy/Traefik，核心点同上：关闭请求缓冲、放大 body 限制、拉长超时。

## GitHub Actions 接入

本仓库发布工作流已在 YAML 中写死中转地址，不依赖仓库 Variables。

发布命令会直接携带：

- `--base-url "https://relay.global.minapp.xin"`

## 验证清单

1. 在本地或中转机执行：
   - `curl -I https://relay.global.minapp.xin`
2. 在 Actions 的 `Publish endpoint diagnostics` 看 DNS 与 HEAD 是否成功。
3. 观察发布日志：
   - 分片是否连续完成（`分片成功`）
   - 单片耗时是否明显缩短
   - 总体是否不再超时

## 推荐参数

当链路较差时，可与中转一起使用：

- `UPLOAD_TIMEOUT_MS=2700000`（45 分钟）
- `UPLOAD_CHUNK_SIZE_MB=4`
- `UPLOAD_CHUNK_THRESHOLD_MB=8`

若仍不稳，可继续降到 `UPLOAD_CHUNK_SIZE_MB=2`。

## 进阶方案（可选）

- 对象存储中转：Actions 上传到 S3/OSS/COS（预签名 URL），源站异步拉取归档。
- 专线/隧道：Cloudflare Tunnel / Anycast 边缘入口。
- 服务端幂等：支持断点续传、秒传（同 hash 跳过二次上传）。
