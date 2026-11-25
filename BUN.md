# Bun 使用指南

本仓库的浏览器测试使用 [Bun](https://bun.sh) 作为运行时、包管理器和测试运行器。
Bun 是一个二进制工具，同时提供运行时、依赖安装、测试执行和打包能力，没有单独的
`npm`、`npx` 命令需要记。

## 安装

macOS / Linux：

```sh
curl -fsSL https://bun.sh/install | bash
```

Windows（PowerShell）：

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

已经在用 npm 或 Homebrew 时也可以：

```sh
npm install -g bun
brew install oven-sh/bun/bun
```

安装后确认版本（本仓库用 Bun 1.2 及以上验证通过）：

```sh
bun --version
```

以后升级 Bun：

```sh
bun upgrade
```

## 本仓库常用命令

所有命令都在 `test/` 目录下执行：

```sh
cd test

bun install                        # 按 bun.lock 安装依赖
bun install --frozen-lockfile      # CI 用：锁文件不一致时直接失败
bun add -d <package>               # 添加开发依赖
bun remove <package>               # 移除依赖

bunx playwright install chromium   # 首次运行前安装 Chromium

bun test                           # 运行全部测试
bun test sidebar.test.mjs          # 只跑指定测试文件
bun test -t "outline"              # 按用例名筛选
PWDEBUG=1 bun test                 # 调试模式，等同于 bun run test:headed
```

Typst 不在 `PATH` 时，用环境变量指定可执行文件：

```sh
TYPST=/path/to/typst bun test
```

## 测试说明

- 测试代码使用 Node 内置的 `node:test` 写法，Bun 可以直接运行，无需改动。
- 测试通过 Playwright 驱动 Chromium，并调用 `typst` 编译 `test/fixtures/`。
- 测试会写入 `test/.output/`（已忽略）并覆盖 `test/screenshots/` 中的截图。
- 主要耗时在浏览器和 Typst 编译，切换运行时不会明显加快测试。

## 依赖与锁文件

- 本仓库使用 `test/bun.lock`，不再保留 `package-lock.json`。
- `bun install` 会创建或更新 `bun.lock`；需要锁定安装时使用 `--frozen-lockfile`。
- 不要在同一个项目里同时提交 `bun.lock` 和 `package-lock.json`。

## 与 Node 共存

- 不需要卸载 Node；Bun 只负责本仓库的依赖安装和测试脚本。
- `bun run test` 会执行 `package.json` 中的 `test` 脚本，当前即 `bun test`。
- 注意 `bun --bun run test`：如果脚本仍写 `node --test`，Bun 不会把 `--test`
  翻译成自己的测试入口，必须直接使用 `bun test`。本仓库已经改为 `bun test`。

## 常见问题

**提示找不到浏览器**

```sh
cd test
bunx playwright install chromium
```

**提示找不到 typst**

```sh
TYPST=/path/to/typst bun test
```

**只想快速验证一个用例**

```sh
bun test -t "package metadata"
```
