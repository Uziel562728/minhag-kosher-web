-- supabase/migrations/20260802000000_grants_push_orders.sql
-- Migration to grant usage and selection/updating privileges to authenticated users on orders and order_items.

-- 1. Grant usage on schema public to authenticated users
grant usage on schema public to authenticated;

-- 2. Grant read (select) and write (update) on orders to authenticated users
grant select, update on public.orders to authenticated;

-- 3. Grant read (select) on order_items to authenticated users
grant select on public.order_items to authenticated;

-- Note: No direct INSERT/DELETE privileges are granted to authenticated users on orders and order_items.
-- Inserting remains strictly handled by the database RPC invoked by the create-order edge function.
