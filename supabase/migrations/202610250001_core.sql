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
