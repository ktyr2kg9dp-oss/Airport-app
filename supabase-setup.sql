-- Expense Manager — Supabase setup
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
--
-- It creates the `trips` and `payments` tables and row-level security so each
-- signed-in user can only see and change their own rows. The app writes local
-- ids (text) as primary keys and millisecond timestamps as bigints.

create table if not exists public.trips (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text,
  created_at bigint,
  updated_at bigint,
  deleted    boolean not null default false
);

create table if not exists public.payments (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id     text,
  date        text,
  time        text,
  location    text,
  method      text,
  amount      double precision,
  currency    text,
  card        text,
  category    text,
  subcategory text,
  thumb       text,
  has_photo   boolean default false,
  created_at  bigint,
  updated_at  bigint,
  deleted     boolean not null default false
);

alter table public.trips    enable row level security;
alter table public.payments enable row level security;

drop policy if exists trips_owner    on public.trips;
drop policy if exists payments_owner on public.payments;

create policy trips_owner on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy payments_owner on public.payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists trips_user_updated    on public.trips(user_id, updated_at);
create index if not exists payments_user_updated on public.payments(user_id, updated_at);
