-- Settings persistence tables and RLS
-- Notification preferences
create table if not exists notification_prefs (
  vendor_id uuid primary key references profiles(id) on delete cascade,
  email_notifications boolean not null default true,
  whatsapp_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table notification_prefs enable row level security;

create policy if not exists "notification_prefs_select_own"
  on notification_prefs for select
  using (vendor_id = auth.uid());

create policy if not exists "notification_prefs_insert_own"
  on notification_prefs for insert
  with check (vendor_id = auth.uid());

create policy if not exists "notification_prefs_update_own"
  on notification_prefs for update
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Staff roles
do $$ begin
  create type role_type as enum ('admin','manager','staff');
exception when duplicate_object then null; end $$;

create table if not exists staff_roles (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  email text not null,
  role role_type not null default 'staff',
  created_at timestamptz not null default now()
);
create index if not exists staff_roles_vendor_idx on staff_roles (vendor_id);

alter table staff_roles enable row level security;

create policy if not exists "staff_roles_select_own"
  on staff_roles for select
  using (vendor_id = auth.uid());

create policy if not exists "staff_roles_insert_own"
  on staff_roles for insert
  with check (vendor_id = auth.uid());

create policy if not exists "staff_roles_update_own"
  on staff_roles for update
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

create policy if not exists "staff_roles_delete_own"
  on staff_roles for delete
  using (vendor_id = auth.uid());

-- Branding columns on profiles
alter table profiles
  add column if not exists brand_color text,
  add column if not exists theme text check (theme in ('light','dark','system'));

-- Subscriptions
do $$ begin
  create type plan_type as enum ('free','basic','pro','enterprise');
exception when duplicate_object then null; end $$;

create table if not exists user_subscriptions (
  vendor_id uuid primary key references profiles(id) on delete cascade,
  plan plan_type not null default 'free',
  renews_at date,
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

alter table user_subscriptions enable row level security;

create policy if not exists "user_subscriptions_select_own"
  on user_subscriptions for select
  using (vendor_id = auth.uid());

create policy if not exists "user_subscriptions_upsert_own"
  on user_subscriptions for insert
  with check (vendor_id = auth.uid());

create policy if not exists "user_subscriptions_update_own"
  on user_subscriptions for update
  using (vendor_id = auth.uid())
  with check (vendor_id = auth.uid());

-- Subscription payments history (optional)
create table if not exists subscription_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  paid_at timestamptz not null default now(),
  notes text
);

alter table subscription_payments enable row level security;

create policy if not exists "subscription_payments_select_own"
  on subscription_payments for select
  using (vendor_id = auth.uid());
