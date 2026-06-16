# OpenCow 网页端 Mac 启动器

- 双击桌面的 `OpenCow网页端.app` 会启动 `apps/web` 的本地开发服务，并自动用默认浏览器打开 `http://127.0.0.1:1421`。
- 启动过程不会弹出终端窗口；服务会在后台运行，日志写入 `/tmp/opencow-web-dev.log`。
- 再次双击同一个 `OpenCow网页端.app` 会弹出“OpenCow 网页端已退出”，并关闭后台服务。
- 配套脚本统一收纳在项目目录 [scripts](/Users/apple/Desktop/2026/opencow/scripts) 下：
  `start-opencow-web-mac.command`
  `stop-opencow-web-mac.command`
- 桌面默认只保留 `OpenCow网页端.app`，不再额外放置 `.command` 副本。
- 如果第一次启动后网页还没完全 ready，再次双击也会按“退出”处理，避免残留 Vite 进程。
