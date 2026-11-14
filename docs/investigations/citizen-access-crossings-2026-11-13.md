# Building access, shared crossings and turnout — 2026-11-13

## Scope

Investigate discontinuous interior movement and abstention/early deaths; implement shared boat crossings using existing vessels, ownership, paths and accounts. Interior movement and election rules were not changed.

## Interior discontinuity: confirmed cause

`js/city_interiors.js`, `timeInteriorJourney`, replaces a validated interior polyline with its destination and total remaining distance. For ordinary activities, `activityRoomReady` selects this timed representation unless the building is the currently observed detailed interior. `advanceCitizenInterior` consumes time without changing the position, then assigns the destination when the timer expires. Special missions and observed interiors retain the walked route. This is an optimization boundary, not two classes of citizen. It explains reaching the entrance, waiting and jumping to an interior destination.

## Turnout: confirmed mechanisms, not a geographic diagnosis

`js/city_voting.js`, `route`, rejects a citizen with `0 < sleep.minutes < 480` even when `sleep.active` is false. Interrupted sleep retains these minutes in `js/city_sleep.js`. Consequently “Completando oito horas de sono” includes awake citizens with an unfinished sleep session. Retry is 30 city minutes.

Urgent needs and committed deliveries/cleaning also prevent routing. Departures are assigned between 08:00 and approximately 16:00 without subtracting the actual trip duration. Queue closes at 18:00. Long journeys and retries can therefore miss the window. The turnout panel reports the last condition, not all causes or time spent in each condition. The screenshot alone cannot establish that islands caused the abstentions.

## Mortality reproduction

User supplied seed `558901596` and first death on day 6. Diagnostic configuration: 128×128, 512 citizens, founding works enabled, normal simulation, `city.update(0.25)` once per city minute, no player interventions. The world generator forces the archipelago preset even when a legacy preset ID is supplied; IDs 0 and 1 generate the same map for this seed.

The first completed run recorded the first death at minute 9380 (day 7, 12:20), citizen 428. This does **not** reproduce the user's day-6 timing. Recorded cause: health failure after poor sanitation/hygiene. Hygiene and health were zero; food 15.68, water 33.89, energy 33.52; health had remained zero for 120 minutes. The citizen was walking to health care, with 395 minutes of interrupted sleep outstanding. No starvation/dehydration counter was active. The source string records the last attributed health damage and is not a complete causal history.

The decisive sleep/health priority conflict is in `js/city_simulation.js`, the active-sleep branch before the general urgent-task interruption. It continues sleep while food, water, health and toilet remain above 5, without checking hygiene or the earlier health-warning threshold of 20. At minute 9120 the victim remained asleep with hygiene 7.5 and health 16.9; at 9180, hygiene 4.8 and health 9.7. Sleep was interrupted at 9220, leaving 395/480 minutes outstanding. At 9240 the citizen was finally walking to care with health 2.4. At 9300 health was zero; death occurred at 9380 while still en route. This confirms delayed medical departure despite the existing early health warning. The low-hygiene health drain remained active throughout sleep. A route probe on the death-state snapshot still found a valid 37.24-cell path to the hall, so this death did not require a disconnected island.

The victim trace also shows partial hygiene recovery being interrupted: at minute 5100 hygiene was 7.4 and the citizen was entering a bathroom; at 5160 hygiene was 12.7 and the task had become `justice-report`; at 5220 hygiene was 9.3 and the citizen was walking back for hygiene. This repeats at 5520–5640. `dispatchReports` only tests whether a need is currently urgent; hygiene becomes nonurgent at 10. Unlike food, water, health and toilet, hygiene is absent from `ESSENTIAL_TASKS` protection. Thus a short wash can cross the emergency threshold and lose its task before full recovery, causing repeated trips. This mechanism is confirmed in the trace, but does not alone establish the entire death sequence.

Earlier snapshots showed growing urgent hygiene demand and unfinished sleep sessions. Connectivity snapshots did not classify any living citizen as definitely disconnected from the town hall. This does not establish acceptable travel times, service capacity or room access. Initial development is connected, while later construction does not universally enforce a settlement component. Island isolation remains a possible mechanism in other cities, not a proven explanation of this screenshot.

Recorded configuration, snapshots, death and selected victim trace: `docs/investigations/citizen-access-558901596.json`. The repeated run reproduced the same first death and exported the state packet successfully. No shared crossing was active/recorded in that reproduction.

Reproduction:

```bash
TERRAIN=archipelago SEED=558901596 POPULATION=512 MINUTES=10080 \
  STOP_ON_DEATH=1 WATCH_CITIZEN=428 STATE_FILE=/tmp/citizen-access.bin \
  node scripts/investigate-archipelago-access.mjs
```

`STATE_FILE` is a Node V8-serialized state packet, including cyclic references; decode with `node:v8.deserialize`, then `CityStateGraph.apply`. For live route probes, call `bindCityState(city)` and recreate omitted runtime caches such as `city.pathCache = new Map()`. `FOUNDING_WORKS=0` explicitly disables founding works. `TERRAIN=land-control` converts water to walkable ground, keeping the other terrain and resources; it is a synthetic control, not another generated preset.

## Shared crossings implemented

Existing rentable/company/municipal vessels now recruit nearby citizens whose actual destinations benefit from the crossing. The organizer is the owning business/citizen, or the initiating traveler for public vessels. No new vessel or citizen is spawned. The first traveler pilots. Personally owned trips, cargo deliveries and bicycle towing retain their existing behavior.

The nominal existing fare is divided by actual occupants, rounded up to the currency unit. Company/employer and municipal exemptions remain. Boarding and landing use physical movement. Capacity, needs, shared household balances and vessel reservations remain binding. Invitation search is capped at 32 candidates within 10 cells; late arrivals have a three-second boarding window. The boat departs without requiring full capacity. Household balances are checked before charging; failed payment cancels to a physical shore. A surviving passenger can take the group ashore if the pilot dies.

Routes retain regular members and record owner/organizer, destination, departures, actual occupancy, fare and revenue. Work trips establish outbound 07:30 and return 17:00 groups. Regular invitations require the actual boat at the origin, current job/home membership and an accessible route; sleep and urgent needs take priority. No empty repositioning or dedicated hired crew is added. Groups are persisted, and the vessel panel exposes the route and organizer. Business fares use existing service-revenue accounting.

## Validation

37 focused boat/compact-state/worker-export tests passed. Five targeted health/deprivation/bathroom tests also passed. Added coverage includes shared fare, recruitment, physical movement at every step, daily outbound/return trips, changed jobs, capacity, no-shows, household affordability, pilot death and a saved mid-crossing continuation without duplicate payment. Compact rider packets preserve one pilot and all passengers on the actual hull.

Four fast-forward tests also fail on an extracted unmodified HEAD: journey deferral, routine revision boundary, timed interior duration and sleep deadline. They are pre-existing failures, not claimed fixed here. A broad sanitation suite did not complete promptly and was stopped; five targeted health/deprivation/bathroom tests passed.
