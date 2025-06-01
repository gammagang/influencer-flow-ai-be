-- Migrations will appear here as you chat with AI

create table company (
  id bigint primary key generated always as identity,
  name text not null,
  owner_name text,
  website text,
  category text,
  description text,
  meta jsonb
);

create table campaign (
  id bigint primary key generated always as identity,
  company_id bigint references company (id),
  name text not null,
  description text,
  start_date date,
  end_date date,
  state text check (state in ('draft', 'active', 'completed')),
  meta jsonb
);

create table creator (
  id bigint primary key generated always as identity,
  name text not null,
  platform text,
  category text,
  age int,
  gender text,
  location text,
  tier text,
  engagement_rate numeric,
  email text,
  phone text,
  language text,
  meta jsonb
);

create table campaign_creator (
  id bigint primary key generated always as identity,
  campaign_id bigint references campaign (id),
  creator_id bigint references creator (id),
  current_state text,
  last_state_change_at timestamp with time zone,
  assigned_budget numeric,
  notes text,
  meta jsonb
);

create table contract (
  id bigint primary key generated always as identity,
  campaign_creator_id bigint references campaign_creator (id),
  pdf_url text,
  status text,
  sent_at timestamp with time zone,
  signed_by_brand_at timestamp with time zone,
  signed_by_creator_at timestamp with time zone,
  meta jsonb
);

create table contract_audit (
  id bigint primary key generated always as identity,
  contract_id bigint references contract (id),
  event_type text,
  event_at timestamp with time zone,
  actor text,
  notes text,
  meta jsonb
);


create table campaign_creator_audit (
  id bigint primary key generated always as identity,
  campaign_creator_id bigint references campaign_creator (id),
  previous_state text,
  new_state text,
  changed_at timestamp with time zone,
  changed_by text,
  notes text,
  meta jsonb
);

create table negotiation_attempt (
  id bigint primary key generated always as identity,
  campaign_creator_id bigint references campaign_creator (id),
  contract_id bigint references contract (id),
  negotiation_type text,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  outcome text,
  transcript text,
  summary text,
  deliverables text,
  agreed_price numeric,
  timeline text,
  call_recording_url text,
  meta jsonb
);


create table delivered_content (
  id bigint primary key generated always as identity,
  campaign_creator_id bigint references campaign_creator (id),
  content_type text,
  content_url text,
  caption text,
  posted_at timestamp with time zone,
  verified_at timestamp with time zone,
  meta jsonb
);

create table content_analytics (
  id bigint primary key generated always as identity,
  delivered_content_id bigint references delivered_content (id),
  likes int,
  comments int,
  shares int,
  views int,
  reach int,
  engagement_rate numeric,
  fetched_at timestamp with time zone,
  meta jsonb
);

create table payment (
  id bigint primary key generated always as identity,
  campaign_creator_id bigint references campaign_creator (id),
  contract_id bigint references contract (id),
  payment_type text,
  amount numeric,
  currency text,
  status text,
  paid_at timestamp with time zone,
  receipt_url text,
  meta jsonb
);