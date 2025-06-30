# 飓风乒乓培训 - 课程管理系统 (前端)

## 📖 项目简介

飓风乒乓培训课程管理系统的前端应用，基于 React + Vite + Ant Design 构建的现代化Web应用，支持语音录入的智能排课管理平台。

## ✨ 主要功能

- 🔐 **用户认证系统**：登录、注册功能
- 📅 **课表管理**：创建、查看、编辑课表
- 🎤 **语音录入**：支持语音识别录入课程信息
- 📱 **移动端适配**：完美适配手机浏览器
- 👨‍💼 **管理员功能**：课表合并、用户管理
- 🌙 **现代化UI**：基于Ant Design的精美界面

## 🛠️ 技术栈

- **前端框架**：React 18.2.0
- **构建工具**：Vite 4.4.5
- **UI组件库**：Ant Design 5.10.0
- **路由管理**：React Router DOM 6.15.0
- **HTTP客户端**：Axios 1.5.0
- **日期处理**：Day.js 1.11.9
- **开发语言**：JavaScript/JSX

## 📋 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0 或 yarn >= 1.22.0

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发环境运行

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动

### 生产构建

```bash
npm run build
```

构建文件将输出到 `dist/` 目录

### 预览生产版本

```bash
npm run preview
```

## 📁 项目结构

```
timeTable_front/
├── public/                 # 静态资源
│   ├── logo.png           # 品牌Logo
│   └── favicon.ico        # 网站图标
├── src/
│   ├── components/        # 通用组件
│   │   └── AppHeader.jsx  # 应用头部导航
│   ├── pages/            # 页面组件
│   │   ├── Login.jsx     # 登录页面
│   │   ├── Register.jsx  # 注册页面
│   │   ├── Dashboard.jsx # 首页
│   │   ├── CreateTimetable.jsx  # 创建课表
│   │   ├── InputTimetable.jsx   # 录入课表
│   │   ├── ViewTimetable.jsx    # 查看课表
│   │   └── AdminPanel.jsx       # 管理面板
│   ├── services/         # API服务层
│   │   ├── auth.jsx      # 认证相关API
│   │   └── timetable.jsx # 课表相关API
│   ├── App.jsx          # 应用根组件
│   ├── main.jsx         # 应用入口
│   └── index.css        # 全局样式
├── index.html           # HTML模板
├── vite.config.js       # Vite配置
└── package.json         # 项目配置
```

## 🔧 开发配置

### API代理配置

开发环境下自动代理后端API请求到 `http://localhost:8080`

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

### 环境变量

支持的环境变量：
- `VITE_API_BASE_URL`: API基础URL (默认: `/api`)

## 📱 移动端适配

- 完美适配各种屏幕尺寸
- 响应式布局设计
- 触摸友好的交互体验
- PWA支持（渐进式Web应用）

## 🧪 测试账号

开发调试模式下提供测试账号：

- **普通用户**：`testuser` / `password123`
- **管理员**：`admin` / `admin123`

## 📦 构建部署

### 静态文件部署

```bash
npm run build
```

构建后的文件可直接部署到任何静态文件服务器，支持：
- Nginx
- Apache
- CDN服务
- 直接双击打开

### Docker部署

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

## 🤝 开发指南

### 代码规范

- 使用ES6+语法
- 组件采用函数式组件 + Hooks
- 遵循React最佳实践
- 使用Ant Design组件库

### 提交规范

```
feat: 新功能
fix: 修复
docs: 文档
style: 样式
refactor: 重构
test: 测试
chore: 构建过程或辅助工具的变动
```

## 📝 更新日志

### v1.0.0 (2024-01-01)
- ✨ 初始版本发布
- 🔐 用户认证系统
- 📅 课表管理功能
- 🎤 语音录入支持
- 📱 移动端适配

## 📞 联系方式

- **项目地址**：[GitHub Repository]
- **问题反馈**：[Issues]
- **文档地址**：[Documentation]

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**飓风乒乓培训** - 专业保障快乐提高 🏓 