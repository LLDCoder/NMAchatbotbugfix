# AI Chatbot 当前代码交接包

本包是一次固定的开发快照，供同事继续开发和复测。精确版本、生成时间和验收进度见根目录 `DELIVERY_STATE.json`。包含 Admin Agent、Portal 前端、审计前端、平台/知识网关、可选 OCR 服务源码、回归测试，以及已发布知识的本地页面绑定。不是全部业务用例验收通过的发布声明。

## 1. 首次运行

准备 Python 3.12、支持原生 TypeScript 导入的 Node.js（当前验证环境为 26.6.0）、npm、Docker 与 Compose v2。Windows 可在 WSL2 使用。本包不附依赖缓存、Docker 镜像或数据库。

解压后在本 README 所在目录执行：

```bash
python3 test/verify-package.py
python3 test/local.py init
```

编辑新生成的 `test/.env.local`，填写自己的 `LLM_API_KEY`、`KNOWLEDGE_GATEWAY_TOKEN`，并确认模型、知识目录、远程 UMC 地址及授权 Subject/Tenant/Roles。初始化会生成独立的本机 PostgreSQL、审计账号及控制台密码，重复 init 保留已有配置。业务门户账号与本机审计账号不同；自动问答才需要填写 `NMA_TEST_ACCOUNT` / `NMA_TEST_PASSWORD`。

当前知识服务通过获授权的 SSH 连接转发，单独终端保持隧道运行：

```bash
ssh -C -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=6 -L 127.0.0.1:28001:127.0.0.1:28001 ubuntu@43.165.4.209
```

主机、SSH 账号可按同事自己的授权配置替换。Docker 内默认通过 `host.docker.internal:28001` 连接，Linux 环境需配置可达的宿主机地址。业务 API 默认 `http://77.242.240.158:18081`；这些是现有测试服务地址，不包含登录凭据。

```bash
python3 test/local.py up
python3 test/local.py check
```

首次启动会下载 npm/Python 依赖与 Chromium。入口：Portal `http://localhost:18086/`；审计 `http://localhost:18086/dsh-audit/`；Agent 文档 `http://localhost:8001/docs`。本机 Compose 的 Reader 和平台网关通过 `host.docker.internal:18086` 读取同一份本地 Portal，门户 `/api` 代理再连接 `.env.local` 中的远程 UMC。会话和运行配置保存在本机 PostgreSQL，业务接口仍连接远程系统。Reader 的只读边界不等于整个 Portal 不能写业务数据。

```bash
python3 test/local.py status
python3 test/local.py restart
python3 test/local.py down
```

`down` 保留数据库卷。当前本机启动配置会初始化数据库并种入内置 Skill；请使用新建本机数据库，已有自定义 Skill 的数据库接入前应先审查 `backend/app/db.py` 的初始化逻辑。默认开发模式会热重载；一轮问答期间保持代码和知识版本稳定。数据库中保存的模型/运行配置可能覆盖环境变量。

## 2. 目录与复测

| 目录 | 内容 |
| --- | --- |
| `dsh-admin-source-package-20260923184338/source/backend` | Agent 流程、权限、会话、审计和 Python 测试 |
| 同级 `frontend` | 审计/控制台静态前端 |
| 同级 `platform-gateway`、`knowledge-gateway` | 只读页面操作、接口与知识访问 |
| 同级 `ocr-cpu`、`ocr-gateway` | 可选 OCR 源码；默认本机 Compose 不启动 |
| `navigation-knowledge/sources/umc-admin-portal-target` | 当前 React/TypeScript Portal，含锁文件和依赖补丁 |
| `navigation-knowledge/artifacts/page-catalog.json` | 当前页面目录 |
| `navigation-knowledge/artifacts/KB/pages` | 正式知识的页面本地绑定，包数及记录数见交付快照 |
| `navigation-knowledge/sources/adminportalservice` | 知识直接引用的 C# 源文件，仅供追溯，不是完整业务后端工程 |
| `test/runtime/*/source-evidence`（如有） | 交付快照逐文件批准的源码证据及来源说明，不含运行会话数据 |
| `test` | 本机启动、Compose、复测及打包工具 |
| `DELIVERY_STATE.json` | 精确版本、回归结果、已知失败及待验范围 |
| `MANIFEST.json`、`SHA256SUMS` | 包内文件来源和校验值 |

保留相对目录结构以维持 Docker 构建、源码引用及页面目录加载。知识绑定的业务来源仍需连接当前正式知识服务；包内页面 JSON 不能代替服务权限或业务数据。仅包含本地运行所需的知识文件，没有把陈旧平铺副本及未发布草稿一起交付。

前端：

```bash
cd navigation-knowledge/sources/umc-admin-portal-target
npm ci --no-audit --no-fund
npm run build:nma:dev
```

后端测试依赖见 `backend/requirements-dev.txt`。在项目根目录已启动本机容器后，可运行：

```bash
docker exec nma-admin-local-backend-1 pip install -r /app/requirements-dev.txt
python3 test/run-reader-regressions.py
node test/run-generic-reader.mjs 'What can I do in my current role?'
```

`run-reader-regressions.py` 默认执行一组专项测试，也可传入 `test_*.py` 文件名；不是全量回归命令。自动问答脚本为英语便捷工具，双语业务验收需要分别核查真实结果。测试输出保存在解压目录的 `test/runtime`，不属于交付包预置数据。

## 3. 已验证范围与待办

- `DELIVERY_STATE.json` 记录源码版本及哈希、后端组合回归结果和具体失败节点、知识加载情况、业务关闭进度以及未纳入的候选。回归通过与业务关闭分别统计。
- `PACKAGE_VALIDATION.json` 记录本次打包实际完成的语法、前端构建、本机配置及文件检查；使用已有前端依赖的构建不代表在全新机器上安装通过，也不代表全量 TypeScript 检查通过。
- 页面知识中的历史运行证据引用供追溯；原始会话、截图和业务回文不随包交付。逐文件批准的源码证据保留原相对路径与哈希。
- 新修复仍需按原题完成英阿实测。未验收用例不得仅凭代码回归通过改为已关闭。

这是源码交接包，尚未在同事的全新机器上完成镜像构建和业务登录验收。没有附带个人 `.env`、服务密钥、浏览器登录态、数据库卷、原始会话审计、缓存或旧备份。回归测试保留必要的结构化样本；前端原有公开协议常量按源码保留。
