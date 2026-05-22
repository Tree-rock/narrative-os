# Narrative OS · 叙事

> 一个具有个人审美气质的求职工作台——帮你整理经历、理解自己、从容应对每一次面试。

---

## 这是什么

Narrative OS 不是传统的求职管理工具。它的核心信念是：

**找工作最难的部分，不是投递流程，而是不知道如何讲述自己的经历。**

它由六个模块构成，从读懂一份 JD，到整理你真实经历的叙事版本，再到追踪每一次投递——流程串联，气质统一。

---

## 功能模块

| 模块 | 描述 |
|------|------|
| **JD 分析** | 粘贴岗位描述，AI 拆解核心能力要求、隐性偏好、岗位气质与高频关键词 |
| **简历分析** | 上传或粘贴简历，获得"阅读感反馈"——不是 ATS 打分，而是真实面试官的第一印象 |
| **匹配分析** | 将 JD 与简历对照，分析能力/气质契合度、表达错位与隐性优势 |
| **面试预测** | 基于匹配结果，分层预测面试问题（HR轮、业务轮、压力层），附面试官真实意图 |
| **经历整理** | 语音或文字输入碎片经历，AI 帮你提炼叙事，生成 STAR/聊天/高压/简洁四个版本 |
| **投递追踪** | 同步飞书多维表格，时间轴视图记录每次投递的阶段、情绪与主观感受 |

---

## 技术栈

- **框架**：Next.js 16 · App Router · TypeScript
- **样式**：Tailwind CSS v4 · shadcn/ui（base-nova 风格）
- **动效**：Framer Motion
- **AI**：Anthropic Claude API（`@anthropic-ai/sdk`）
- **数据库 & 认证**：Supabase（`@supabase/ssr`）
- **内容渲染**：react-markdown · remark-gfm

---

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量（见下方说明）
cp .env.example .env.local

# 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看。

---

## 环境变量

在项目根目录创建 `.env.local`，填入以下变量：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key

# 飞书（可选，用于投递追踪同步）
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
```

---

## 项目结构

```
narrative-os/
├── app/                    # Next.js App Router
│   ├── jd/                 # JD 分析页
│   ├── resume/             # 简历分析页
│   ├── match/              # 匹配与面试预测页
│   ├── narrative/          # 经历整理工作台
│   ├── tracker/            # 投递追踪页
│   └── api/                # API Routes（AI 调用代理）
├── components/
│   ├── ui/                 # shadcn/ui 基础组件
│   └── ...                 # 业务组件
├── lib/
│   ├── ai/                 # Claude API 调用封装
│   ├── supabase/           # Supabase 客户端
│   └── feishu/             # 飞书 API 封装
└── hooks/                  # 自定义 React Hooks
```

---

## 设计原则

- **克制**：不制造焦虑，不强调 KPI，没有打分系统
- **呼吸感**：大留白，柔和动效，近白暖灰的色调
- **对话感**：AI 是协作者而非指挥者，用户保有最终解释权
- **真实感**：经历整理的目标是保留人话，而不是生成模板话术

---

## 路线图

- [x] 项目初始化
- [ ] JD 分析模块（MVP）
- [ ] 简历分析模块（MVP）
- [ ] 匹配与面试预测（MVP）
- [ ] 飞书多维表格同步（MVP）
- [ ] 经历整理工作台 + 语音输入
- [ ] 经历库（标签分类、快速调用）
- [ ] 情绪轨迹与求职复盘

---

## 部署

推荐使用 [Vercel](https://vercel.com) 一键部署。将环境变量配置到 Vercel 项目设置中即可。

```bash
npm run build
```
