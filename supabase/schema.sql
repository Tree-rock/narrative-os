-- ════════════════════════════════════════════════════════
-- 叙事 · Narrative OS — Supabase Schema
-- ════════════════════════════════════════════════════════

-- 启用 pgvector（用于经历语义搜索）
create extension if not exists vector;

-- ─── 用户扩展信息 ────────────────────────────────────────────
create table if not exists user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text,
  target_roles text[],
  bio          text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── 经历条目（核心底座）────────────────────────────────────
create table if not exists experience_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,

  -- 原始输入
  raw_input    text not null,
  input_type   text check (input_type in ('text','voice','resume','upload')) default 'text',

  -- AI 结构化提取
  project_name text,
  role         text,
  time_period  text,
  actions      text[],
  skills       text[],
  results      text[],
  metrics      text,
  emotions     text,
  values       text,
  turning_pt   text,

  -- 多版本叙事
  v_star       text,
  v_concise    text,
  v_chat       text,
  v_pressure   text,

  -- 求职元数据
  suitable_roles text[],
  potential_qs   text[],

  -- 向量（语义搜索）
  embedding    vector(1536),

  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── JD Workspaces ──────────────────────────────────────────
create table if not exists jd_workspaces (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,

  title        text not null,
  company      text,
  position     text,
  jd_content   text not null,
  jd_url       text,

  -- AI 分析（完整 JSON + 关键字段冗余）
  analysis     jsonb,
  keywords     text[],
  culture_vibe text,
  advisor_note text,

  status       text check (status in ('active','archived')) default 'active',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ─── Workspace ↔ 激活经历 ───────────────────────────────────
create table if not exists workspace_experiences (
  workspace_id   uuid references jd_workspaces(id) on delete cascade,
  experience_id  uuid references experience_entries(id) on delete cascade,
  relevance      float check (relevance >= 0 and relevance <= 1),
  reason         text,
  is_pinned      boolean default false,
  primary key (workspace_id, experience_id)
);

-- ─── Workspace 产出物 ────────────────────────────────────────
create table if not exists workspace_artifacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references jd_workspaces(id) on delete cascade,
  type         text check (type in ('greeting','resume','interview','match')) not null,
  version      int default 1,
  content      jsonb not null,
  created_at   timestamptz default now()
);

-- ─── 求职应用追踪 ────────────────────────────────────────────
create table if not exists job_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  workspace_id     uuid references jd_workspaces(id) on delete set null,

  company          text not null,
  position         text not null,
  jd_url           text,
  applied_at       date,

  status           text check (status in (
    'drafting','applied','phone_screen',
    'interview','offer','rejected','withdrawn'
  )) default 'drafting',

  next_action      text,
  next_action_date date,
  notes            text,
  emotion_note     text,

  feishu_record_id text,
  feishu_synced_at timestamptz,

  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- ─── AI 对话记录 ─────────────────────────────────────────────
create table if not exists chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  workspace_id uuid references jd_workspaces(id) on delete set null,

  role         text check (role in ('user','assistant')) not null,
  content      text not null,
  action_type  text,
  action_data  jsonb,

  created_at   timestamptz default now()
);

-- ─── 索引 ────────────────────────────────────────────────────
create index if not exists idx_experience_user
  on experience_entries (user_id, created_at desc);

create index if not exists idx_experience_skills
  on experience_entries using gin (skills);

create index if not exists idx_experience_embedding
  on experience_entries using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists idx_workspace_user
  on jd_workspaces (user_id, status, created_at desc);

create index if not exists idx_application_user
  on job_applications (user_id, status, applied_at desc);

create index if not exists idx_chat_user_workspace
  on chat_messages (user_id, workspace_id, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────
alter table user_profiles       enable row level security;
alter table experience_entries  enable row level security;
alter table jd_workspaces       enable row level security;
alter table workspace_experiences enable row level security;
alter table workspace_artifacts enable row level security;
alter table job_applications    enable row level security;
alter table chat_messages       enable row level security;

-- 用户只能访问自己的数据
create policy "user_profiles_self" on user_profiles
  for all using (auth.uid() = id);

create policy "experience_entries_self" on experience_entries
  for all using (auth.uid() = user_id);

create policy "jd_workspaces_self" on jd_workspaces
  for all using (auth.uid() = user_id);

create policy "workspace_experiences_self" on workspace_experiences
  for all using (
    auth.uid() = (select user_id from jd_workspaces where id = workspace_id)
  );

create policy "workspace_artifacts_self" on workspace_artifacts
  for all using (
    auth.uid() = (select user_id from jd_workspaces where id = workspace_id)
  );

create policy "job_applications_self" on job_applications
  for all using (auth.uid() = user_id);

create policy "chat_messages_self" on chat_messages
  for all using (auth.uid() = user_id);

-- ─── updated_at 自动触发器 ───────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function set_updated_at();

create trigger trg_experience_entries_updated_at
  before update on experience_entries
  for each row execute function set_updated_at();

create trigger trg_jd_workspaces_updated_at
  before update on jd_workspaces
  for each row execute function set_updated_at();

create trigger trg_job_applications_updated_at
  before update on job_applications
  for each row execute function set_updated_at();
