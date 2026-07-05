-- GBP診断Webアプリ 初期スキーマ
-- アクセスはすべてNext.jsサーバ側からservice_roleキーで行う。
-- RLSを有効化し、anon/authenticatedからのアクセスは許可しない（ポリシーなし＝全拒否）。

create table if not exists diagnoses (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  area text not null,
  created_at timestamptz not null default now(),
  data jsonb not null,        -- 自動診断の生データ（target/competitors/mechanical/apiCallCount）
  judged jsonb not null,      -- Claude判定（reviewQuality/primaryCategoryFit/insight/priorities/risk）
  human jsonb,                -- 人間診断（answers/memos/finalized/updatedAt）。未実施ならnull
  total_score numeric         -- 総合スコア（自動+人間の平均）。人間診断確定時のみ
);

create index if not exists diagnoses_created_at_idx on diagnoses (created_at desc);

create table if not exists diagnosis_logs (
  id bigint generated always as identity primary key,
  diagnosis_id uuid references diagnoses(id) on delete cascade,
  created_at timestamptz not null default now(),
  places_api_calls int not null default 0,
  anthropic_input_tokens int not null default 0,
  anthropic_output_tokens int not null default 0,
  model text
);

alter table diagnoses enable row level security;
alter table diagnosis_logs enable row level security;

revoke all on diagnoses from anon, authenticated;
revoke all on diagnosis_logs from anon, authenticated;
grant all on diagnoses to service_role;
grant all on diagnosis_logs to service_role;
