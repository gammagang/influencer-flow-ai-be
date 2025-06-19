alter table campaign_creator
drop constraint if exists campaign_creator_state_check;

alter table campaign_creator
add constraint campaign_creator_state_check check (
  current_state in (
    'discovered',
    'outreached',
    'call complete',
    'waiting for signature',
    'signatures complete',
    'fulfilled'
  )
);