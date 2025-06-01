Okay, now, I want to create a document for the entities, relationships the lifecycles. I have collated a bunch of things from what I understand. Analyse it, ask me follow up questions about it. We can tweak it.

Your job is to give me an entity-relationship document which outlines the entities and relationships and what kinda postgres tables I can have to trach everything in my MVP. DO not give me postgres queries. This is a document that aggregates all I have found. Attached below are:

- Main entities (and a relationship between them)
- Campaign lifecycles of campaign X creator

```
Entity Relationship mappings
- One Company can have many campaigns but one campaign
is always tied to one company (For MVP)
- One Campaign can have many creators and one
creator can be a part of many campaigns.
```

```
Campaign Lifecycles
- Each campaign and a creator can be a part of a lifecycle stage
- Eg: Campaign 1
    - Creator 1 is in stage "outreached"
    - Creator 2 is in "dead lead"
    - Creator 3 is in "waiting for contract"
- Aggregate metrics:
    - If all creators have passed the "outreach" stage,
        we can derive that

- After the capmaign ends, we can get the metrics of
each post by each creator in some dashboard for analytics
```
