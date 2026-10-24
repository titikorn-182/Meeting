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
