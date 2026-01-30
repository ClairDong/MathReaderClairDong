# MathReader - 数学学习助手

一个帮助学习《Linear Algebra Done Right》的交互式阅读器，集成 AI 助手帮助理解数学概念。

![MathReader Screenshot](https://img.shields.io/badge/version-1.0.0-blue)

## 功能特点

- 📖 **PDF阅读器** - 支持翻页、缩放、键盘快捷键
- 📑 **结构化目录** - 按 Chapter → Section → 数学对象组织
- 🤖 **AI学习助手** - 集成 Kimi API，帮助理解定义、定理、例子
- ✅ **学习进度** - 标记已学内容，进度自动保存
- 💬 **聊天记录** - 每个对象的对话历史自动保存
- 📐 **LaTeX渲染** - 支持数学公式显示

## 快速开始

### 1. 下载PDF教材

本项目需要配合《Linear Algebra Done Right》第四版 PDF 使用。

你可以从作者官网免费下载：https://linear.axler.net/

下载后将 PDF 文件命名为 `LADR4e.pdf` 放在项目根目录。

### 2. 获取 Kimi API Key

1. 访问 [Kimi开放平台](https://platform.moonshot.cn/console/api-keys)
2. 注册并登录
3. 创建 API Key

### 3. 启动本地服务器

由于浏览器安全限制，需要通过本地服务器运行。

**方式1：使用启动脚本（最简单）**

- **Windows 用户**：双击 `start.bat` 文件（使用 Python）或 `start-node.bat`（使用 Node.js）
- **PowerShell 用户**：右键点击 `start.ps1`，选择"使用 PowerShell 运行"

启动脚本会自动：
- 检查 Python/Node.js 是否安装
- 启动本地服务器
- 自动打开浏览器

**方式2：手动启动（Python）**
```bash
cd MathReader
python -m http.server 8080
```

**方式3：手动启动（Node.js）**
```bash
npm install -g http-server
http-server -p 8080
```

### 4. 打开浏览器

如果使用启动脚本，浏览器会自动打开。否则请手动访问：http://localhost:8080

## 使用说明

1. 首次使用时，在右侧面板输入你的 Kimi API Key
2. 点击左侧目录选择要学习的内容
3. 在聊天框中向 AI 提问
4. 点击 ✓ 标记已学习的内容

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `←` `→` | 翻页 |
| `+` `-` | 缩放 |

## 项目结构

```
MathReader/
├── index.html      # 主页面
├── styles.css      # 样式文件
├── app.js          # 应用逻辑
├── LADR4e.pdf      # PDF教材（需自行下载）
└── README.md       # 说明文档
```

## 技术栈

- **PDF渲染**: PDF.js
- **数学公式**: KaTeX
- **AI接口**: Kimi API (moonshot-v1-32k)
- **图标**: Font Awesome
- **存储**: localStorage

## 配置说明

如需修改 AI 模型，编辑 `app.js` 中的配置：

```javascript
const CONFIG = {
    kimiModel: 'moonshot-v1-32k', // 可选: moonshot-v1-8k, moonshot-v1-128k
    // ...
};
```

## License

MIT License

## 致谢

- 《Linear Algebra Done Right》作者 Sheldon Axler
- [Kimi](https://kimi.moonshot.cn/) 提供的 AI 服务
