-- INSTALLATION BUNDLE: FRESH SUPABASE PROJECT ONLY.
-- Generated from the five migrations listed below in filename order (001-005).
-- Run ONCE in Supabase SQL Editor using a database administrator connection.
-- Existing projects with migrations 001-004: run upgrade-role-access.sql ONLY.
-- Do not run this bundle if its migrations were already applied, including via CLI.
-- The source migrations are not idempotent. Each retains its own BEGIN/COMMIT;
-- an error in a later migration may leave earlier migrations committed. Inspect
-- the database before resuming; do not blindly rerun the complete bundle.
-- The migrations alter default privileges and revoke access to the private schema.
-- This bundle contains no credentials, Auth users, business data, or bootstrap calls.
-- After installation, explicitly provision existing Auth accounts and memberships.
-- Then customize setup-admin.sql with an existing active member's email and org UUID.
-- Legacy secretary grants do not automatically become application Admin.
-- User and Executive have no enabled pages until an application Admin configures them.
-- Never run bootstrap or setup placeholders unchanged.

-- BEGIN SOURCE: migrations/202610250001_core.sql
-- SHA256: 73532a3dc5b551257b28f61b12a7637e73298ccb086eb88da88202e1fc3d88e7
-- Connected UI foundation. See database.md and supabase/README.md for phase boundaries.
-- Fresh project migration; no users, demo records, or elevated signup triggers are installed.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name_th text not null check(length(btrim(name_th))>0), timezone text not null default 'Asia/Bangkok',
  is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key default gen_random_uuid(), display_name text not null,
  disabled_at timestamptz, created_at timestamptz not null default now()
);
create table public.auth_identities (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  disabled_at timestamptz, linked_at timestamptz not null default now()
);
create table public.organization_units (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  code text not null, name_th text not null, is_active boolean not null default true,
  unique(organization_id,id), unique(organization_id,code), unique(organization_id,name_th)
);
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id), unit_id uuid not null,
  status text not null default 'active' check(status in ('active','suspended')),
  valid_from timestamptz not null default now(), valid_to timestamptz, revoked_at timestamptz,
  unique(organization_id,profile_id), unique(organization_id,id),
  foreign key(organization_id,unit_id) references public.organization_units(organization_id,id),
  check(valid_to is null or valid_to>valid_from)
);
create table public.permissions (code text primary key, description text not null);
create table public.roles (code text primary key check(code in ('secretary','owner','reviewer','executive')), label_th text not null);
create table public.role_permissions (
  role_code text not null references public.roles(code), permission_code text not null references public.permissions(code),
  primary key(role_code,permission_code)
);
create table public.access_grants (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id), role_code text not null references public.roles(code),
  scope_kind text not null default 'organization' check(scope_kind='organization'),
  valid_from timestamptz not null default now(), valid_to timestamptz, revoked_at timestamptz,
  granted_by uuid references public.profiles(id), reason text not null,
  unique(organization_id,id), check(valid_to is null or valid_to>valid_from)
);
create unique index grants_one_current_role on public.access_grants(organization_id,profile_id,role_code) where revoked_at is null and valid_to is null;
create table private.identity_authorization_guard (id smallint primary key check(id=1), epoch bigint not null default 1);
insert into private.identity_authorization_guard(id) values(1);
create table private.authorization_guards (organization_id uuid primary key references public.organizations(id), epoch bigint not null default 1);
create table private.number_sequences (
  organization_id uuid not null references public.organizations(id), namespace text not null, numbering_year integer not null,
  last_number bigint not null default 0, primary key(organization_id,namespace,numbering_year)
);
create table public.committees (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  code text not null, name_th text not null, unique(organization_id,id), unique(organization_id,code), unique(organization_id,name_th)
);
create table public.committee_terms (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  committee_id uuid not null, term_code text not null, starts_on date not null,
  unique(organization_id,id), unique(organization_id,committee_id,term_code),
  foreign key(organization_id,committee_id) references public.committees(organization_id,id)
);
create table public.meetings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  term_id uuid not null, meeting_no text not null, title text not null,
  scheduled_start timestamptz not null, location text not null default '',
  status text not null default 'scheduled' check(status in ('scheduled','completed')),
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), row_version bigint not null default 1,
  unique(organization_id,id), unique(organization_id,term_id,meeting_no),
  foreign key(organization_id,term_id) references public.committee_terms(organization_id,id)
);
create table public.agenda_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  meeting_id uuid not null, agenda_no text not null, title text not null,
  unique(organization_id,id), unique(organization_id,meeting_id,agenda_no),
  foreign key(organization_id,meeting_id) references public.meetings(organization_id,id)
);
create table public.resolutions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  code text not null, origin_agenda_id uuid not null, current_cycle_id uuid,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,code),
  foreign key(organization_id,origin_agenda_id) references public.agenda_items(organization_id,id)
);
create table public.resolution_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  resolution_id uuid not null, version_no integer not null check(version_no>0), title text not null, content text not null,
  resolution_type text not null check(resolution_type in ('action','approval','acknowledgment','recurring')),
  lead_unit_id uuid not null, coordinator_id uuid not null references public.profiles(id), due_on date,
  confirmed_by uuid not null references public.profiles(id), confirmed_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,resolution_id,id), unique(organization_id,resolution_id,version_no),
  foreign key(organization_id,resolution_id) references public.resolutions(organization_id,id),
  foreign key(organization_id,lead_unit_id) references public.organization_units(organization_id,id)
);
create table public.resolution_criteria (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  resolution_version_id uuid not null, position integer not null, description text not null check(length(btrim(description))>0),
  is_required boolean not null default true, unique(organization_id,id), unique(organization_id,resolution_version_id,position),
  foreign key(organization_id,resolution_version_id) references public.resolution_versions(organization_id,id)
);
create table public.resolution_cycles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  resolution_id uuid not null, governing_version_id uuid not null, cycle_no integer not null default 1 check(cycle_no>0),
  status text not null check(status in ('open','pending_close','closed','acknowledged','terminated')),
  opened_at timestamptz not null default now(), closed_at timestamptz, row_version bigint not null default 1,
  unique(organization_id,id), unique(organization_id,resolution_id,id), unique(organization_id,resolution_id,cycle_no),
  foreign key(organization_id,resolution_id) references public.resolutions(organization_id,id),
  foreign key(organization_id,resolution_id,governing_version_id) references public.resolution_versions(organization_id,resolution_id,id)
);
alter table public.resolutions add foreign key(organization_id,id,current_cycle_id) references public.resolution_cycles(organization_id,resolution_id,id);
create unique index resolution_one_active_cycle on public.resolution_cycles(organization_id,resolution_id) where status in ('open','pending_close');
create table public.start_authorization_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), resolution_cycle_id uuid not null,
  decision text not null check(decision in ('authorize','suspend','withdraw','resume')), reason text not null,
  actor_id uuid not null references public.profiles(id), effective_at timestamptz not null default now(), recorded_at timestamptz not null default now(),
  unique(organization_id,id), foreign key(organization_id,resolution_cycle_id) references public.resolution_cycles(organization_id,id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), code text not null,
  origin_resolution_id uuid not null, current_cycle_id uuid, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,code), foreign key(organization_id,origin_resolution_id) references public.resolutions(organization_id,id)
);
create table public.task_cycles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_id uuid not null,
  cycle_no integer not null default 1 check(cycle_no>0), status text not null check(status in ('assigned','in_progress','submitted','revision','accepted','cancelled')),
  current_spec_version_id uuid, original_deadline_version_id uuid, current_deadline_version_id uuid, accepted_submission_id uuid,
  latest_progress numeric(5,2) not null default 0 check(latest_progress between 0 and 100),
  published_at timestamptz not null default now(), started_at timestamptz, accepted_at timestamptz, cancelled_at timestamptz,
  row_version bigint not null default 1, unique(organization_id,id), unique(organization_id,task_id,id), unique(organization_id,task_id,cycle_no),
  foreign key(organization_id,task_id) references public.tasks(organization_id,id),
  check(not(accepted_at is not null and cancelled_at is not null))
);
alter table public.tasks add foreign key(organization_id,id,current_cycle_id) references public.task_cycles(organization_id,task_id,id);
create unique index task_one_active_cycle on public.task_cycles(organization_id,task_id) where status in ('assigned','in_progress','submitted','revision');
create table public.task_spec_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  version_no integer not null check(version_no>0), title text not null, description text not null, deliverable text not null,
  priority text not null check(priority in ('low','normal','high')), lead_unit_id uuid not null,
  confirmed_by uuid not null references public.profiles(id), confirmed_at timestamptz not null default now(), reason text not null,
  unique(organization_id,id), unique(organization_id,task_cycle_id,id), unique(organization_id,task_cycle_id,version_no),
  foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id),
  foreign key(organization_id,lead_unit_id) references public.organization_units(organization_id,id)
);
alter table public.task_cycles add foreign key(organization_id,id,current_spec_version_id) references public.task_spec_versions(organization_id,task_cycle_id,id);
create table public.task_criteria (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), spec_version_id uuid not null,
  position integer not null, description text not null check(length(btrim(description))>0), is_required boolean not null default true,
  unique(organization_id,id), unique(organization_id,spec_version_id,position),
  foreign key(organization_id,spec_version_id) references public.task_spec_versions(organization_id,id)
);
create table public.resolution_cycle_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  resolution_cycle_id uuid not null, task_cycle_id uuid not null, required_for_closure boolean not null default true,
  valid_from timestamptz not null default now(), valid_to timestamptz, approved_by uuid not null references public.profiles(id), reason text not null,
  unique(organization_id,id), foreign key(organization_id,resolution_cycle_id) references public.resolution_cycles(organization_id,id),
  foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id), check(valid_to is null or valid_to>valid_from)
);
create unique index one_primary_resolution_per_cycle on public.resolution_cycle_tasks(organization_id,task_cycle_id) where valid_to is null;
create table public.owner_assignments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  owner_id uuid not null references public.profiles(id), assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(), acknowledged_at timestamptz, valid_from timestamptz not null default now(), valid_to timestamptz, reason text not null,
  unique(organization_id,id), unique(organization_id,task_cycle_id,id), foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id),
  check(valid_to is null or valid_to>valid_from), check(acknowledged_at is null or acknowledged_at>=assigned_at)
);
create unique index one_current_owner on public.owner_assignments(organization_id,task_cycle_id) where valid_to is null;
create table public.reviewer_assignments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  reviewer_id uuid not null references public.profiles(id), assigned_by uuid not null references public.profiles(id),
  valid_from timestamptz not null default now(), valid_to timestamptz, reason text not null,
  unique(organization_id,id), unique(organization_id,task_cycle_id,id), foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id),
  check(valid_to is null or valid_to>valid_from)
);
create unique index one_current_reviewer on public.reviewer_assignments(organization_id,task_cycle_id) where valid_to is null;
create table public.cycle_participation_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  profile_id uuid not null references public.profiles(id), participation_kind text not null check(participation_kind in ('owner','output_contributor','administrative_support')),
  occurred_at timestamptz not null default now(), unique(organization_id,id), foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id)
);
create table public.task_deadline_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  version_no integer not null check(version_no>0), due_kind text not null default 'date' check(due_kind='date'), due_on date not null,
  timezone text not null default 'Asia/Bangkok', approved_by uuid not null references public.profiles(id),
  approved_at timestamptz not null default now(), effective_at timestamptz not null default now(), recorded_at timestamptz not null default now(), reason text not null,
  unique(organization_id,id), unique(organization_id,task_cycle_id,id), unique(organization_id,task_cycle_id,version_no),
  foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id)
);
alter table public.task_cycles add foreign key(organization_id,id,original_deadline_version_id) references public.task_deadline_versions(organization_id,task_cycle_id,id);
alter table public.task_cycles add foreign key(organization_id,id,current_deadline_version_id) references public.task_deadline_versions(organization_id,task_cycle_id,id);
create table public.task_publication_facts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  spec_version_id uuid not null, owner_assignment_id uuid not null, reviewer_assignment_id uuid not null, authorization_event_id uuid not null,
  published_at timestamptz not null default now(), completeness_passed boolean not null check(completeness_passed), validation_version text not null default 'ui-foundation-1',
  unique(organization_id,task_cycle_id),
  foreign key(organization_id,task_cycle_id,spec_version_id) references public.task_spec_versions(organization_id,task_cycle_id,id),
  foreign key(organization_id,task_cycle_id,owner_assignment_id) references public.owner_assignments(organization_id,task_cycle_id,id),
  foreign key(organization_id,task_cycle_id,reviewer_assignment_id) references public.reviewer_assignments(organization_id,task_cycle_id,id),
  foreign key(organization_id,authorization_event_id) references public.start_authorization_events(organization_id,id)
);
create table public.progress_reports (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  author_id uuid not null references public.profiles(id), first_published_at timestamptz not null default now(),
  unique(organization_id,id), foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id)
);
create table public.progress_report_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), report_id uuid not null,
  version_no integer not null default 1 check(version_no>0), progress_percent numeric(5,2) not null check(progress_percent between 0 and 100),
  work_done text not null check(length(btrim(work_done))>0), published_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,report_id,version_no), foreign key(organization_id,report_id) references public.progress_reports(organization_id,id)
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), title text not null,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(organization_id,id)
);
create table public.document_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), document_id uuid not null,
  version_no integer not null default 1 check(version_no>0), kind text not null check(kind='link'),
  source_url text not null check(source_url ~ '^https?://[^[:space:]]+$'), finalized_at timestamptz not null default now(), uploaded_by uuid not null references public.profiles(id),
  unique(organization_id,id), unique(organization_id,document_id,version_no), foreign key(organization_id,document_id) references public.documents(organization_id,id)
);
create table public.task_evidence_links (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  document_version_id uuid not null, title text not null, added_by uuid not null references public.profiles(id), added_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,task_cycle_id,document_version_id),
  foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id),
  foreign key(organization_id,document_version_id) references public.document_versions(organization_id,id)
);
create table public.submissions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  attempt_no integer not null check(attempt_no>0), spec_version_id uuid not null, owner_assignment_id uuid not null, reviewer_assignment_id uuid not null,
  submitted_by uuid not null references public.profiles(id), submitted_at timestamptz not null default now(), statement text not null,
  status text not null default 'pending' check(status in ('pending','accepted','returned','withdrawn')), decided_at timestamptz,
  unique(organization_id,id), unique(organization_id,task_cycle_id,id), unique(organization_id,task_cycle_id,attempt_no),
  foreign key(organization_id,task_cycle_id,spec_version_id) references public.task_spec_versions(organization_id,task_cycle_id,id),
  foreign key(organization_id,task_cycle_id,owner_assignment_id) references public.owner_assignments(organization_id,task_cycle_id,id),
  foreign key(organization_id,task_cycle_id,reviewer_assignment_id) references public.reviewer_assignments(organization_id,task_cycle_id,id)
);
create unique index one_pending_submission on public.submissions(organization_id,task_cycle_id) where status='pending';
alter table public.task_cycles add foreign key(organization_id,id,accepted_submission_id) references public.submissions(organization_id,task_cycle_id,id);
create table public.submission_evidence (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), submission_id uuid not null,
  document_version_id uuid not null, submitted_title text not null,
  unique(organization_id,submission_id,document_version_id), foreign key(organization_id,submission_id) references public.submissions(organization_id,id),
  foreign key(organization_id,document_version_id) references public.document_versions(organization_id,id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), submission_id uuid not null,
  reviewer_id uuid not null references public.profiles(id), reviewer_assignment_id uuid not null,
  decision text not null check(decision in ('accepted','returned')), summary text not null, reviewed_at timestamptz not null default now(),
  unique(organization_id,id), unique(organization_id,submission_id), foreign key(organization_id,submission_id) references public.submissions(organization_id,id),
  foreign key(organization_id,reviewer_assignment_id) references public.reviewer_assignments(organization_id,id)
);
create table public.review_criterion_results (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), review_id uuid not null,
  task_criterion_id uuid not null, result text not null check(result in ('passed','failed')), finding text not null,
  unique(organization_id,review_id,task_criterion_id), foreign key(organization_id,review_id) references public.reviews(organization_id,id),
  foreign key(organization_id,task_criterion_id) references public.task_criteria(organization_id,id)
);
create table public.change_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), task_cycle_id uuid not null,
  code text not null, request_type text not null check(request_type in ('deadline','owner','scope')),
  requested_by uuid not null references public.profiles(id), requested_at timestamptz not null default now(), reason text not null,
  expected_row_version bigint not null, status text not null default 'pending' check(status in ('pending','approved','rejected','stale')),
  row_version bigint not null default 1, unique(organization_id,id), unique(organization_id,code),
  foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id)
);
create unique index one_pending_change_kind on public.change_requests(organization_id,task_cycle_id,request_type) where status='pending';
create table public.deadline_change_proposals (
  request_id uuid primary key, organization_id uuid not null references public.organizations(id), previous_deadline_version_id uuid not null, proposed_due_on date not null,
  foreign key(organization_id,request_id) references public.change_requests(organization_id,id),
  foreign key(organization_id,previous_deadline_version_id) references public.task_deadline_versions(organization_id,id)
);
create table public.assignment_change_proposals (
  request_id uuid primary key, organization_id uuid not null references public.organizations(id), previous_owner_assignment_id uuid not null, proposed_profile_id uuid not null references public.profiles(id),
  foreign key(organization_id,request_id) references public.change_requests(organization_id,id),
  foreign key(organization_id,previous_owner_assignment_id) references public.owner_assignments(organization_id,id)
);
create table public.scope_change_proposals (
  request_id uuid primary key, organization_id uuid not null references public.organizations(id), previous_spec_version_id uuid not null, proposed_description text not null,
  foreign key(organization_id,request_id) references public.change_requests(organization_id,id),
  foreign key(organization_id,previous_spec_version_id) references public.task_spec_versions(organization_id,id)
);
create table public.change_decisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), request_id uuid not null,
  decision text not null check(decision in ('approved','rejected','stale')), actor_id uuid not null references public.profiles(id), reason text not null, decided_at timestamptz not null default now(),
  unique(organization_id,request_id), foreign key(organization_id,request_id) references public.change_requests(organization_id,id)
);
create table public.closure_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), resolution_cycle_id uuid not null,
  governing_version_id uuid not null, requested_by uuid not null references public.profiles(id), requested_at timestamptz not null default now(),
  unique(organization_id,id), foreign key(organization_id,resolution_cycle_id) references public.resolution_cycles(organization_id,id),
  foreign key(organization_id,governing_version_id) references public.resolution_versions(organization_id,id)
);
create table public.closure_task_snapshots (
  organization_id uuid not null references public.organizations(id), closure_request_id uuid not null, task_cycle_id uuid not null, accepted_submission_id uuid not null,
  primary key(organization_id,closure_request_id,task_cycle_id),
  foreign key(organization_id,closure_request_id) references public.closure_requests(organization_id,id),
  foreign key(organization_id,task_cycle_id,accepted_submission_id) references public.submissions(organization_id,task_cycle_id,id)
);
create table public.closure_criterion_results (
  organization_id uuid not null references public.organizations(id), closure_request_id uuid not null, resolution_criterion_id uuid not null,
  result text not null check(result='passed'), finding text not null,
  primary key(organization_id,closure_request_id,resolution_criterion_id), foreign key(organization_id,closure_request_id) references public.closure_requests(organization_id,id),
  foreign key(organization_id,resolution_criterion_id) references public.resolution_criteria(organization_id,id)
);
create table public.closure_decisions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), closure_request_id uuid not null,
  actor_id uuid not null references public.profiles(id), decision text not null check(decision='approved'), reason text not null, decided_at timestamptz not null default now(),
  unique(organization_id,closure_request_id), foreign key(organization_id,closure_request_id) references public.closure_requests(organization_id,id)
);
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), policy_key text not null,
  version_no integer not null check(version_no>0), configuration jsonb not null, published_by uuid not null references public.profiles(id), published_at timestamptz not null default now(),
  unique(organization_id,policy_key,version_no)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), recipient_id uuid not null references public.profiles(id),
  title text not null, description text not null, type text not null check(type in ('assignment','deadline','review','change','system')),
  task_cycle_id uuid, resolution_cycle_id uuid, created_at timestamptz not null default now(), read_at timestamptz,
  foreign key(organization_id,task_cycle_id) references public.task_cycles(organization_id,id),
  foreign key(organization_id,resolution_cycle_id) references public.resolution_cycles(organization_id,id)
);
create table private.audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), actor_id uuid not null references public.profiles(id),
  operation text not null, entity_id uuid, entity_type text not null, target_label text not null, detail text not null,
  before_state jsonb, after_state jsonb, recorded_at timestamptz not null default now(), request_id uuid not null
);
create table private.request_deduplications (
  organization_id uuid not null references public.organizations(id), actor_id uuid not null references public.profiles(id), operation text not null,
  idempotency_key uuid not null, request_hash text not null, response jsonb, recorded_at timestamptz not null default now(),
  primary key(organization_id,actor_id,operation,idempotency_key)
);
create index memberships_profile on public.organization_memberships(profile_id,organization_id);
create index grants_actor on public.access_grants(organization_id,profile_id,revoked_at);
create index owner_worklist on public.owner_assignments(organization_id,owner_id,task_cycle_id) where valid_to is null;
create index reviewer_worklist on public.reviewer_assignments(organization_id,reviewer_id,task_cycle_id) where valid_to is null;
create index task_parent on public.resolution_cycle_tasks(organization_id,resolution_cycle_id,task_cycle_id) where valid_to is null;
create index task_status on public.task_cycles(organization_id,status,published_at desc,id);
create index authorization_latest on public.start_authorization_events(organization_id,resolution_cycle_id,effective_at desc,recorded_at desc);
create index task_progress on public.progress_reports(organization_id,task_cycle_id,first_published_at desc);
create index inbox on public.notifications(organization_id,recipient_id,created_at desc);
create index audit_target on private.audit_events(organization_id,entity_type,entity_id,recorded_at desc);

-- Exposed tables have RLS and no direct client grants. Authorized access is through the two RPCs.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname='public' and tablename in (
    'organizations','profiles','auth_identities','organization_units','organization_memberships','permissions','roles','role_permissions','access_grants',
    'committees','committee_terms','meetings','agenda_items','resolutions','resolution_versions','resolution_criteria','resolution_cycles','start_authorization_events',
    'tasks','task_cycles','task_spec_versions','task_criteria','resolution_cycle_tasks','owner_assignments','reviewer_assignments','cycle_participation_events',
    'task_deadline_versions','task_publication_facts','progress_reports','progress_report_versions','documents','document_versions','task_evidence_links',
    'submissions','submission_evidence','reviews','review_criterion_results','change_requests','deadline_change_proposals','assignment_change_proposals','scope_change_proposals',
    'change_decisions','closure_requests','closure_task_snapshots','closure_criterion_results','closure_decisions','policy_versions','notifications')
  loop
    execute format('alter table public.%I enable row level security',t.tablename);
    execute format('revoke all on public.%I from public, anon, authenticated',t.tablename);
  end loop;
end $$;
commit;

-- END SOURCE: migrations/202610250001_core.sql

-- BEGIN SOURCE: migrations/202610250002_access.sql
-- SHA256: d84da4c6118e7ca13bb4049c64e0292c3b50de897e0b86120ada40850a3c0059
begin;
insert into public.roles(code,label_th) values ('secretary','เลขานุการ'),('owner','ผู้ปฏิบัติงาน'),('reviewer','ผู้ตรวจ'),('executive','ผู้บริหาร');
insert into public.permissions(code,description) values
 ('workspace.read_all','อ่านข้อมูลทั้งองค์กรที่ได้รับสิทธิ'),('meeting.manage','บันทึกการประชุม'),('resolution.draft','บันทึกมติ'),
 ('execution.authorize','อนุญาตเริ่มดำเนินงานตามมติ'),('task.assign','มอบหมายงาน'),('task.work','รับทราบและทำงานที่มอบหมาย'),
 ('submission.review','ตรวจผลงานที่ได้รับมอบหมาย'),('change.request','ยื่นคำขอเปลี่ยนแปลง'),
 ('deadline.approve','อนุมัติการเปลี่ยนกำหนด'),('assignment.approve','อนุมัติเปลี่ยนเจ้าของงาน'),('scope.approve','อนุมัติปรับขอบเขต'),
 ('resolution.close','รับรองปิดมติ'),('policy.manage','จัดการค่าติดตาม'),('report.export','ส่งออกรายงานข้อมูลปัจจุบันที่มีสิทธิอ่าน');
insert into public.role_permissions(role_code,permission_code) values
 ('secretary','workspace.read_all'),('secretary','meeting.manage'),('secretary','resolution.draft'),('secretary','task.assign'),('secretary','change.request'),('secretary','policy.manage'),('secretary','report.export'),
 ('owner','task.work'),('owner','change.request'),('reviewer','submission.review'),
 ('executive','workspace.read_all'),('executive','execution.authorize'),('executive','deadline.approve'),('executive','assignment.approve'),('executive','scope.approve'),('executive','resolution.close'),('executive','submission.review'),('executive','report.export');

create function private.current_profile() returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.auth_identities i join public.profiles p on p.id=i.profile_id
 where i.auth_user_id=auth.uid() and i.disabled_at is null and p.disabled_at is null
$$;
create function private.active_member(p_org uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 join public.profiles p on p.id=m.profile_id
 where m.organization_id=p_org and m.profile_id=p_profile and m.status='active' and m.revoked_at is null
 and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp()) and o.is_active and p.disabled_at is null
 and exists(select 1 from public.auth_identities ai where ai.profile_id=p.id and ai.disabled_at is null))
$$;
create function private.has_permission(p_org uuid,p_profile uuid,p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and exists(
 select 1 from public.access_grants g join public.role_permissions rp on rp.role_code=g.role_code
 where g.organization_id=p_org and g.profile_id=p_profile and g.scope_kind='organization' and g.revoked_at is null
 and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp()) and rp.permission_code=p_permission)
$$;
create function private.read_task(p_org uuid,p_cycle uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and (
 private.has_permission(p_org,p_profile,'workspace.read_all')
 or exists(select 1 from public.owner_assignments a where a.organization_id=p_org and a.task_cycle_id=p_cycle and a.owner_id=p_profile and a.valid_to is null)
 or exists(select 1 from public.reviewer_assignments a where a.organization_id=p_org and a.task_cycle_id=p_cycle and a.reviewer_id=p_profile and a.valid_to is null))
$$;
create function private.read_resolution(p_org uuid,p_cycle uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and (private.has_permission(p_org,p_profile,'workspace.read_all') or exists(
 select 1 from public.resolution_cycle_tasks l where l.organization_id=p_org and l.resolution_cycle_id=p_cycle and l.valid_to is null and private.read_task(p_org,l.task_cycle_id,p_profile)))
$$;
create function private.execution_authorized(p_org uuid,p_cycle uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select e.decision in ('authorize','resume') from public.start_authorization_events e
 where e.organization_id=p_org and e.resolution_cycle_id=p_cycle and e.effective_at<=statement_timestamp()
 order by e.effective_at desc,e.recorded_at desc,e.id desc limit 1),false)
$$;
create function private.require_permission(p_org uuid,p_profile uuid,p_permission text) returns void language plpgsql security definer set search_path='' as $$
 begin if not private.has_permission(p_org,p_profile,p_permission) then raise exception using errcode='42501',message='FORBIDDEN'; end if; end
$$;
create function private.next_code(p_org uuid,p_namespace text) returns text language plpgsql security definer set search_path='' as $$
 declare n bigint; y integer:=extract(year from statement_timestamp() at time zone 'Asia/Bangkok')::integer+543;
 begin
 insert into private.number_sequences(organization_id,namespace,numbering_year,last_number) values(p_org,p_namespace,y,1)
 on conflict(organization_id,namespace,numbering_year) do update set last_number=private.number_sequences.last_number+1 returning last_number into n;
 return (case p_namespace when 'resolution' then 'RES' when 'task' then 'TASK' else 'CR' end)||'-'||y::text||'-'||lpad(n::text,4,'0');
 end
$$;
create function private.unit_id(p_org uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid; begin
 select id into result from public.organization_units where organization_id=p_org and name_th=p_name and is_active;
 if result is null then raise exception using errcode='22023',message='INVALID_UNIT'; end if; return result;
 end
$$;
create function private.assert_version(p_expected text,p_actual bigint) returns void language plpgsql set search_path='' as $$
 begin if p_expected is null or p_expected::bigint<>p_actual then raise exception using errcode='40001',message='STALE_VERSION'; end if; end
$$;
create function private.record_audit(p_org uuid,p_actor uuid,p_operation text,p_type text,p_id uuid,p_label text,p_detail text,p_request uuid,p_before jsonb default null,p_after jsonb default null)
returns void language sql security definer set search_path='' as $$
 insert into private.audit_events(organization_id,actor_id,operation,entity_type,entity_id,target_label,detail,request_id,before_state,after_state)
 values(p_org,p_actor,p_operation,p_type,p_id,p_label,p_detail,p_request,p_before,p_after)
$$;
create function private.notify_task(p_org uuid,p_recipient uuid,p_task uuid,p_title text,p_description text,p_type text)
returns void language sql security definer set search_path='' as $$
 insert into public.notifications(organization_id,recipient_id,task_cycle_id,title,description,type)
 select p_org,p_recipient,p_task,p_title,p_description,p_type where private.active_member(p_org,p_recipient)
$$;

create function private.reject_mutation() returns trigger language plpgsql set search_path='' as $$
 begin raise exception using errcode='42501',message='IMMUTABLE_RECORD'; end
$$;
do $$ declare t text; begin
 foreach t in array array['resolution_versions','resolution_criteria','start_authorization_events','task_spec_versions','task_criteria',
 'cycle_participation_events','task_deadline_versions','task_publication_facts','progress_report_versions','document_versions',
 'task_evidence_links','submission_evidence','reviews','review_criterion_results','deadline_change_proposals','assignment_change_proposals',
 'scope_change_proposals','change_decisions','closure_requests','closure_task_snapshots','closure_criterion_results','closure_decisions','policy_versions']
 loop execute format('create trigger immutable_record before update or delete on public.%I for each row execute function private.reject_mutation()',t); end loop;
end $$;
create trigger immutable_audit before update or delete on private.audit_events for each row execute function private.reject_mutation();
create function private.guard_submission_payload() returns trigger language plpgsql set search_path='' as $$
 begin
 if to_jsonb(new)-'status'-'decided_at' is distinct from to_jsonb(old)-'status'-'decided_at' then raise exception using errcode='42501',message='IMMUTABLE_SUBMISSION'; end if;
 return new;
 end
$$;
create trigger immutable_submission_payload before update on public.submissions for each row execute function private.guard_submission_payload();
create trigger no_delete_submission before delete on public.submissions for each row execute function private.reject_mutation();

-- Auth user deletion may cascade into auth_identities outside our RPC. Serialize that path too.
create function private.lock_identity_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 perform 1 from private.identity_authorization_guard where id=1 for update;
 update private.identity_authorization_guard set epoch=epoch+1 where id=1;
 if tg_op='DELETE' then return old; else return new; end if;
 end
$$;
create trigger auth_identity_change_guard before insert or update or delete on public.auth_identities for each row execute function private.lock_identity_change();
create trigger profile_change_guard before update or delete on public.profiles for each row execute function private.lock_identity_change();

-- Provisioning is deliberately private and executable only by database administrators.
-- Creating an Auth user grants no membership or business authority.
create function private.provision_member(p_org uuid,p_auth_user uuid,p_name text,p_unit_name text,p_roles text[])
returns uuid language plpgsql security definer set search_path='' as $$
 declare person uuid; unit uuid; role_name text;
 begin
 perform 1 from private.identity_authorization_guard where id=1 for update;
 perform 1 from private.authorization_guards where organization_id=p_org for update;
 if not exists(select 1 from auth.users where id=p_auth_user) then raise exception 'AUTH_USER_NOT_FOUND'; end if;
 if p_roles is null or cardinality(p_roles)=0 or exists(select 1 from unnest(p_roles) x where x not in ('secretary','owner','reviewer','executive')) then raise exception 'INVALID_ROLE'; end if;
 unit:=private.unit_id(p_org,p_unit_name);
 select profile_id into person from public.auth_identities where auth_user_id=p_auth_user;
 if person is null then
 insert into public.profiles(display_name) values(btrim(p_name)) returning id into person;
 insert into public.auth_identities(profile_id,auth_user_id) values(person,p_auth_user);
 end if;
 insert into public.organization_memberships(organization_id,profile_id,unit_id) values(p_org,person,unit)
 on conflict(organization_id,profile_id) do update set unit_id=excluded.unit_id,status='active',revoked_at=null,valid_to=null;
 foreach role_name in array p_roles loop
 if not exists(select 1 from public.access_grants where organization_id=p_org and profile_id=person and role_code=role_name and revoked_at is null and valid_to is null) then
 insert into public.access_grants(organization_id,profile_id,role_code,reason) values(p_org,person,role_name,'Explicit database administrator provisioning');
 end if;
 end loop;
 update private.authorization_guards set epoch=epoch+1 where organization_id=p_org;
 return person;
 end
$$;
create function private.bootstrap_workspace(p_auth_user uuid,p_organization_name text,p_display_name text,p_unit_name text,p_roles text[] default array['secretary']::text[])
returns uuid language plpgsql security definer set search_path='' as $$
 declare org uuid; person uuid; committee uuid;
 begin
 if length(btrim(p_organization_name))=0 or length(btrim(p_display_name))=0 or length(btrim(p_unit_name))=0 then raise exception 'VALIDATION_FAILED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for update;
 insert into public.organizations(code,name_th) values('org-'||gen_random_uuid()::text,btrim(p_organization_name)) returning id into org;
 insert into private.authorization_guards(organization_id) values(org);
 insert into public.organization_units(organization_id,code,name_th) values(org,'main',btrim(p_unit_name));
 person:=private.provision_member(org,p_auth_user,p_display_name,p_unit_name,p_roles);
 insert into public.committees(organization_id,code,name_th) values(org,'main','คณะกรรมการประจำหน่วยงาน') returning id into committee;
 insert into public.committee_terms(organization_id,committee_id,term_code,starts_on) values(org,committee,'initial',current_date);
 insert into public.policy_versions(organization_id,policy_key,version_no,configuration,published_by) values(org,'tracking',1,
 '{"reminderDays":[7,3,1],"acknowledgmentDays":2,"reviewDays":3,"emailNotifications":false}'::jsonb,person);
 return org;
 end
$$;
create function private.disable_identity(p_auth_user uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
 declare person uuid;
 begin
 if length(btrim(p_reason))=0 then raise exception 'REASON_REQUIRED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for update;
 select profile_id into person from public.auth_identities where auth_user_id=p_auth_user;
 update public.auth_identities set disabled_at=clock_timestamp() where auth_user_id=p_auth_user;
 update public.profiles set disabled_at=clock_timestamp() where id=person;
 update private.identity_authorization_guard set epoch=epoch+1 where id=1;
 end
$$;
create function private.revoke_member(p_org uuid,p_profile uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if length(btrim(p_reason))=0 then raise exception 'REASON_REQUIRED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for share;
 perform 1 from private.authorization_guards where organization_id=p_org for update;
 update public.organization_memberships set revoked_at=clock_timestamp() where organization_id=p_org and profile_id=p_profile;
 update public.access_grants set revoked_at=clock_timestamp() where organization_id=p_org and profile_id=p_profile and revoked_at is null;
 update private.authorization_guards set epoch=epoch+1 where organization_id=p_org;
 end
$$;
revoke all on all functions in schema private from public,anon,authenticated;
commit;

-- END SOURCE: migrations/202610250002_access.sql

-- BEGIN SOURCE: migrations/202610250003_workspace_read.sql
-- SHA256: 4cc94cc0652053850a89e5e12d0442bd02a45f31ee2a1a9bb62fa4b0f4815b44
begin;
create function private.task_dto(p_org uuid,p_cycle uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object(
 'id',c.id,'stableId',t.id,'rowVersion',c.row_version,'code',t.code,'resolutionId',l.resolution_cycle_id,
 'title',s.title,'ownerId',o.owner_id,'reviewerId',v.reviewer_id,'unit',u.name_th,'priority',s.priority,'status',c.status,
 'progress',c.latest_progress,'originalDueDate',d0.due_on,'dueDate',d.due_on,'required',l.required_for_closure,
 'description',s.description,'deliverable',s.deliverable,
 'criteria',coalesce((select jsonb_agg(k.description order by k.position) from public.task_criteria k where k.organization_id=p_org and k.spec_version_id=s.id),'[]'::jsonb),
 'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.title,'size','ลิงก์อ้างอิง','kind','link','url',dv.source_url,'uploadedAt',e.added_at) order by e.added_at,e.id)
 from public.task_evidence_links e join public.document_versions dv on dv.organization_id=e.organization_id and dv.id=e.document_version_id where e.organization_id=p_org and e.task_cycle_id=c.id),'[]'::jsonb),
 'updates',coalesce((select jsonb_agg(jsonb_build_object('id',pv.id,'note',pv.work_done,'progress',pv.progress_percent,'createdAt',pv.published_at,'authorId',pr.author_id) order by pv.published_at,pv.id)
 from public.progress_reports pr join public.progress_report_versions pv on pv.organization_id=pr.organization_id and pv.report_id=pr.id where pr.organization_id=p_org and pr.task_cycle_id=c.id),'[]'::jsonb),
 'submittedAt',(select submitted_at from public.submissions sub where sub.organization_id=p_org and sub.task_cycle_id=c.id order by attempt_no desc limit 1),
 'acceptedAt',c.accepted_at,'acknowledgedAt',o.acknowledged_at))
 from public.task_cycles c join public.tasks t on t.organization_id=c.organization_id and t.id=c.task_id
 join public.task_spec_versions s on s.organization_id=c.organization_id and s.id=c.current_spec_version_id
 join public.organization_units u on u.organization_id=c.organization_id and u.id=s.lead_unit_id
 join public.resolution_cycle_tasks l on l.organization_id=c.organization_id and l.task_cycle_id=c.id and l.valid_to is null
 join public.owner_assignments o on o.organization_id=c.organization_id and o.task_cycle_id=c.id and o.valid_to is null
 join public.reviewer_assignments v on v.organization_id=c.organization_id and v.task_cycle_id=c.id and v.valid_to is null
 join public.task_deadline_versions d on d.organization_id=c.organization_id and d.id=c.current_deadline_version_id
 join public.task_deadline_versions d0 on d0.organization_id=c.organization_id and d0.id=c.original_deadline_version_id
 where c.organization_id=p_org and c.id=p_cycle
$$;

create function public.get_workspace_state(p_organization_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; org uuid; all_access boolean; result jsonb; granted_roles jsonb; permissions_json jsonb;
begin
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select m.organization_id into org from public.organization_memberships m
 where m.profile_id=actor and (p_organization_id is null or m.organization_id=p_organization_id)
 and private.active_member(m.organization_id,actor) order by m.valid_from,m.organization_id limit 1;
 if org is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select coalesce(jsonb_agg(code order by priority),'[]'::jsonb) into granted_roles from (
 select distinct g.role_code code,case g.role_code when 'secretary' then 1 when 'executive' then 2 when 'owner' then 3 else 4 end priority
 from public.access_grants g where g.organization_id=org and g.profile_id=actor and g.revoked_at is null
 and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())) gr;
 if jsonb_array_length(granted_roles)=0 then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select coalesce(jsonb_agg(code order by code),'[]'::jsonb) into permissions_json from (
 select distinct rp.permission_code code from public.access_grants g join public.role_permissions rp on rp.role_code=g.role_code
 where g.organization_id=org and g.profile_id=actor and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())) pr;
 all_access:=private.has_permission(org,actor,'workspace.read_all');
 with visible_tasks as materialized (
  select c.* from public.task_cycles c join public.tasks t on t.organization_id=c.organization_id and t.current_cycle_id=c.id
  where c.organization_id=org and private.read_task(org,c.id,actor)
 ), visible_resolutions as materialized (
  select c.*,r.code,r.origin_agenda_id,r.created_at,s.title,s.content,s.resolution_type,s.lead_unit_id,s.coordinator_id,s.due_on
  from public.resolution_cycles c join public.resolutions r on r.organization_id=c.organization_id and r.current_cycle_id=c.id
  join public.resolution_versions s on s.organization_id=c.organization_id and s.id=c.governing_version_id
  where c.organization_id=org and private.read_resolution(org,c.id,actor)
 ), visible_people as (
  select actor id union select o.owner_id from public.owner_assignments o join visible_tasks t on t.id=o.task_cycle_id where o.organization_id=org and o.valid_to is null
  union select r.reviewer_id from public.reviewer_assignments r join visible_tasks t on t.id=r.task_cycle_id where r.organization_id=org and r.valid_to is null
  union select coordinator_id from visible_resolutions
 ), visible_meetings as (
  select m.* from public.meetings m where m.organization_id=org and (all_access or exists(select 1 from visible_resolutions r join public.agenda_items a on a.organization_id=org and a.id=r.origin_agenda_id where a.meeting_id=m.id))
 )
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name_th) from public.organizations where id=org),
 'roles',granted_roles,'permissions',permissions_json,
 'units',coalesce((select jsonb_agg(name_th order by name_th) from public.organization_units where organization_id=org and is_active),'[]'::jsonb),
 'eligibleOwners',case when private.has_permission(org,actor,'change.request') or private.has_permission(org,actor,'task.assign') then
  coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'unit',u.name_th) order by p.display_name,p.id)
   from public.organization_memberships m join public.profiles p on p.id=m.profile_id
   join public.organization_units u on u.organization_id=org and u.id=m.unit_id
   where m.organization_id=org and private.has_permission(org,p.id,'task.work')),'[]'::jsonb)
  else '[]'::jsonb end,
 'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'initials',left(p.display_name,2),'unit',u.name_th,'avatarColor','#5f7161',
 'role',coalesce((select g.role_code from public.access_grants g where g.organization_id=org and g.profile_id=p.id and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())
 order by case g.role_code when 'owner' then 1 when 'reviewer' then 2 when 'secretary' then 3 else 4 end limit 1),'owner'),
 'roles',coalesce((select jsonb_agg(distinct g.role_code) from public.access_grants g where g.organization_id=org and g.profile_id=p.id and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())),'[]'::jsonb)) order by p.display_name,p.id)
 from public.organization_memberships m join public.profiles p on p.id=m.profile_id join public.organization_units u on u.organization_id=org and u.id=m.unit_id
 where m.organization_id=org and private.active_member(org,p.id) and (all_access or p.id in(select id from visible_people))),'[]'::jsonb),
 'state',jsonb_build_object('activeRole',granted_roles->>0,'currentUserId',actor,
 'tasks',coalesce((select jsonb_agg(private.task_dto(org,id) order by published_at desc,id) from visible_tasks),'[]'::jsonb),
 'resolutions',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',r.id,'stableId',r.resolution_id,'rowVersion',r.row_version,'code',r.code,'title',r.title,
  'content',case when all_access then r.content else 'ข้อมูลมติส่วนที่เกี่ยวข้องกับงานที่คุณได้รับมอบหมาย' end,
  'meetingId',a.meeting_id,'agenda',a.agenda_no,'type',r.resolution_type,'unit',u.name_th,'coordinatorId',r.coordinator_id,
  'status',r.status,'createdAt',r.created_at,'dueDate',r.due_on,
  'executionAuthorized',private.execution_authorized(org,r.id),'partialContext',not all_access,
  'closureCriteria',case when all_access then coalesce((select jsonb_agg(k.description order by k.position) from public.resolution_criteria k where k.organization_id=org and k.resolution_version_id=r.governing_version_id),'[]'::jsonb) else '[]'::jsonb end)) order by r.created_at desc,r.id)
  from visible_resolutions r join public.agenda_items a on a.organization_id=org and a.id=r.origin_agenda_id join public.organization_units u on u.organization_id=org and u.id=r.lead_unit_id),'[]'::jsonb),
 'meetings',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'number',m.meeting_no,'date',to_char(m.scheduled_start at time zone 'Asia/Bangkok','YYYY-MM-DD'),
  'time',to_char(m.scheduled_start at time zone 'Asia/Bangkok','HH24:MI'),'location',m.location,'status',m.status,'committee',cm.name_th,
  'agenda',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'number',a.agenda_no,'title',a.title,
  'resolutionIds',coalesce((select jsonb_agg(r.id order by r.id) from visible_resolutions r where r.origin_agenda_id=a.id),'[]'::jsonb)) order by a.agenda_no)
  from public.agenda_items a where a.organization_id=org and a.meeting_id=m.id and (all_access or exists(select 1 from visible_resolutions r where r.origin_agenda_id=a.id))),'[]'::jsonb)) order by m.scheduled_start desc,m.id)
  from visible_meetings m join public.committee_terms ct on ct.organization_id=org and ct.id=m.term_id join public.committees cm on cm.organization_id=org and cm.id=ct.committee_id),'[]'::jsonb),
 'changes',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',c.id,'rowVersion',c.row_version,'code',c.code,'taskId',c.task_cycle_id,
 'type',c.request_type,'status',c.status,'requestedById',c.requested_by,'reason',c.reason,'createdAt',c.requested_at,
 'originalValue',case c.request_type when 'deadline' then (select due_on::text from public.task_deadline_versions where organization_id=org and id=dp.previous_deadline_version_id) when 'owner' then (select owner_id::text from public.owner_assignments where organization_id=org and id=ap.previous_owner_assignment_id) else (select description from public.task_spec_versions where organization_id=org and id=sp.previous_spec_version_id) end,
 'proposedValue',case c.request_type when 'deadline' then dp.proposed_due_on::text when 'owner' then ap.proposed_profile_id::text else sp.proposed_description end,
 'decidedAt',cd.decided_at,'decidedById',cd.actor_id,'decisionReason',cd.reason)) order by c.requested_at desc,c.id)
 from public.change_requests c join visible_tasks t on t.id=c.task_cycle_id
 left join public.deadline_change_proposals dp on dp.organization_id=org and dp.request_id=c.id
 left join public.assignment_change_proposals ap on ap.organization_id=org and ap.request_id=c.id
 left join public.scope_change_proposals sp on sp.organization_id=org and sp.request_id=c.id
 left join public.change_decisions cd on cd.organization_id=org and cd.request_id=c.id where c.organization_id=org),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',n.id,'title',n.title,'description',n.description,'createdAt',n.created_at,'read',n.read_at is not null,'type',n.type,
 'href',case when n.task_cycle_id is not null then '/tasks/'||n.task_cycle_id::text when n.resolution_cycle_id is not null then '/resolutions/'||n.resolution_cycle_id::text else '/' end,
 'targetId',coalesce(n.task_cycle_id,n.resolution_cycle_id))) order by n.created_at desc,n.id) from public.notifications n
 where n.organization_id=org and n.recipient_id=actor and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor))),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.operation,'actorId',a.actor_id,'createdAt',a.recorded_at,'targetId',coalesce(a.entity_id::text,'settings'),'targetLabel',a.target_label,'detail',a.detail) order by a.recorded_at desc,a.id)
 from (select * from private.audit_events e where e.organization_id=org and (all_access or (e.entity_type='task' and private.read_task(org,e.entity_id,actor))) order by e.recorded_at desc,e.id limit 500) a),'[]'::jsonb),
 'settings',coalesce((select configuration from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1),'{"reminderDays":[7,3,1],"acknowledgmentDays":2,"reviewDays":3,"emailNotifications":false}'::jsonb)
 )) into result;
 return result;
end $$;
revoke all on function public.get_workspace_state(uuid) from public,anon,authenticated;
grant execute on function public.get_workspace_state(uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;

-- END SOURCE: migrations/202610250003_workspace_read.sql

-- BEGIN SOURCE: migrations/202610250004_commands.sql
-- SHA256: 984c15ee5514317191d97d28158eb286b2ec7218cb6294c00e78a935433bd2f0
begin;
create function public.workspace_command(p_organization_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid; org uuid:=p_organization_id; permission_needed text; target uuid; parent uuid; result jsonb; prior jsonb;
 t public.task_cycles%rowtype; r public.resolution_cycles%rowtype; cr public.change_requests%rowtype;
 spec public.task_spec_versions%rowtype; own public.owner_assignments%rowtype; reviewer public.reviewer_assignments%rowtype;
 sub public.submissions%rowtype; prev_deadline public.task_deadline_versions%rowtype;
 new_id uuid; new_version uuid; new_task uuid; new_owner uuid; new_reviewer uuid; unit uuid; agenda uuid; term uuid; committee uuid;
 auth_event uuid; link_id uuid; decision_id uuid; original_version uuid; requested_version bigint;
 ordinal integer; item text; note text; new_description text; code text; new_status text; due date; flag boolean; config jsonb;
 before_json jsonb; hash text; old_hash text;
begin
 if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
  raise exception using errcode='22023',message='VALIDATION_FAILED';
 end if;
 -- Shared locks are held through commit. Authorization is read in a separate statement after locks.
 perform 1 from private.identity_authorization_guard where id=1 for share;
 perform 1 from private.authorization_guards where organization_id=org for share;
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 if not private.active_member(org,actor) then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 permission_needed:=case p_operation
 when 'add_meeting' then 'meeting.manage' when 'add_resolution' then 'resolution.draft'
 when 'authorize_resolution' then 'execution.authorize' when 'add_task' then 'task.assign'
 when 'acknowledge_task' then 'task.work' when 'update_progress' then 'task.work' when 'add_evidence' then 'task.work'
 when 'transition_task' then case when p_payload->>'status' in ('accepted','revision') then 'submission.review' else 'task.work' end
 when 'create_change_request' then 'change.request' when 'decide_change' then '__change__'
 when 'close_resolution' then 'resolution.close' when 'update_settings' then 'policy.manage'
 when 'mark_notification_read' then '' when 'mark_all_read' then '' else null end;
 if permission_needed is null then raise exception using errcode='22023',message='UNKNOWN_OPERATION'; end if;
 if permission_needed='__change__' then
  select case request_type when 'deadline' then 'deadline.approve' when 'owner' then 'assignment.approve' else 'scope.approve' end
   into permission_needed from public.change_requests where organization_id=org and id=(p_payload->>'id')::uuid;
  if permission_needed is null then raise exception using errcode='22023',message='NOT_FOUND'; end if;
 end if;
 if permission_needed<>'' then perform private.require_permission(org,actor,permission_needed); end if;
 hash:=md5(p_payload::text);
 insert into private.request_deduplications(organization_id,actor_id,operation,idempotency_key,request_hash)
 values(org,actor,p_operation,p_idempotency_key,hash) on conflict do nothing;
 select request_hash,response into old_hash,prior from private.request_deduplications
 where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key for update;
 if old_hash<>hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
 if prior is not null then return prior; end if;
 target:=nullif(p_payload->>'id','')::uuid;
 note:=btrim(coalesce(p_payload->>'note',p_payload->>'reason',''));

 if p_operation='add_meeting' then
  if length(btrim(coalesce(p_payload->>'title','')))=0 or length(btrim(coalesce(p_payload->>'number','')))=0
   or coalesce(p_payload->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(p_payload->>'time','09:00')!~'^\d{2}:\d{2}$' then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  select c.id into committee from public.committees c where c.organization_id=org and c.name_th=p_payload->>'committee';
  if length(btrim(coalesce(p_payload->>'committee','')))=0 then raise exception using errcode='22023',message='INVALID_COMMITTEE'; end if;
  if committee is null then
   insert into public.committees(organization_id,code,name_th) values(org,'committee-'||gen_random_uuid()::text,btrim(p_payload->>'committee'))
    on conflict(organization_id,name_th) do update set name_th=excluded.name_th returning id into committee;
   insert into public.committee_terms(organization_id,committee_id,term_code,starts_on) values(org,committee,'initial',current_date) on conflict do nothing;
  end if;
  select ct.id into term from public.committee_terms ct where ct.organization_id=org and ct.committee_id=committee order by starts_on desc,id limit 1;
  insert into public.meetings(organization_id,term_id,meeting_no,title,scheduled_start,location,status,created_by)
  values(org,term,btrim(p_payload->>'number'),btrim(p_payload->>'title'),((p_payload->>'date')||' '||coalesce(p_payload->>'time','09:00'))::timestamp at time zone 'Asia/Bangkok',coalesce(p_payload->>'location',''),coalesce(p_payload->>'status','scheduled'),actor)
  returning id into target;
  if jsonb_typeof(p_payload->'agenda')='array' then
   for config in select value from jsonb_array_elements(p_payload->'agenda') loop
    if length(btrim(coalesce(config->>'number','')))>0 and length(btrim(coalesce(config->>'title','')))>0 then
     insert into public.agenda_items(organization_id,meeting_id,agenda_no,title) values(org,target,btrim(config->>'number'),btrim(config->>'title'));
    end if;
   end loop;
  end if;
  perform private.record_audit(org,actor,'เพิ่มการประชุม','meeting',target,p_payload->>'title',p_payload->>'date',p_idempotency_key);

 elsif p_operation='add_resolution' then
  if length(btrim(coalesce(p_payload->>'title','')))=0 or length(btrim(coalesce(p_payload->>'content','')))=0
    or coalesce(p_payload->>'type','') not in ('action','approval','acknowledgment','recurring') then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  perform 1 from public.meetings where organization_id=org and id=(p_payload->>'meetingId')::uuid for update;
  if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
  if length(btrim(coalesce(p_payload->>'agenda','')))=0 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  unit:=private.unit_id(org,p_payload->>'unit');
  if not private.active_member(org,(p_payload->>'coordinatorId')::uuid) then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
  if p_payload->>'type'<>'acknowledgment' and (jsonb_typeof(p_payload->'closureCriteria') is distinct from 'array' or jsonb_array_length(p_payload->'closureCriteria')=0) then raise exception using errcode='22023',message='MISSING_CRITERIA'; end if;
  select id into agenda from public.agenda_items where organization_id=org and meeting_id=(p_payload->>'meetingId')::uuid and agenda_no=p_payload->>'agenda';
  if agenda is null then
   insert into public.agenda_items(organization_id,meeting_id,agenda_no,title) values(org,(p_payload->>'meetingId')::uuid,p_payload->>'agenda',p_payload->>'title') returning id into agenda;
  end if;
  code:=private.next_code(org,'resolution');
  insert into public.resolutions(organization_id,code,origin_agenda_id,created_by) values(org,code,agenda,actor) returning id into new_id;
  insert into public.resolution_versions(organization_id,resolution_id,version_no,title,content,resolution_type,lead_unit_id,coordinator_id,due_on,confirmed_by)
  values(org,new_id,1,btrim(p_payload->>'title'),btrim(p_payload->>'content'),p_payload->>'type',unit,(p_payload->>'coordinatorId')::uuid,nullif(p_payload->>'dueDate','')::date,actor) returning id into new_version;
  ordinal:=0;
  for item in select jsonb_array_elements_text(coalesce(p_payload->'closureCriteria','[]'::jsonb)) loop
   ordinal:=ordinal+1; insert into public.resolution_criteria(organization_id,resolution_version_id,position,description) values(org,new_version,ordinal,btrim(item));
  end loop;
  insert into public.resolution_cycles(organization_id,resolution_id,governing_version_id,status)
  values(org,new_id,new_version,case when p_payload->>'type'='acknowledgment' then 'acknowledged' else 'open' end) returning id into target;
  update public.resolutions set current_cycle_id=target where organization_id=org and id=new_id;
  perform private.record_audit(org,actor,'บันทึกมติ','resolution',target,p_payload->>'title','บันทึกทะเบียน ยังต้องอนุญาตเริ่มแยกต่างหาก',p_idempotency_key);

 elsif p_operation in ('authorize_resolution','close_resolution') then
  select * into r from public.resolution_cycles where organization_id=org and id=target for update;
  if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
  perform private.assert_version(p_payload->>'expectedVersion',r.row_version);
  if r.status not in ('open','pending_close') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
  if p_operation='authorize_resolution' then
   if length(note)=0 then raise exception using errcode='22023',message='REASON_REQUIRED'; end if;
   if private.execution_authorized(org,target) then raise exception using errcode='22023',message='ALREADY_AUTHORIZED'; end if;
   insert into public.start_authorization_events(organization_id,resolution_cycle_id,decision,reason,actor_id) values(org,target,'authorize',note,actor);
   update public.resolution_cycles set row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'อนุญาตเริ่มดำเนินงาน','resolution',target,'การอนุญาตเริ่ม',note,p_idempotency_key);
  else
   if coalesce((p_payload->>'criteriaConfirmed')::boolean,false) is not true then raise exception using errcode='22023',message='MISSING_CRITERIA'; end if;
   if not private.execution_authorized(org,target) then raise exception using errcode='42501',message='AUTHORIZATION_REQUIRED'; end if;
   if (select resolution_type from public.resolution_versions where organization_id=org and id=r.governing_version_id) not in ('action','approval') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   perform c.id from public.task_cycles c join public.resolution_cycle_tasks l on l.organization_id=org and l.task_cycle_id=c.id and l.valid_to is null
    where c.organization_id=org and l.resolution_cycle_id=target order by c.id for update of c;
   -- This first slice has no continuation/transfer disposition UI: all linked tasks must be accepted.
   if not exists(select 1 from public.resolution_cycle_tasks where organization_id=org and resolution_cycle_id=target and required_for_closure and valid_to is null)
    or exists(select 1 from public.resolution_cycle_tasks l join public.task_cycles c on c.organization_id=org and c.id=l.task_cycle_id where l.organization_id=org and l.resolution_cycle_id=target and l.valid_to is null and c.status<>'accepted')
    or not exists(select 1 from public.resolution_criteria where organization_id=org and resolution_version_id=r.governing_version_id)
    or exists(select 1 from public.change_requests c join public.resolution_cycle_tasks l on l.organization_id=org and l.task_cycle_id=c.task_cycle_id where c.organization_id=org and l.resolution_cycle_id=target and l.valid_to is null and c.status='pending') then
    raise exception using errcode='22023',message='CLOSURE_NOT_READY'; end if;
   insert into public.closure_requests(organization_id,resolution_cycle_id,governing_version_id,requested_by) values(org,target,r.governing_version_id,actor) returning id into new_id;
   insert into public.closure_task_snapshots(organization_id,closure_request_id,task_cycle_id,accepted_submission_id)
    select org,new_id,c.id,c.accepted_submission_id from public.resolution_cycle_tasks l join public.task_cycles c on c.organization_id=org and c.id=l.task_cycle_id where l.organization_id=org and l.resolution_cycle_id=target and l.valid_to is null;
   insert into public.closure_criterion_results(organization_id,closure_request_id,resolution_criterion_id,result,finding)
    select org,new_id,id,'passed',coalesce(nullif(note,''),'ผู้มีอำนาจยืนยันเกณฑ์ระดับมติครบ') from public.resolution_criteria where organization_id=org and resolution_version_id=r.governing_version_id;
   insert into public.closure_decisions(organization_id,closure_request_id,actor_id,decision,reason) values(org,new_id,actor,'approved',coalesce(nullif(note,''),'ยืนยันเกณฑ์และตรวจรับทุกงานที่ผูกกับรอบมติ'));
   update public.resolution_cycles set status='closed',closed_at=clock_timestamp(),row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'รับรองปิดมติ','resolution',target,'ปิดมติ',coalesce(nullif(note,''),'เกณฑ์ครบและทุกงานผ่านตรวจ'),p_idempotency_key);
  end if;

 elsif p_operation='add_task' then
  parent:=(p_payload->>'resolutionId')::uuid;
  select * into r from public.resolution_cycles where organization_id=org and id=parent for update;
  if not found or r.status not in ('open','pending_close') then raise exception using errcode='22023',message='INVALID_RESOLUTION'; end if;
  if not private.execution_authorized(org,parent) then raise exception using errcode='42501',message='AUTHORIZATION_REQUIRED'; end if;
  if length(btrim(coalesce(p_payload->>'title','')))=0 or length(btrim(coalesce(p_payload->>'description','')))=0
   or length(btrim(coalesce(p_payload->>'deliverable','')))=0 or jsonb_typeof(p_payload->'criteria') is distinct from 'array'
   or jsonb_array_length(p_payload->'criteria')=0 or coalesce(p_payload->>'dueDate','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  new_owner:=(p_payload->>'ownerId')::uuid; new_reviewer:=(p_payload->>'reviewerId')::uuid;
  if new_owner=new_reviewer or not private.has_permission(org,new_owner,'task.work') or not private.has_permission(org,new_reviewer,'submission.review') then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
  unit:=private.unit_id(org,p_payload->>'unit'); due:=(p_payload->>'dueDate')::date; code:=private.next_code(org,'task');
  insert into public.tasks(organization_id,code,origin_resolution_id,created_by) values(org,code,r.resolution_id,actor) returning id into new_task;
  insert into public.task_cycles(organization_id,task_id,status) values(org,new_task,'assigned') returning id into target;
  insert into public.task_spec_versions(organization_id,task_cycle_id,version_no,title,description,deliverable,priority,lead_unit_id,confirmed_by,reason)
   values(org,target,1,btrim(p_payload->>'title'),btrim(p_payload->>'description'),btrim(p_payload->>'deliverable'),coalesce(p_payload->>'priority','normal'),unit,actor,'เผยแพร่งานครั้งแรก') returning id into new_version;
  ordinal:=0;
  for item in select jsonb_array_elements_text(p_payload->'criteria') loop ordinal:=ordinal+1;
   insert into public.task_criteria(organization_id,spec_version_id,position,description) values(org,new_version,ordinal,btrim(item)); end loop;
  update public.task_cycles set current_spec_version_id=new_version where organization_id=org and id=target;
  insert into public.task_deadline_versions(organization_id,task_cycle_id,version_no,due_on,approved_by,reason) values(org,target,1,due,actor,'กำหนดแรกที่เผยแพร่') returning id into new_id;
  update public.task_cycles set original_deadline_version_id=new_id,current_deadline_version_id=new_id where organization_id=org and id=target;
  insert into public.owner_assignments(organization_id,task_cycle_id,owner_id,assigned_by,reason) values(org,target,new_owner,actor,'มอบหมายครั้งแรก') returning id into own.id;
  insert into public.reviewer_assignments(organization_id,task_cycle_id,reviewer_id,assigned_by,reason) values(org,target,new_reviewer,actor,'มอบหมายผู้ตรวจครั้งแรก') returning id into reviewer.id;
  insert into public.cycle_participation_events(organization_id,task_cycle_id,profile_id,participation_kind) values(org,target,new_owner,'owner');
  insert into public.resolution_cycle_tasks(organization_id,resolution_cycle_id,task_cycle_id,required_for_closure,approved_by,reason)
   values(org,parent,target,coalesce((p_payload->>'required')::boolean,true),actor,'กำหนดขอบเขตเมื่อเผยแพร่');
  select id into auth_event from public.start_authorization_events where organization_id=org and resolution_cycle_id=parent order by effective_at desc,recorded_at desc,id desc limit 1;
  insert into public.task_publication_facts(organization_id,task_cycle_id,spec_version_id,owner_assignment_id,reviewer_assignment_id,authorization_event_id,completeness_passed)
   values(org,target,new_version,own.id,reviewer.id,auth_event,true);
  update public.tasks set current_cycle_id=target where organization_id=org and id=new_task;
  update public.resolution_cycles set status='open',row_version=row_version+1 where organization_id=org and id=parent;
  perform private.notify_task(org,new_owner,target,'ได้รับมอบหมายงานใหม่',p_payload->>'title','assignment');
  perform private.record_audit(org,actor,'มอบหมายงาน','task',target,p_payload->>'title',p_payload->>'deliverable',p_idempotency_key);

 elsif p_operation in ('acknowledge_task','transition_task','update_progress','add_evidence','create_change_request','decide_change') then
  if p_operation='create_change_request' then target:=(p_payload->>'taskId')::uuid;
  elsif p_operation='decide_change' then
   select * into cr from public.change_requests where organization_id=org and id=target;
   if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
   target:=cr.task_cycle_id;
  end if;
  -- Parent first, then task, then subordinate records: all writers follow the same lock order.
  select resolution_cycle_id into parent from public.resolution_cycle_tasks where organization_id=org and task_cycle_id=target and valid_to is null;
  if parent is null or not private.read_task(org,target,actor) then raise exception using errcode='42501',message='NOT_FOUND'; end if;
  select * into r from public.resolution_cycles where organization_id=org and id=parent for update;
  select * into t from public.task_cycles where organization_id=org and id=target for update;
  if p_operation='decide_change' then
   select * into cr from public.change_requests where organization_id=org and id=cr.id for update;
   perform private.assert_version(p_payload->>'expectedVersion',cr.row_version);
  else perform private.assert_version(p_payload->>'expectedVersion',t.row_version); end if;
  select * into spec from public.task_spec_versions where organization_id=org and id=t.current_spec_version_id;
  select * into own from public.owner_assignments where organization_id=org and task_cycle_id=target and valid_to is null;
  select * into reviewer from public.reviewer_assignments where organization_id=org and task_cycle_id=target and valid_to is null;
  select * into prev_deadline from public.task_deadline_versions where organization_id=org and id=t.current_deadline_version_id;
  before_json:=private.task_dto(org,target);

  if p_operation='acknowledge_task' then
   if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status in ('accepted','cancelled') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   if own.acknowledged_at is null then
    update public.owner_assignments set acknowledged_at=clock_timestamp() where organization_id=org and id=own.id;
    update public.task_cycles set row_version=row_version+1 where organization_id=org and id=target;
   end if;
   perform private.record_audit(org,actor,'รับทราบงาน','task',target,spec.title,'รับทราบการมอบหมาย โดยยังไม่ถือว่าเริ่มดำเนินการ',p_idempotency_key,before_json,private.task_dto(org,target));

  elsif p_operation='update_progress' then
   if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status not in ('in_progress','revision') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   if length(note)=0 or p_payload->>'progress' is null or (p_payload->>'progress')::numeric not between 0 and 100 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
   insert into public.progress_reports(organization_id,task_cycle_id,author_id) values(org,target,actor) returning id into new_id;
   insert into public.progress_report_versions(organization_id,report_id,progress_percent,work_done) values(org,new_id,(p_payload->>'progress')::numeric,note);
   update public.task_cycles set latest_progress=(p_payload->>'progress')::numeric,row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'รายงานความก้าวหน้า','task',target,spec.title,note,p_idempotency_key,before_json,private.task_dto(org,target));

  elsif p_operation='add_evidence' then
   if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status not in ('assigned','in_progress','revision') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   config:=p_payload->'evidence';
   if config->>'kind' is distinct from 'link' then raise exception using errcode='0A000',message='FILE_UPLOAD_NOT_AVAILABLE'; end if;
   if length(btrim(coalesce(config->>'name','')))=0 or length(coalesce(config->>'url',''))>2048 or coalesce(config->>'url','')!~'^https?://[^[:space:]]+$' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
   insert into public.documents(organization_id,title,created_by) values(org,btrim(config->>'name'),actor) returning id into new_id;
   insert into public.document_versions(organization_id,document_id,kind,source_url,uploaded_by) values(org,new_id,'link',config->>'url',actor) returning id into new_version;
   insert into public.task_evidence_links(organization_id,task_cycle_id,document_version_id,title,added_by) values(org,target,new_version,btrim(config->>'name'),actor);
   update public.task_cycles set row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'เพิ่มหลักฐานลิงก์','task',target,spec.title,config->>'name',p_idempotency_key);

  elsif p_operation='transition_task' then
   new_status:=p_payload->>'status';
   if r.status not in ('open','pending_close') or not private.execution_authorized(org,parent) then raise exception using errcode='42501',message='AUTHORIZATION_REQUIRED'; end if;
   if new_status='in_progress' then
    if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if t.status<>'assigned' or own.acknowledged_at is null then raise exception using errcode='22023',message='ACKNOWLEDGMENT_REQUIRED'; end if;
    update public.task_cycles set status='in_progress',started_at=coalesce(started_at,clock_timestamp()),row_version=row_version+1 where organization_id=org and id=target;
   elsif new_status='submitted' then
    if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if t.status not in ('in_progress','revision') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    if not exists(select 1 from public.task_evidence_links where organization_id=org and task_cycle_id=target) then raise exception using errcode='22023',message='MISSING_EVIDENCE'; end if;
    if not private.has_permission(org,reviewer.reviewer_id,'submission.review') then raise exception using errcode='22023',message='INVALID_REVIEWER'; end if;
    select coalesce(max(attempt_no),0)+1 into ordinal from public.submissions where organization_id=org and task_cycle_id=target;
    insert into public.submissions(organization_id,task_cycle_id,attempt_no,spec_version_id,owner_assignment_id,reviewer_assignment_id,submitted_by,statement)
     values(org,target,ordinal,t.current_spec_version_id,own.id,reviewer.id,actor,coalesce(nullif(note,''),'ยืนยันส่งผลงานตามเกณฑ์ที่กำหนด')) returning id into new_id;
    insert into public.submission_evidence(organization_id,submission_id,document_version_id,submitted_title)
     select org,new_id,e.document_version_id,e.title from public.task_evidence_links e where e.organization_id=org and e.task_cycle_id=target;
    update public.task_cycles set status='submitted',row_version=row_version+1 where organization_id=org and id=target;
    perform private.notify_task(org,reviewer.reviewer_id,target,'มีผลงานส่งตรวจใหม่',spec.title,'review');
   elsif new_status in ('accepted','revision') then
    if reviewer.reviewer_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if t.status<>'submitted' then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    if exists(select 1 from public.cycle_participation_events where organization_id=org and task_cycle_id=target and profile_id=actor and participation_kind in ('owner','output_contributor')) then raise exception using errcode='42501',message='SELF_REVIEW_NOT_ALLOWED'; end if;
    if new_status='revision' and length(note)=0 then raise exception using errcode='22023',message='REASON_REQUIRED'; end if;
    select * into sub from public.submissions where organization_id=org and task_cycle_id=target and status='pending' for update;
    if not found then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    if jsonb_typeof(p_payload->'criterionResults') is distinct from 'array'
     or jsonb_array_length(p_payload->'criterionResults')<>(select count(*) from public.task_criteria where organization_id=org and spec_version_id=sub.spec_version_id)
     or exists(select 1 from jsonb_array_elements(p_payload->'criterionResults') value where jsonb_typeof(value)<>'boolean') then
     raise exception using errcode='22023',message='INVALID_CRITERION_RESULTS'; end if;
    if new_status='accepted' and exists(select 1 from jsonb_array_elements(p_payload->'criterionResults') value where value<>'true'::jsonb) then
     raise exception using errcode='22023',message='MISSING_CRITERIA'; end if;
    insert into public.reviews(organization_id,submission_id,reviewer_id,reviewer_assignment_id,decision,summary)
     values(org,sub.id,actor,reviewer.id,case when new_status='accepted' then 'accepted' else 'returned' end,coalesce(nullif(note,''),'ผู้ตรวจยืนยันทุกเกณฑ์ของชุดส่งผ่าน')) returning id into decision_id;
    insert into public.review_criterion_results(organization_id,review_id,task_criterion_id,result,finding)
     select org,decision_id,id,case when (p_payload->'criterionResults'->>(position-1))::boolean then 'passed' else 'failed' end,coalesce(nullif(note,''),'ผ่านเกณฑ์') from public.task_criteria where organization_id=org and spec_version_id=sub.spec_version_id;
    update public.submissions set status=case when new_status='accepted' then 'accepted' else 'returned' end,decided_at=clock_timestamp() where organization_id=org and id=sub.id;
    update public.task_cycles set status=new_status,accepted_submission_id=case when new_status='accepted' then sub.id else null end,
     accepted_at=case when new_status='accepted' then clock_timestamp() else null end,row_version=row_version+1 where organization_id=org and id=target;
    perform private.notify_task(org,own.owner_id,target,case when new_status='accepted' then 'ผลงานผ่านการตรวจรับ' else 'มีงานส่งกลับแก้ไข' end,spec.title,'review');
   else raise exception using errcode='0A000',message='TRANSITION_NOT_AVAILABLE'; end if;
   if new_status in ('accepted','revision') then
    insert into public.progress_reports(organization_id,task_cycle_id,author_id) values(org,target,actor) returning id into new_id;
    insert into public.progress_report_versions(organization_id,report_id,progress_percent,work_done) values(org,new_id,t.latest_progress,
     case when new_status='accepted' then 'ผลตรวจ: ผ่าน — ' else 'ผลตรวจ: ส่งกลับแก้ไข — ' end||coalesce(nullif(note,''),'ยืนยันผ่านทุกเกณฑ์'));
   end if;
   if new_status='accepted' and exists(select 1 from public.resolution_cycle_tasks where organization_id=org and resolution_cycle_id=parent and required_for_closure and valid_to is null)
    and not exists(select 1 from public.resolution_cycle_tasks l join public.task_cycles tc on tc.organization_id=org and tc.id=l.task_cycle_id where l.organization_id=org and l.resolution_cycle_id=parent and l.valid_to is null and l.required_for_closure and tc.status<>'accepted') then
    update public.resolution_cycles set status='pending_close',row_version=row_version+1 where organization_id=org and id=parent;
   end if;
   perform private.record_audit(org,actor,case new_status when 'in_progress' then 'เริ่มดำเนินงาน' when 'submitted' then 'ส่งผลงานตรวจ' when 'accepted' then 'ตรวจรับผลงาน' else 'ส่งกลับแก้ไข' end,
    'task',target,spec.title,note,p_idempotency_key,before_json,private.task_dto(org,target));

  elsif p_operation='create_change_request' then
   if not private.has_permission(org,actor,'workspace.read_all') and own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status in ('accepted','cancelled') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   if length(note)=0 or length(btrim(coalesce(p_payload->>'proposedValue','')))=0 or coalesce(p_payload->>'type','') not in ('deadline','owner','scope') then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
   code:=private.next_code(org,'change');
   insert into public.change_requests(organization_id,task_cycle_id,code,request_type,requested_by,reason,expected_row_version)
    values(org,target,code,p_payload->>'type',actor,note,t.row_version) returning id into new_id;
   if p_payload->>'type'='deadline' then
    if p_payload->>'proposedValue'!~'^\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
    due:=(p_payload->>'proposedValue')::date;
    if due<=prev_deadline.due_on then raise exception using errcode='22023',message='INVALID_DEADLINE'; end if;
    insert into public.deadline_change_proposals(organization_id,request_id,previous_deadline_version_id,proposed_due_on) values(org,new_id,t.current_deadline_version_id,due);
   elsif p_payload->>'type'='owner' then
    new_owner:=(p_payload->>'proposedValue')::uuid;
    if not private.has_permission(org,new_owner,'task.work') or new_owner=reviewer.reviewer_id or new_owner=own.owner_id then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
    insert into public.assignment_change_proposals(organization_id,request_id,previous_owner_assignment_id,proposed_profile_id) values(org,new_id,own.id,new_owner);
   else
    insert into public.scope_change_proposals(organization_id,request_id,previous_spec_version_id,proposed_description) values(org,new_id,t.current_spec_version_id,btrim(p_payload->>'proposedValue'));
   end if;
   update public.resolution_cycles set status='open',row_version=row_version+1 where organization_id=org and id=parent;
   perform private.record_audit(org,actor,'ยื่นคำขอเปลี่ยนแปลง','task',target,spec.title,note,p_idempotency_key);
   target:=new_id;

  elsif p_operation='decide_change' then
   if cr.status<>'pending' or cr.requested_by=actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if length(note)=0 or p_payload->>'approved' is null then raise exception using errcode='22023',message='REASON_REQUIRED'; end if;
   flag:=(p_payload->>'approved')::boolean;
   if flag then
    if t.status in ('accepted','cancelled') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    -- The source version, not incidental progress updates, defines a proposal conflict.
    if cr.request_type='deadline' then
     select previous_deadline_version_id,proposed_due_on into original_version,due from public.deadline_change_proposals where organization_id=org and request_id=cr.id;
     if original_version<>t.current_deadline_version_id then raise exception using errcode='40001',message='STALE_VERSION'; end if;
     insert into public.task_deadline_versions(organization_id,task_cycle_id,version_no,due_on,approved_by,reason)
      values(org,target,prev_deadline.version_no+1,due,actor,note) returning id into new_version;
     update public.task_cycles set current_deadline_version_id=new_version,row_version=row_version+1 where organization_id=org and id=target;
    elsif cr.request_type='owner' then
     if t.status='submitted' then raise exception using errcode='22023',message='PENDING_SUBMISSION'; end if;
     select previous_owner_assignment_id,proposed_profile_id into original_version,new_owner from public.assignment_change_proposals where organization_id=org and request_id=cr.id;
     if original_version<>own.id then raise exception using errcode='40001',message='STALE_VERSION'; end if;
     if not private.has_permission(org,new_owner,'task.work') or new_owner=reviewer.reviewer_id then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
     update public.owner_assignments set valid_to=clock_timestamp() where organization_id=org and id=own.id;
     insert into public.owner_assignments(organization_id,task_cycle_id,owner_id,assigned_by,reason) values(org,target,new_owner,actor,note);
     insert into public.cycle_participation_events(organization_id,task_cycle_id,profile_id,participation_kind) values(org,target,new_owner,'owner');
     update public.task_cycles set status='assigned',row_version=row_version+1 where organization_id=org and id=target;
     perform private.notify_task(org,new_owner,target,'ได้รับโอนความรับผิดชอบงาน',spec.title,'assignment');
    else
     if t.status='submitted' then raise exception using errcode='22023',message='PENDING_SUBMISSION'; end if;
     select previous_spec_version_id,proposed_description into original_version,new_description from public.scope_change_proposals where organization_id=org and request_id=cr.id;
     if original_version<>t.current_spec_version_id then raise exception using errcode='40001',message='STALE_VERSION'; end if;
     insert into public.task_spec_versions(organization_id,task_cycle_id,version_no,title,description,deliverable,priority,lead_unit_id,confirmed_by,reason)
      values(org,target,spec.version_no+1,spec.title,new_description,spec.deliverable,spec.priority,spec.lead_unit_id,actor,note) returning id into new_version;
     insert into public.task_criteria(organization_id,spec_version_id,position,description,is_required)
      select org,new_version,position,description,is_required from public.task_criteria where organization_id=org and spec_version_id=spec.id;
     update public.task_cycles set current_spec_version_id=new_version,row_version=row_version+1 where organization_id=org and id=target;
    end if;
   end if;
   update public.change_requests set status=case when flag then 'approved' else 'rejected' end,row_version=row_version+1 where organization_id=org and id=cr.id;
   insert into public.change_decisions(organization_id,request_id,decision,actor_id,reason) values(org,cr.id,case when flag then 'approved' else 'rejected' end,actor,note);
   perform private.notify_task(org,own.owner_id,target,case when flag then 'คำขอได้รับอนุมัติ' else 'คำขอไม่ได้รับอนุมัติ' end,spec.title,'change');
   perform private.record_audit(org,actor,case when flag then 'อนุมัติคำขอ' else 'ไม่อนุมัติคำขอ' end,'task',target,spec.title,note,p_idempotency_key,before_json,private.task_dto(org,target));
   target:=cr.id;
  end if;

 elsif p_operation='update_settings' then
  select configuration,version_no into config,ordinal from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1;
  -- Serialize policy versions without requiring an exclusive authorization lock upgrade.
  perform 1 from public.organizations where id=org for update;
  select configuration,version_no into config,ordinal from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1;
  if jsonb_typeof(p_payload->'patch') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload->'patch') k where k not in ('reminderDays','acknowledgmentDays','reviewDays','emailNotifications')) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  config:=config||(p_payload->'patch');
  if jsonb_typeof(config->'emailNotifications') is distinct from 'boolean'
   or jsonb_typeof(config->'acknowledgmentDays') is distinct from 'number'
   or jsonb_typeof(config->'reviewDays') is distinct from 'number'
   or coalesce(config->>'acknowledgmentDays','')!~'^\d+$' or coalesce(config->>'reviewDays','')!~'^\d+$'
   or jsonb_typeof(config->'reminderDays') is distinct from 'array' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  if coalesce((config->>'emailNotifications')::boolean,false) then raise exception using errcode='0A000',message='EMAIL_NOT_AVAILABLE'; end if;
  if (config->>'acknowledgmentDays')::integer not between 1 and 30 or (config->>'reviewDays')::integer not between 1 and 60
   or jsonb_typeof(config->'reminderDays') is distinct from 'array' or jsonb_array_length(config->'reminderDays')>10
   or exists(select 1 from jsonb_array_elements(config->'reminderDays') x where jsonb_typeof(x)<>'number' or x::text!~'^\d+$') then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  if exists(select 1 from jsonb_array_elements_text(config->'reminderDays') x where x::integer not between 0 and 90) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  insert into public.policy_versions(organization_id,policy_key,version_no,configuration,published_by) values(org,'tracking',ordinal+1,config,actor) returning id into target;
  perform private.record_audit(org,actor,'ปรับการตั้งค่า','settings',target,'การติดตาม','บันทึกค่าตั้ง; ยังไม่มี scheduler ส่งเตือนอัตโนมัติ',p_idempotency_key);
 elsif p_operation='mark_notification_read' then
  update public.notifications n set read_at=coalesce(read_at,clock_timestamp()) where n.organization_id=org and n.id=target and n.recipient_id=actor
   and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor));
  if not found then raise exception using errcode='42501',message='NOT_FOUND'; end if;
 elsif p_operation='mark_all_read' then
  update public.notifications n set read_at=coalesce(read_at,clock_timestamp()) where n.organization_id=org and n.recipient_id=actor
   and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor));
 end if;
 result:=jsonb_strip_nulls(jsonb_build_object('id',target));
 update private.request_deduplications set response=result where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
 return result;
end $$;
revoke all on function public.workspace_command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb,uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;

-- END SOURCE: migrations/202610250004_commands.sql

-- BEGIN SOURCE: migrations/202610250005_role_access.sql
-- SHA256: 2c67a9eac8f399af5cebf436d80570856b755338f9ffc5ff0a9025efd0be3e97
-- Application roles are an upper bound on legacy workflow grants. No signup or
-- migration path creates an administrator. Run setup-admin.sql explicitly.
begin;

create table private.member_access_roles (
 organization_id uuid not null, profile_id uuid not null,
 role text not null check(role in ('admin','user','executive','staff')),
 version bigint not null default 1 check(version>0),
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now(),
 primary key(organization_id,profile_id),
 foreign key(organization_id,profile_id) references public.organization_memberships(organization_id,profile_id)
);
create table private.role_page_policies (
 organization_id uuid not null references public.organizations(id),
 role text not null check(role in ('user','executive','staff')),
 pages text[] not null,
 primary key(organization_id,role),
 check(pages <@ array['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','settings','notifications']::text[]),
 check(role<>'staff' or pages <@ array['dashboard','tasks','changes','notifications']::text[]),
 check(array_position(pages,null) is null)
);
create table private.access_policy_versions (
 organization_id uuid primary key references public.organizations(id),
 version bigint not null default 1 check(version>0)
);
alter table private.member_access_roles enable row level security;
alter table private.role_page_policies enable row level security;
alter table private.access_policy_versions enable row level security;
revoke all on private.member_access_roles,private.role_page_policies,private.access_policy_versions from public,anon,authenticated;

-- A cached JWT must not keep a disabled/banned Auth identity authoritative.
-- to_jsonb also supports local Auth test stubs without hosted-only columns.
create function private.auth_user_active(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user
 and nullif(to_jsonb(u)->>'deleted_at','') is null
 and (nullif(to_jsonb(u)->>'banned_until','') is null or (to_jsonb(u)->>'banned_until')::timestamptz<=statement_timestamp()))
$$;
create or replace function private.current_profile() returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.auth_identities i join public.profiles p on p.id=i.profile_id
 where i.auth_user_id=auth.uid() and i.disabled_at is null and p.disabled_at is null and private.auth_user_active(i.auth_user_id)
$$;
create or replace function private.active_member(p_org uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 join public.profiles p on p.id=m.profile_id
 where m.organization_id=p_org and m.profile_id=p_profile and m.status='active' and m.revoked_at is null
 and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp()) and o.is_active and p.disabled_at is null
 and exists(select 1 from public.auth_identities ai where ai.profile_id=p.id and ai.disabled_at is null and private.auth_user_active(ai.auth_user_id)))
$$;

create function private.access_role(p_org uuid,p_profile uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when private.active_member(p_org,p_profile) then coalesce(
  (select role from private.member_access_roles where organization_id=p_org and profile_id=p_profile),
  (select case when bool_or(role_code='secretary') then 'user' when bool_or(role_code='executive') then 'executive' else 'staff' end
   from public.access_grants where organization_id=p_org and profile_id=p_profile and revoked_at is null
   and valid_from<=statement_timestamp() and (valid_to is null or valid_to>statement_timestamp()) having count(*)>0)) end
$$;
create function private.default_role_pages(p_role text) returns text[] language sql immutable set search_path='' as $$
 select case p_role
 when 'admin' then array['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','settings','notifications']
 when 'user' then array[]::text[]
 when 'executive' then array[]::text[]
 when 'staff' then array['tasks','changes','notifications'] else array[]::text[] end
$$;
create function private.role_pages(p_org uuid,p_role text) returns text[] language sql stable security definer set search_path='' as $$
 select case when p_role='admin' then private.default_role_pages('admin') else coalesce(
 (select pages from private.role_page_policies where organization_id=p_org and role=p_role),private.default_role_pages(p_role)) end
$$;
create function private.page_enabled(p_org uuid,p_profile uuid,p_page text) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and p_page=any(private.role_pages(p_org,private.access_role(p_org,p_profile)))
$$;
create function private.workflow_roles(p_role text) returns jsonb language sql immutable set search_path='' as $$
 select case p_role when 'admin' then '["secretary","owner","reviewer","executive"]'::jsonb
 when 'user' then '["secretary","owner"]'::jsonb when 'executive' then '["executive","reviewer"]'::jsonb
 when 'staff' then '["owner"]'::jsonb else '[]'::jsonb end
$$;
create function private.role_capabilities(p_role text) returns text[] language sql immutable set search_path='' as $$
 select case p_role
 when 'admin' then array['workspace.read_all','meeting.manage','resolution.draft','execution.authorize','task.assign','task.work','submission.review','change.request','deadline.approve','assignment.approve','scope.approve','resolution.close','policy.manage','report.export','access.manage']
 when 'user' then array['workspace.read_all','meeting.manage','resolution.draft','task.assign','task.work','change.request']
 when 'executive' then array['workspace.read_all','execution.authorize','deadline.approve','assignment.approve','scope.approve','resolution.close','submission.review','report.export']
 when 'staff' then array['task.work','change.request'] else array[]::text[] end
$$;
create function private.permission_page(p_permission text) returns text language sql immutable set search_path='' as $$
 select case p_permission when 'meeting.manage' then 'meetings' when 'resolution.draft' then 'resolutions'
 when 'execution.authorize' then 'resolutions' when 'resolution.close' then 'resolutions'
 when 'task.assign' then 'resolutions' when 'task.work' then 'tasks' when 'submission.review' then 'reviews'
 when 'change.request' then 'changes' when 'deadline.approve' then 'changes' when 'assignment.approve' then 'changes'
 when 'scope.approve' then 'changes' when 'policy.manage' then 'settings' when 'report.export' then 'reports'
 when 'access.manage' then 'team' end
$$;
create or replace function private.has_permission(p_org uuid,p_profile uuid,p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile)
 and p_permission=any(private.role_capabilities(private.access_role(p_org,p_profile)))
 and (p_permission='workspace.read_all' or private.page_enabled(p_org,p_profile,private.permission_page(p_permission)))
$$;
create or replace function private.read_task(p_org uuid,p_cycle uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and private.access_role(p_org,p_profile) is not null and (
 private.has_permission(p_org,p_profile,'workspace.read_all') or exists(
 select 1 from public.owner_assignments where organization_id=p_org and task_cycle_id=p_cycle and owner_id=p_profile and valid_to is null))
$$;

-- Keep the established immutable business workflow implementation private. Its
-- permission checks now resolve canonical roles on every invocation.
alter function public.workspace_command(uuid,text,jsonb,uuid) set schema private;
alter function private.workspace_command(uuid,text,jsonb,uuid) rename to workspace_command_legacy;

create function public.workspace_command(p_organization_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; org uuid:=p_organization_id; needed_page text; target uuid; desired text;
 previous_role text; actual_version bigint; requested_pages text[]; result jsonb; prior jsonb; old_hash text; hash text;
begin
 if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
 raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for share;
 -- Access changes use the same guard as workflow commands, with an exclusive
 -- lock. Authorization is re-read after obtaining the lock, never before it.
 if p_operation in ('set_member_role','set_role_pages') then
  perform 1 from private.authorization_guards where organization_id=org for update;
 else perform 1 from private.authorization_guards where organization_id=org for share; end if;
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 if not private.active_member(org,actor) or private.access_role(org,actor) is null then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 needed_page:=case p_operation
 when 'add_meeting' then 'meetings' when 'add_resolution' then 'resolutions'
 when 'authorize_resolution' then 'resolutions' when 'close_resolution' then 'resolutions'
 when 'add_task' then 'resolutions' when 'acknowledge_task' then 'tasks' when 'update_progress' then 'tasks' when 'add_evidence' then 'tasks'
 when 'transition_task' then case when p_payload->>'status' in ('accepted','revision') then 'reviews' else 'tasks' end
 when 'create_change_request' then 'changes' when 'decide_change' then 'changes'
 when 'update_settings' then 'settings' when 'mark_notification_read' then 'notifications' when 'mark_all_read' then 'notifications'
 when 'set_member_role' then 'team' when 'set_role_pages' then 'team' end;
 if needed_page is null then raise exception using errcode='22023',message='UNKNOWN_OPERATION'; end if;
 if not private.page_enabled(org,actor,needed_page) then raise exception using errcode='42501',message='PAGE_ACCESS_DENIED'; end if;
 if p_operation not in ('set_member_role','set_role_pages') then
  return private.workspace_command_legacy(org,p_operation,p_payload,p_idempotency_key);
 end if;
 if private.access_role(org,actor)<>'admin' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 desired:=p_payload->>'role';
 if desired is null or desired not in ('admin','user','executive','staff') or coalesce(p_payload->>'expectedVersion','')!~'^[0-9]+$' then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 if (p_operation='set_member_role' and exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('profileId','role','expectedVersion')))
 or (p_operation='set_role_pages' and exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('role','pages','expectedVersion'))) then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 hash:=md5(p_payload::text);
 insert into private.request_deduplications(organization_id,actor_id,operation,idempotency_key,request_hash)
 values(org,actor,p_operation,p_idempotency_key,hash) on conflict do nothing;
 select request_hash,response into old_hash,prior from private.request_deduplications
 where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key for update;
 if old_hash<>hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
 if prior is not null then return prior; end if;
 if p_operation='set_member_role' then
  target:=nullif(p_payload->>'profileId','')::uuid;
  if target is null or not private.active_member(org,target) then raise exception using errcode='22023',message='INACTIVE_MEMBER'; end if;
  select coalesce((select version from private.member_access_roles where organization_id=org and profile_id=target),0) into actual_version;
  perform private.assert_version(p_payload->>'expectedVersion',actual_version);
  previous_role:=private.access_role(org,target);
  if previous_role='admin' and desired<>'admin' and not exists(
   select 1 from private.member_access_roles where organization_id=org and profile_id<>target and role='admin' and private.active_member(org,profile_id)) then
   raise exception using errcode='42501',message='LAST_ADMIN_REQUIRED'; end if;
  insert into private.member_access_roles(organization_id,profile_id,role,updated_by) values(org,target,desired,actor)
  on conflict(organization_id,profile_id) do update set role=excluded.role,version=private.member_access_roles.version+1,updated_by=actor,updated_at=clock_timestamp();
  result:=jsonb_build_object('id',target,'version',actual_version+1);
  perform private.record_audit(org,actor,'set_member_role','access',target,'Member access',desired,p_idempotency_key,
   jsonb_build_object('role',previous_role,'version',actual_version),jsonb_build_object('role',desired,'version',actual_version+1));
 else
  if desired='admin' then raise exception using errcode='42501',message='ADMIN_PAGES_IMMUTABLE'; end if;
  if jsonb_typeof(p_payload->'pages') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_payload->'pages') v where jsonb_typeof(v)<>'string') then
   raise exception using errcode='22023',message='INVALID_PAGES'; end if;
  select coalesce(array_agg(value order by ord),'{}'::text[]) into requested_pages from jsonb_array_elements_text(p_payload->'pages') with ordinality x(value,ord);
  if not requested_pages <@ private.default_role_pages('admin') or cardinality(requested_pages)<>(select count(distinct x) from unnest(requested_pages) x)
  or (desired='staff' and not requested_pages <@ array['dashboard','tasks','changes','notifications']::text[]) then
   raise exception using errcode='22023',message='INVALID_PAGES'; end if;
  insert into private.access_policy_versions(organization_id) values(org) on conflict do nothing;
  select version into actual_version from private.access_policy_versions where organization_id=org;
  perform private.assert_version(p_payload->>'expectedVersion',actual_version);
  insert into private.role_page_policies(organization_id,role,pages) values(org,desired,requested_pages)
  on conflict(organization_id,role) do update set pages=excluded.pages;
  update private.access_policy_versions set version=version+1 where organization_id=org;
  result:=jsonb_build_object('policyVersion',actual_version+1);
  perform private.record_audit(org,actor,'set_role_pages','access',null,'Role pages',desired,p_idempotency_key,null,p_payload);
 end if;
 update private.authorization_guards set epoch=epoch+1 where organization_id=org;
 update private.request_deduplications set response=result where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
 return result;
end $$;

create or replace function public.get_workspace_state(p_organization_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; org uuid; all_access boolean; summary_access boolean; result jsonb; granted_roles jsonb; permissions_json jsonb; app_role text; pages text[]; state_json jsonb; directory jsonb; member_json jsonb; policies jsonb; prior_context jsonb;
begin
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select m.organization_id into org from public.organization_memberships m
 where m.profile_id=actor and (p_organization_id is null or m.organization_id=p_organization_id)
 and private.active_member(m.organization_id,actor) order by m.valid_from,m.organization_id limit 1;
 if org is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 app_role:=private.access_role(org,actor);
 if app_role is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 granted_roles:=private.workflow_roles(app_role);
 pages:=private.role_pages(org,app_role);
 summary_access:='dashboard'=any(pages) or 'reports'=any(pages);
 select coalesce(jsonb_agg(cap order by cap),'[]'::jsonb) into permissions_json
 from unnest(private.role_capabilities(app_role)) cap where private.has_permission(org,actor,cap);
 all_access:=private.has_permission(org,actor,'workspace.read_all');
 with visible_tasks as materialized (
  select c.* from public.task_cycles c join public.tasks t on t.organization_id=c.organization_id and t.current_cycle_id=c.id
  where c.organization_id=org and private.read_task(org,c.id,actor)
 ), visible_resolutions as materialized (
  select c.*,r.code,r.origin_agenda_id,r.created_at,s.title,s.content,s.resolution_type,s.lead_unit_id,s.coordinator_id,s.due_on
  from public.resolution_cycles c join public.resolutions r on r.organization_id=c.organization_id and r.current_cycle_id=c.id
  join public.resolution_versions s on s.organization_id=c.organization_id and s.id=c.governing_version_id
  where c.organization_id=org and private.read_resolution(org,c.id,actor)
 ), visible_people as (
  select actor id union select o.owner_id from public.owner_assignments o join visible_tasks t on t.id=o.task_cycle_id where o.organization_id=org and o.valid_to is null
  union select r.reviewer_id from public.reviewer_assignments r join visible_tasks t on t.id=r.task_cycle_id where r.organization_id=org and r.valid_to is null
  union select coordinator_id from visible_resolutions
 ), visible_meetings as (
  select m.* from public.meetings m where m.organization_id=org and (all_access or exists(select 1 from visible_resolutions r join public.agenda_items a on a.organization_id=org and a.id=r.origin_agenda_id where a.meeting_id=m.id))
 )
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name_th) from public.organizations where id=org),
 'roles',granted_roles,'permissions',permissions_json,
 'units',coalesce((select jsonb_agg(name_th order by name_th) from public.organization_units where organization_id=org and is_active),'[]'::jsonb),
 'eligibleOwners',case when private.has_permission(org,actor,'change.request') or private.has_permission(org,actor,'task.assign') then
  coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'unit',u.name_th) order by p.display_name,p.id)
   from public.organization_memberships m join public.profiles p on p.id=m.profile_id
   join public.organization_units u on u.organization_id=org and u.id=m.unit_id
   where m.organization_id=org and private.has_permission(org,p.id,'task.work')),'[]'::jsonb)
  else '[]'::jsonb end,
 'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'initials',left(p.display_name,2),'unit',u.name_th,'avatarColor','#5f7161',
 'role',coalesce((select g.role_code from public.access_grants g where g.organization_id=org and g.profile_id=p.id and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())
 order by case g.role_code when 'owner' then 1 when 'reviewer' then 2 when 'secretary' then 3 else 4 end limit 1),'owner'),
 'roles',coalesce((select jsonb_agg(distinct g.role_code) from public.access_grants g where g.organization_id=org and g.profile_id=p.id and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())),'[]'::jsonb)) order by p.display_name,p.id)
 from public.organization_memberships m join public.profiles p on p.id=m.profile_id join public.organization_units u on u.organization_id=org and u.id=m.unit_id
 where m.organization_id=org and private.active_member(org,p.id) and (all_access or p.id in(select id from visible_people))),'[]'::jsonb),
 'state',jsonb_build_object('activeRole',granted_roles->>0,'currentUserId',actor,
 'tasks',coalesce((select jsonb_agg(private.task_dto(org,id) order by published_at desc,id) from visible_tasks),'[]'::jsonb),
 'resolutions',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',r.id,'stableId',r.resolution_id,'rowVersion',r.row_version,'code',r.code,'title',r.title,
  'content',case when all_access then r.content else 'ข้อมูลมติส่วนที่เกี่ยวข้องกับงานที่คุณได้รับมอบหมาย' end,
  'meetingId',a.meeting_id,'agenda',a.agenda_no,'type',r.resolution_type,'unit',u.name_th,'coordinatorId',r.coordinator_id,
  'status',r.status,'createdAt',r.created_at,'dueDate',r.due_on,
  'executionAuthorized',private.execution_authorized(org,r.id),'partialContext',not all_access,
  'closureCriteria',case when all_access then coalesce((select jsonb_agg(k.description order by k.position) from public.resolution_criteria k where k.organization_id=org and k.resolution_version_id=r.governing_version_id),'[]'::jsonb) else '[]'::jsonb end)) order by r.created_at desc,r.id)
  from visible_resolutions r join public.agenda_items a on a.organization_id=org and a.id=r.origin_agenda_id join public.organization_units u on u.organization_id=org and u.id=r.lead_unit_id),'[]'::jsonb),
 'meetings',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'number',m.meeting_no,'date',to_char(m.scheduled_start at time zone 'Asia/Bangkok','YYYY-MM-DD'),
  'time',to_char(m.scheduled_start at time zone 'Asia/Bangkok','HH24:MI'),'location',m.location,'status',m.status,'committee',cm.name_th,
  'agenda',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'number',a.agenda_no,'title',a.title,
  'resolutionIds',coalesce((select jsonb_agg(r.id order by r.id) from visible_resolutions r where r.origin_agenda_id=a.id),'[]'::jsonb)) order by a.agenda_no)
  from public.agenda_items a where a.organization_id=org and a.meeting_id=m.id and (all_access or exists(select 1 from visible_resolutions r where r.origin_agenda_id=a.id))),'[]'::jsonb)) order by m.scheduled_start desc,m.id)
  from visible_meetings m join public.committee_terms ct on ct.organization_id=org and ct.id=m.term_id join public.committees cm on cm.organization_id=org and cm.id=ct.committee_id),'[]'::jsonb),
 'changes',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',c.id,'rowVersion',c.row_version,'code',c.code,'taskId',c.task_cycle_id,
 'type',c.request_type,'status',c.status,'requestedById',c.requested_by,'reason',c.reason,'createdAt',c.requested_at,
 'originalValue',case c.request_type when 'deadline' then (select due_on::text from public.task_deadline_versions where organization_id=org and id=dp.previous_deadline_version_id) when 'owner' then (select owner_id::text from public.owner_assignments where organization_id=org and id=ap.previous_owner_assignment_id) else (select description from public.task_spec_versions where organization_id=org and id=sp.previous_spec_version_id) end,
 'proposedValue',case c.request_type when 'deadline' then dp.proposed_due_on::text when 'owner' then ap.proposed_profile_id::text else sp.proposed_description end,
 'decidedAt',cd.decided_at,'decidedById',cd.actor_id,'decisionReason',cd.reason)) order by c.requested_at desc,c.id)
 from public.change_requests c join visible_tasks t on t.id=c.task_cycle_id
 left join public.deadline_change_proposals dp on dp.organization_id=org and dp.request_id=c.id
 left join public.assignment_change_proposals ap on ap.organization_id=org and ap.request_id=c.id
 left join public.scope_change_proposals sp on sp.organization_id=org and sp.request_id=c.id
 left join public.change_decisions cd on cd.organization_id=org and cd.request_id=c.id where c.organization_id=org),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',n.id,'title',n.title,'description',n.description,'createdAt',n.created_at,'read',n.read_at is not null,'type',n.type,
 'href',case when n.task_cycle_id is not null then '/tasks/'||n.task_cycle_id::text when n.resolution_cycle_id is not null then '/resolutions/'||n.resolution_cycle_id::text else '/' end,
 'targetId',coalesce(n.task_cycle_id,n.resolution_cycle_id))) order by n.created_at desc,n.id) from public.notifications n
 where n.organization_id=org and n.recipient_id=actor and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor))),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.operation,'actorId',a.actor_id,'createdAt',a.recorded_at,'targetId',coalesce(a.entity_id::text,'settings'),'targetLabel',a.target_label,'detail',a.detail) order by a.recorded_at desc,a.id)
 from (select * from private.audit_events e where e.organization_id=org and (all_access or (e.entity_type='task' and private.read_task(org,e.entity_id,actor))) order by e.recorded_at desc,e.id limit 500) a),'[]'::jsonb),
 'settings',coalesce((select configuration from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1),'{"reminderDays":[7,3,1],"acknowledgmentDays":2,"reviewDays":3,"emailNotifications":false}'::jsonb)
 )) into result;
 -- Only return data appropriate to enabled pages. Canonical staff scope is
 -- owner-only even if obsolete reviewer or secretary grants still exist.
 state_json:=result->'state';
 if not ('tasks'=any(pages) or 'reviews'=any(pages)) then
  -- Dashboard/report access authorizes a bounded reporting projection, not task
  -- evidence, updates, specification text, reviewer details or mutation access.
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',v->'id','code',v->'code','title',v->'title','resolutionId',v->'resolutionId',
   'ownerId',v->'ownerId','unit',v->'unit','status',v->'status','progress',v->'progress',
   'dueDate',v->'dueDate','originalDueDate',v->'originalDueDate','acceptedAt',v->'acceptedAt','submittedAt',v->'submittedAt',
   'rowVersion',case when 'changes'=any(pages) then v->'rowVersion' end))),'[]'::jsonb)
  into prior_context from jsonb_array_elements(state_json->'tasks') v where summary_access or 'changes'=any(pages);
  state_json:=jsonb_set(state_json,'{tasks}',prior_context);
 end if;
 if app_role='staff' then state_json:=jsonb_set(state_json,'{meetings}','[]'::jsonb);
 elsif not ('meetings'=any(pages)) then
  if summary_access then
   select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','title',v->'title','number',v->'number','date',v->'date',
    'time',v->'time','location',v->'location','committee',v->'committee','status',v->'status')),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'meetings') v;
  else
   -- Drafting a resolution requires choosing an existing source meeting. This
   -- selector context grants neither meeting details nor meeting mutations.
   select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','title',v->'title','number',v->'number')),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'meetings') v where private.has_permission(org,actor,'resolution.draft');
  end if;
  state_json:=jsonb_set(state_json,'{meetings}',prior_context);
 end if;
 if app_role='staff' or not ('resolutions'=any(pages)) then
  if app_role<>'staff' and summary_access then
   select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',v->'id','code',v->'code','title',v->'title','status',v->'status','type',v->'type',
    'coordinatorId',v->'coordinatorId','dueDate',v->'dueDate','createdAt',v->'createdAt','meetingId',v->'meetingId',
    'executionAuthorized',v->'executionAuthorized','partialContext',true))),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'resolutions') v;
  else
   select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','code',v->'code','title',v->'title','status',v->'status',
    'executionAuthorized',v->'executionAuthorized','partialContext',true)),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'resolutions') v
   where exists(select 1 from jsonb_array_elements(state_json->'tasks') t where t->>'resolutionId'=v->>'id');
  end if;
  state_json:=jsonb_set(state_json,'{resolutions}',prior_context);
 end if;
 if not ('changes'=any(pages)) then state_json:=jsonb_set(state_json,'{changes}','[]'::jsonb);
 elsif app_role='staff' then
  select coalesce(jsonb_agg(v),'[]'::jsonb) into prior_context from jsonb_array_elements(state_json->'changes') v where v->>'requestedById'=actor::text;
  state_json:=jsonb_set(state_json,'{changes}',prior_context);
 end if;
 if not ('notifications'=any(pages)) then state_json:=jsonb_set(state_json,'{notifications}','[]'::jsonb); end if;
 if app_role='staff' or not ('settings'=any(pages)) then state_json:=jsonb_set(state_json,'{settings}','{}'::jsonb); end if;
 -- Audit is an organization-wide management surface; task ownership alone never grants it.
 if app_role<>'admin' or not ('settings'=any(pages)) then state_json:=jsonb_set(state_json,'{audit}','[]'::jsonb); end if;
 select coalesce(jsonb_agg(v||jsonb_build_object('accessRole',coalesce(private.access_role(org,(v->>'id')::uuid),'staff'),
  'roles',private.workflow_roles(coalesce(private.access_role(org,(v->>'id')::uuid),'staff')),
  'role',private.workflow_roles(coalesce(private.access_role(org,(v->>'id')::uuid),'staff'))->>0)),'[]'::jsonb)
 into directory from jsonb_array_elements(result->'users') v
 where v->>'id'=actor::text or (app_role<>'staff' and ('team'=any(pages)
  or exists(select 1 from jsonb_array_elements(state_json->'tasks') t where v->>'id' in (t->>'ownerId',t->>'reviewerId'))
  or exists(select 1 from jsonb_array_elements(state_json->'resolutions') r where v->>'id'=r->>'coordinatorId')
  or (private.has_permission(org,actor,'task.assign') and (private.has_permission(org,(v->>'id')::uuid,'task.work')
   or private.has_permission(org,(v->>'id')::uuid,'submission.review')))));
 result:=jsonb_set(result,'{users}',directory);
 if app_role='staff' or cardinality(pages)=0 then
  result:=jsonb_set(result,'{eligibleOwners}','[]'::jsonb);
  select coalesce(jsonb_agg(distinct v->'unit'),'[]'::jsonb) into prior_context from jsonb_array_elements(directory) v;
  result:=jsonb_set(result,'{units}',prior_context);
 elsif not private.has_permission(org,actor,'task.assign') and not private.has_permission(org,actor,'change.request') then
  result:=jsonb_set(result,'{eligibleOwners}','[]'::jsonb);
 end if;
 select coalesce(jsonb_object_agg(v->>'id',jsonb_build_object('role',coalesce(private.access_role(org,(v->>'id')::uuid),'staff'),
  'version',coalesce((select version from private.member_access_roles where organization_id=org and profile_id=(v->>'id')::uuid),0))),'{}'::jsonb)
 into member_json from jsonb_array_elements(directory) v;
 select jsonb_object_agg(r,to_jsonb(private.role_pages(org,r))) into policies from unnest(array['admin','user','executive','staff']) r;
 result:=jsonb_set(result,'{state}',state_json)||jsonb_build_object('access',jsonb_build_object('role',app_role,'pages',to_jsonb(pages),
  'policies',policies,'policyVersion',coalesce((select version from private.access_policy_versions where organization_id=org),1),'members',member_json));
 return result;
end $$;


-- Explicit, private bootstrap for an existing active member in a named existing
-- organization. It does not create/revive identities, memberships or organizations.
create function private.bootstrap_admin(p_email text,p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare person uuid; user_id uuid; matches bigint; identity_record record; old_role text;
begin
 perform 1 from private.identity_authorization_guard where id=1 for update;
 if not found then raise exception 'IDENTITY_GUARD_MISSING'; end if;
 if p_org is null or p_email is null or position('@' in btrim(p_email))<2 then raise exception 'EXPLICIT_EMAIL_AND_ORGANIZATION_REQUIRED'; end if;
 perform 1 from private.authorization_guards where organization_id=p_org for update;
 if not found or not exists(select 1 from public.organizations where id=p_org and is_active) then raise exception 'TARGET_ORGANIZATION_NOT_FOUND_OR_INACTIVE'; end if;
 select count(*) into matches from auth.users where lower(email)=lower(btrim(p_email));
 if matches<>1 then raise exception 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER'; end if;
 select id into user_id from auth.users where lower(email)=lower(btrim(p_email));
 if exists(select 1 from auth.users u where u.id=user_id and (
  nullif(to_jsonb(u)->>'deleted_at','') is not null or nullif(to_jsonb(u)->>'banned_until','')::timestamptz>statement_timestamp())) then
  raise exception 'BLOCKED_AUTH_USER'; end if;
 select i.profile_id,i.disabled_at identity_disabled,p.disabled_at profile_disabled into identity_record
 from public.auth_identities i join public.profiles p on p.id=i.profile_id where i.auth_user_id=user_id;
 person:=identity_record.profile_id;
 if person is null or identity_record.identity_disabled is not null or identity_record.profile_disabled is not null then raise exception 'ACTIVE_EXISTING_IDENTITY_REQUIRED'; end if;
 if not private.active_member(p_org,person) then raise exception 'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED'; end if;
 old_role:=private.access_role(p_org,person);
 if old_role<>'admin' or old_role is null then
  insert into private.member_access_roles(organization_id,profile_id,role,updated_by) values(p_org,person,'admin',person)
  on conflict(organization_id,profile_id) do update set role='admin',version=private.member_access_roles.version+1,updated_by=person,updated_at=clock_timestamp();
  update private.authorization_guards set epoch=epoch+1 where organization_id=p_org;
  perform private.record_audit(p_org,person,'bootstrap_admin','access',person,'Explicit administrator bootstrap','Database administrator selected an existing Auth email and organization',gen_random_uuid(),jsonb_build_object('role',old_role),jsonb_build_object('role','admin'));
 end if;
 return jsonb_build_object('organizationId',p_org,'profileId',person,'role',private.access_role(p_org,person),'pages',private.role_pages(p_org,'admin'));
end $$;

revoke all on function public.workspace_command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb,uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;

-- END SOURCE: migrations/202610250005_role_access.sql

