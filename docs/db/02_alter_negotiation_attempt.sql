alter table negotiation_attempt
drop constraint if exists negotiation_attempt_contract_id_fkey;

alter table negotiation_attempt
drop column if exists contract_id;