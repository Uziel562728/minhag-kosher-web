-- supabase_schema.sql
-- Run this SQL in your Supabase SQL Editor to create the necessary tables, storage buckets, and security policies.

-- 1. Enable Row Level Security (RLS) Extensions
create extension if not exists "uuid-ossp";

-- 2. Create Categories Table
create table if not exists public.categories (
    id uuid default gen_random_uuid() primary key,
    nombre text not null,
    slug text not null unique,
    descripcion text,
    imagen text,
    icono text,
    orden integer default 0,
    activa boolean default true,
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Products Table
create table if not exists public.products (
    id uuid default gen_random_uuid() primary key,
    nombre text not null,
    slug text not null unique,
    descripcion text,
    precio numeric not null check (precio >= 0),
    precio_anterior numeric check (precio_anterior >= 0),
    imagen_principal text,
    imagenes_adicionales text[] default '{}'::text[],
    categoria_id uuid references public.categories(id) on delete set null,
    marca text,
    destacado boolean default false,
    oferta boolean default false,
    disponible boolean default true,
    orden integer default 0,
    fecha_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
    fecha_actualizacion timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add product slugs safely when upgrading an existing project.
alter table public.products add column if not exists slug text;

with normalized_products as (
    select
        id,
        trim(both '-' from regexp_replace(
            lower(translate(nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
            '[^a-z0-9]+', '-', 'g'
        )) as base_slug
    from public.products
    where slug is null or slug = ''
), ranked_products as (
    select
        id,
        case
            when base_slug = '' then 'producto-' || left(id::text, 8)
            when row_number() over (partition by base_slug order by id) = 1 then base_slug
            else base_slug || '-' || left(id::text, 8)
        end as generated_slug
    from normalized_products
)
update public.products as products
set slug = ranked_products.generated_slug
from ranked_products
where products.id = ranked_products.id;

create unique index if not exists products_slug_unique_idx
    on public.products (slug)
    where slug is not null;
alter table public.products alter column slug set not null;

-- 4. Enable Row Level Security
alter table public.categories enable row level security;
alter table public.products enable row level security;

-- Drop existing policies if they exist to allow clean re-execution
drop policy if exists "Allow public read-only access to active categories" on public.categories;
drop policy if exists "Allow admins full management access on categories" on public.categories;
drop policy if exists "Allow public read access to categories" on public.categories;
drop policy if exists "Allow authenticated admins to manage categories" on public.categories;

drop policy if exists "Allow public read-only access to available products" on public.products;
drop policy if exists "Allow admins full management access on products" on public.products;
drop policy if exists "Allow public read access to products" on public.products;
drop policy if exists "Allow authenticated admins to manage products" on public.products;

-- 5. Set up Row Level Security Policies for Categories
create policy "Allow public read access to categories" on public.categories
    for select using (true);

create policy "Allow authenticated admins to manage categories" on public.categories
    for all to authenticated using (true) with check (true);

-- 6. Set up Row Level Security Policies for Products
create policy "Allow public read access to products" on public.products
    for select using (true);

create policy "Allow authenticated admins to manage products" on public.products
    for all to authenticated using (true) with check (true);

-- 7. Storage Bucket Setup
-- Enable RLS on storage.objects
alter table storage.objects enable row level security;

-- Create bucket 'product-images' if it does not exist
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Drop existing storage policies if they exist to allow clean re-execution
drop policy if exists "Allow public read access to product images" on storage.objects;
drop policy if exists "Allow authenticated admins to manage product images" on storage.objects;
drop policy if exists "Allow authenticated admins to upload product images" on storage.objects;
drop policy if exists "Allow authenticated admins to update product images" on storage.objects;
drop policy if exists "Allow authenticated admins to delete product images" on storage.objects;

-- Allow public read access to product-images
create policy "Allow public read access to product images" on storage.objects
    for select using (bucket_id = 'product-images');

-- Allow authenticated admins to upload/manage product-images
create policy "Allow authenticated admins to manage product images" on storage.objects
    for all to authenticated using (bucket_id = 'product-images') with check (bucket_id = 'product-images');
