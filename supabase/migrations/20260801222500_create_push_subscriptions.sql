-- supabase/migrations/20260801_create_push_subscriptions.sql
-- Migration file to create push_subscriptions table, indexes, RLS, and service_role permissions.

-- 1. Create push_subscriptions table
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    token text not null unique,
    enabled boolean not null default true,
    device_name text,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Create index on user_id and enabled for fast lookup
create index if not exists push_subscriptions_user_id_enabled_idx 
    on public.push_subscriptions (user_id, enabled);

-- 3. Enable Row Level Security (RLS)
alter table public.push_subscriptions enable row level security;

-- 4. Create secure RLS policies (limit access strictly to the owner of the subscription)
drop policy if exists "Users can select their own push subscriptions" on public.push_subscriptions;
create policy "Users can select their own push subscriptions" on public.push_subscriptions
    for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;
create policy "Users can insert their own push subscriptions" on public.push_subscriptions
    for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
create policy "Users can update their own push subscriptions" on public.push_subscriptions
    for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can delete their own push subscriptions" on public.push_subscriptions
    for delete to authenticated using (auth.uid() = user_id);

-- 5. Grant permissions to service_role (used by edge functions)
grant usage on schema public to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
