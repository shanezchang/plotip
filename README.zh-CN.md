# 落点 Plotip

每个 IP，都有来处。查询 IP 归属地，在一张安静、直观的地图上探索它的位置。

[在线体验](https://ip-atlas-app.vercel.app/) · [English](README.md) · [数据与署名](THIRD_PARTY_NOTICES.md) · [开发说明](docs/development.md)

![Plotip](docs/preview.png)

支持 IPv4 / IPv6、国家 / 地区 / 城市 / 运营商查询、地图定位、会话历史、复制结果、中英文、明暗主题。

查询在服务端完成，浏览器只接收结果。底图自托管，不需要地图 API key、注册账号或外部数据库。没有付费查询接口，也没有添加访问追踪脚本。

## 本地运行

安装 uv 和 Node.js 22+ 后：

```sh
git clone https://github.com/shanezchang/ip-atlas.git
cd ip-atlas
uv sync --locked
npm ci
npm run build
uv run uvicorn app:app --host 127.0.0.1 --port 8019
```

打开 http://127.0.0.1:8019。仓库已包含可用的数据快照，无需配置凭据。

开发时另开终端运行 `npm run dev`，访问 http://127.0.0.1:5179，前端会把 API 请求转发给本地 Python 服务。

## 地图标记的含义

IP 归属地不是设备的实际位置。代理、VPN、共享网络出口和数据更新延迟都可能影响结果。城市标记使用 GeoNames 的城市中心；无法可靠匹配城市时，退回省 / 州或国家参考坐标，并明确提示。没有坐标时仍然提供文字结果。内网与保留地址不标注地理位置。

底图用于地域概览，缩放止于区域级，不提供街道和门牌定位。查询历史只保存在当前标签页的 sessionStorage；偏好的语言和主题保存在 localStorage。托管平台可能保留基础访问日志。

## 技术与部署

Python 3.12 + uv + FastAPI，Vite + TypeScript + MapLibre GL JS。一个 Vercel 项目，前端走 CDN，查询走 Python Function。IP 数据库在服务端，用户不下载 XDB。

[部署说明](docs/deployment.md) · [检查与数据更新](docs/development.md)

应用代码使用 MIT 许可；第三方数据与依赖保留各自许可，见 [第三方声明](THIRD_PARTY_NOTICES.md)。这是基于 ip2region 的独立作品，不是其官方网站或商用数据服务。
