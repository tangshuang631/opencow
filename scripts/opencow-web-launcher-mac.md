# OpenCow 网页端 Mac 启动器

- 双击桌面的 `OpenCow网页端启动.command` 会启动 `apps/web` 的本地开发服务，并自动打开默认浏览器到 `http://127.0.0.1:1421`。
- 启动器会复用已经运行的同一份服务，避免重复拉起多个 Vite 进程。
- 日志文件在 `/tmp/opencow-web-dev.log`。
- 如需手动停止服务，双击桌面的 `OpenCow网页端停止.command`。
