-- Transactional security test: no test accounts or tours survive the rollback.
begin;
insert into auth.users (id, email, email_confirmed_at, is_anonymous)
values ('0ce7c590-d3c1-4b55-a8a7-000000000001','randall@rayonstudio.net',now(),false),
('0ce7c590-d3c1-4b55-a8a7-000000000002','rayon-test@example.invalid',now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','0ce7c590-d3c1-4b55-a8a7-000000000001',true);
insert into public.rayon_tours (id,revision,object_path,title,rooms)
values ('0ce7c590-d3c1-4b55-a8a7-000000000003','0ce7c590-d3c1-4b55-a8a7-000000000004','0ce7c590-d3c1-4b55-a8a7-000000000003/0ce7c590-d3c1-4b55-a8a7-000000000004.json','Security test',1);
do $$ begin
  if not exists(select 1 from public.rayon_tours where title='Security test') then raise exception 'Admin read failed'; end if;
end $$;
update public.rayon_tours set title='Security test updated' where id='0ce7c590-d3c1-4b55-a8a7-000000000003';
select set_config('request.jwt.claim.sub','0ce7c590-d3c1-4b55-a8a7-000000000002',true);
do $$ begin
  if exists(select 1 from public.rayon_tours) then raise exception 'Unauthorized user can read tours'; end if;
  begin
    insert into public.rayon_tours (id,revision,object_path,title,rooms)
    values ('0ce7c590-d3c1-4b55-a8a7-000000000005','0ce7c590-d3c1-4b55-a8a7-000000000006','0ce7c590-d3c1-4b55-a8a7-000000000005/0ce7c590-d3c1-4b55-a8a7-000000000006.json','Forbidden',1);
    raise exception 'Unauthorized insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','0ce7c590-d3c1-4b55-a8a7-000000000001',true);
delete from public.rayon_tours where id='0ce7c590-d3c1-4b55-a8a7-000000000003';
do $$ begin if exists(select 1 from public.rayon_tours where id='0ce7c590-d3c1-4b55-a8a7-000000000003') then raise exception 'Admin delete failed';end if;end $$;
reset role;
select 'Admin CRUD and unauthorized read/write protection passed' as result;
rollback;
