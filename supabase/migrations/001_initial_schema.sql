-- LCA Desk: Initial Schema
-- Multi-jurisdiction local content compliance platform

-- JURISDICTIONS
create table jurisdictions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  full_name text,
  regulatory_body text,
  regulatory_body_short text,
  submission_email text,
  submission_email_subject_format text,
  currency_code text default 'USD',
  local_currency_code text,
  active boolean default false,
  phase integer default 1,
  created_at timestamptz default now()
);

-- SECTOR CATEGORIES (per jurisdiction)
create table sector_categories (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid references jurisdictions(id),
  code text not null,
  name text not null,
  description text,
  min_local_content_pct numeric,
  reserved boolean default false,
  active boolean default true,
  sort_order integer,
  unique(jurisdiction_id, code)
);

-- TENANTS (client companies)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  jurisdiction_id uuid references jurisdictions(id),
  plan text default 'starter',
  plan_entity_limit integer default 1,
  active boolean default true,
  trial_ends_at timestamptz,
  created_at timestamptz default now()
);

-- USER PROFILES
create table profiles (
  id uuid primary key references auth.users(id),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TENANT MEMBERSHIPS
create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  created_at timestamptz default now(),
  unique(tenant_id, user_id)
);

-- ENTITIES
create table entities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  jurisdiction_id uuid references jurisdictions(id),
  legal_name text not null,
  trading_name text,
  registration_number text,
  lcs_certificate_id text,
  lcs_certificate_expiry date,
  petroleum_agreement_ref text,
  company_type text,
  guyanese_ownership_pct numeric,
  registered_address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CO-VENTURERS
create table entity_coventurers (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade,
  name text not null,
  ownership_pct numeric,
  is_guyanese boolean default false,
  created_at timestamptz default now()
);

-- REPORTING PERIODS
create table reporting_periods (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade,
  jurisdiction_id uuid references jurisdictions(id),
  report_type text not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  fiscal_year integer,
  status text default 'not_started',
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  secretariat_ref text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EXPENDITURE RECORDS
create table expenditure_records (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid references reporting_periods(id) on delete cascade,
  entity_id uuid references entities(id),
  sector_category_id uuid references sector_categories(id),
  supplier_name text not null,
  supplier_lcs_cert_id text,
  is_guyanese_supplier boolean default false,
  is_sole_sourced boolean default false,
  sole_source_code text,
  amount_local numeric not null,
  amount_usd numeric,
  currency_code text default 'GYD',
  payment_method text,
  contract_date date,
  payment_date date,
  description text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EMPLOYMENT RECORDS
create table employment_records (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid references reporting_periods(id) on delete cascade,
  entity_id uuid references entities(id),
  job_title text not null,
  isco_08_code text,
  position_type text not null,
  is_guyanese boolean not null,
  nationality text,
  headcount integer not null default 1,
  remuneration_band text,
  total_remuneration_local numeric,
  total_remuneration_usd numeric,
  contract_type text,
  notes text,
  created_at timestamptz default now()
);

-- CAPACITY DEVELOPMENT RECORDS
create table capacity_development_records (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid references reporting_periods(id) on delete cascade,
  entity_id uuid references entities(id),
  activity_type text not null,
  activity_name text not null,
  provider_name text,
  provider_type text,
  participant_count integer default 0,
  guyanese_participant_count integer default 0,
  start_date date,
  end_date date,
  total_hours numeric,
  cost_local numeric,
  cost_usd numeric,
  description text,
  notes text,
  created_at timestamptz default now()
);

-- AI NARRATIVE DRAFTS
create table narrative_drafts (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid references reporting_periods(id) on delete cascade,
  entity_id uuid references entities(id),
  section text not null,
  prompt_version text,
  model_used text,
  draft_content text not null,
  is_approved boolean default false,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now()
);

-- SUBMISSION LOG
create table submission_logs (
  id uuid primary key default gen_random_uuid(),
  reporting_period_id uuid references reporting_periods(id),
  entity_id uuid references entities(id),
  submitted_by uuid references profiles(id),
  submission_method text default 'email',
  submitted_to_email text,
  email_subject text,
  status text,
  notes text,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table tenants enable row level security;
alter table entities enable row level security;
alter table reporting_periods enable row level security;
alter table expenditure_records enable row level security;
alter table employment_records enable row level security;
alter table capacity_development_records enable row level security;
alter table narrative_drafts enable row level security;
alter table submission_logs enable row level security;

-- RLS POLICIES
create policy "Users can view their tenants" on tenants
  for select using (
    id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "Users can view their entities" on entities
  for select using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid())
  );

create policy "Users can insert entities" on entities
  for insert with check (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and role in ('owner', 'admin', 'member'))
  );

create policy "Users can update entities" on entities
  for update using (
    tenant_id in (select tenant_id from tenant_members where user_id = auth.uid() and role in ('owner', 'admin', 'member'))
  );

create policy "Users can view their reporting periods" on reporting_periods
  for select using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Users can manage their reporting periods" on reporting_periods
  for all using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'admin', 'member')
    )
  );

create policy "Users can view their expenditure records" on expenditure_records
  for select using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Users can manage their expenditure records" on expenditure_records
  for all using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'admin', 'member')
    )
  );

create policy "Users can view their employment records" on employment_records
  for select using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Users can manage their employment records" on employment_records
  for all using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'admin', 'member')
    )
  );

create policy "Users can view their capacity records" on capacity_development_records
  for select using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Users can manage their capacity records" on capacity_development_records
  for all using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'admin', 'member')
    )
  );

create policy "Users can view their narrative drafts" on narrative_drafts
  for select using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Users can manage their narrative drafts" on narrative_drafts
  for all using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'admin', 'member')
    )
  );

create policy "Users can view their submission logs" on submission_logs
  for select using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid()
    )
  );

create policy "Users can manage their submission logs" on submission_logs
  for all using (
    entity_id in (
      select e.id from entities e
      join tenant_members tm on e.tenant_id = tm.tenant_id
      where tm.user_id = auth.uid() and tm.role in ('owner', 'admin', 'member')
    )
  );
