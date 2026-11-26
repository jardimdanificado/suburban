// Collects high-signal simulation events (deaths, combat, council votes,
// decrees, corruption, protests, cleanup programs) for desktop popup notices.

const EVENT_RULES = Object.freeze({
  'death': { title: 'Óbito na cidade', category: 'death' },
  'corpse-devoured': { title: 'Cadáver devorado por animais', category: 'death' },
  'combat-injury': { title: 'Combate e agressão', category: 'combat', cooldownKey: e => `combat:${(e.citizenIds || []).join(',')}`, cooldownMinutes: 30 },
  'citizen-unconscious': { title: 'Morador desacordado', category: 'combat', cooldownKey: e => `unconscious:${(e.citizenIds || []).join(',')}`, cooldownMinutes: 30 },
  'crime-recorded': { title: 'Ocorrência criminal', category: 'justice' },
  'court-conviction': { title: 'Condenação judicial', category: 'justice' },
  'bill-voted': { title: 'Votação na Câmara', category: 'council' },
  'bill-vetoed': { title: 'Veto em tramitação', category: 'council' },
  'bill-executed': { title: 'Projeto de lei executado', category: 'council' },
  'politician-impeached': { title: 'Impeachment / Cassação', category: 'politics' },
  'criminal-mandate-cassation': { title: 'Cassação de mandato', category: 'politics' },
  'corruption-evidence': { title: 'Indício de corrupção', category: 'corruption' },
  'corruption-referred-police': { title: 'Corrupção encaminhada à polícia', category: 'corruption' },
  'environment-cleanup-program': { title: 'Programa de Faxina Urbana', category: 'environment' },
  'protest-started': { title: 'Protesto na cidade', category: 'protest' },
  'party-founded': { title: 'Novo partido fundado', category: 'politics' },
  'party-merger': { title: 'Fusão partidária', category: 'politics' },
  'party-liquidated': { title: 'Partido extinto', category: 'politics' },
});

const DECREE_STATUS_LABELS = Object.freeze({
  'awaiting-secretary-review': 'emitido para análise das secretarias',
  'approved': 'aprovado',
  'rejected': 'vetado pelas secretarias',
  'executed': 'executado',
});

function citizenName(city, id) {
  return id != null ? city.society?.citizen?.(id)?.entity?.properties?.name || `Morador #${id}` : null;
}

function crimeDetailsSummary(city, record) {
  if (!record) return null;
  const label = city.justice?.labelCrime?.(record.type) || record.type;
  const offender = citizenName(city, record.offenderId) || 'autor desconhecido';
  const victim = citizenName(city, record.victimId);
  const buildingId = record.scene?.buildingId ?? record.details?.buildingId;
  const building = buildingId != null ? city.building?.(buildingId) : null;
  const floorText = building && Number.isInteger(record.scene?.floor) ? ` (${record.scene.floor + 1}º andar)` : '';
  const where = building ? `${building.entity.properties.name}${floorText}` : record.position ? `via pública (${Math.floor(record.position.x)}, ${Math.floor(record.position.y)})` : 'local não informado';
  const d = record.details || {};
  const howParts = [];
  if (d.weapon) howParts.push(`arma: ${d.weapon}`);
  if (d.stolenGood) howParts.push(`item: ${d.stolenGood}`);
  if (d.purpose === 'unauthorized-bathroom-use') howParts.push('uso não autorizado de banheiro');
  else if (d.purpose) howParts.push(String(d.purpose));
  if (d.reason) howParts.push(String(d.reason));
  if (d.message) howParts.push(`“${String(d.message).slice(0, 48)}”`);
  if (Number.isFinite(d.amount) && d.amount > 0) howParts.push(`valor ${d.amount}`);
  const how = howParts.length ? ` (${howParts.join(', ')})` : '';
  const against = victim ? ` contra ${victim}` : '';
  const witnesses = record.witnesses?.length ? ` · ${record.witnesses.length} testemunha(s)` : ' · sem testemunhas';
  return {
    title: `Ocorrência: ${label}`,
    text: `${label}${how} por ${offender}${against} em ${where}${witnesses}.`,
    position: record.position || (building ? { x: building.door.x, y: building.door.y } : null),
  };
}

export const DEFAULT_INBOX_TTL_MS = 12000;

function formatSimTime(minute) {
  if (!Number.isFinite(minute)) return '—';
  const day = Math.floor(minute / 1440) + 1;
  const rem = ((Math.floor(minute) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(rem / 60)).padStart(2, '0');
  const mm = String(rem % 60).padStart(2, '0');
  return `Dia ${day}, ${hh}:${mm}`;
}

export function describeSimulationNotice(city, notice) {
  if (!city || !notice) return null;
  const details = [['Horário', formatSimTime(notice.minute)]];
  const people = [];
  const seenPeople = new Set();
  const addPerson = (id, role = 'Envolvido(a)') => {
    if (id == null || seenPeople.has(id)) return;
    const c = city.society?.citizen?.(id);
    if (!c) return;
    seenPeople.add(id);
    const alive = !c.dead && !c.entity?.destroyed;
    const health = Math.round(c.needs?.health ?? 100);
    people.push({
      id: c.id,
      name: c.entity?.properties?.name || `Morador #${c.id}`,
      role,
      alive,
      detail: alive ? `${role} · saúde ${health}%` : `${role} · falecido(a)`,
      position: c.entity ? { x: c.entity.x, y: c.entity.y } : null,
    });
  };
  const buildings = [];
  const seenBuildings = new Set();
  const addBuilding = (id, role = 'Local') => {
    if (id == null || seenBuildings.has(id)) return;
    const b = city.building?.(id);
    if (!b || b.entity?.destroyed) return;
    seenBuildings.add(id);
    buildings.push({
      id: b.id,
      name: b.entity?.properties?.name || `Imóvel #${b.id}`,
      detail: role,
      position: b.door ? { x: b.door.x, y: b.door.y } : { x: b.entity.x, y: b.entity.y },
    });
  };
  const parties = [];
  const seenParties = new Set();
  const addParty = (id, role = 'Partido') => {
    if (id == null || seenParties.has(id)) return;
    const party = city.politics?.party?.(id);
    if (!party) return;
    seenParties.add(id);
    parties.push({ id: party.id, name: `${party.short} · ${party.name}`, detail: role });
  };

  let location = notice.position ? { ...notice.position, label: `${Math.floor(notice.position.x)}, ${Math.floor(notice.position.y)}` } : null;
  const entry = notice.eventId != null ? city.history?.get?.(notice.eventId) : null;
  const data = entry?.data || {};

  if (notice.justiceCaseId != null) {
    const record = city.justice?.cases?.find(c => c.id === notice.justiceCaseId);
    if (record) {
      const label = city.justice?.labelCrime?.(record.type) || record.type;
      details.push(['Tipo', label]);
      details.push(['Severidade', `${Math.round(record.severity || 0)}/100`]);
      details.push(['Situação', record.status || 'registrado']);
      details.push(['Testemunhas', `${record.witnesses?.length || 0}`]);
      const d = record.details || {};
      if (d.weapon) details.push(['Arma / meio', String(d.weapon)]);
      if (d.stolenGood) details.push(['Item envolvido', String(d.stolenGood)]);
      if (d.purpose) details.push(['Circunstância', d.purpose === 'unauthorized-bathroom-use' ? 'uso não autorizado de banheiro' : String(d.purpose)]);
      if (d.reason) details.push(['Motivo / ação', String(d.reason)]);
      if (d.message) details.push(['Mensagem', `“${String(d.message)}”`]);
      if (Number.isFinite(d.amount) && d.amount > 0) details.push(['Valor', `${d.amount}`]);
      addPerson(record.offenderId, 'Autor(a)');
      addPerson(record.victimId, 'Vítima');
      for (const w of (record.witnesses || []).slice(0, 4)) addPerson(w.citizenId, 'Testemunha');
      const bId = record.scene?.buildingId ?? d.buildingId;
      addBuilding(bId, Number.isInteger(record.scene?.floor) ? `Local da ocorrência (${record.scene.floor + 1}º andar)` : 'Local da ocorrência');
      if (!location && record.position) location = { ...record.position, label: `${Math.floor(record.position.x)}, ${Math.floor(record.position.y)}` };
    }
  }

  if (notice.category === 'death') {
    for (const cid of notice.citizenIds || []) {
      addPerson(cid, 'Falecido(a)');
      const body = city.justice?.bodies?.find(b => b.citizenId === cid);
      if (body) {
        if (body.cause) details.push(['Causa', String(body.cause)]);
        if (body.status) details.push(['Situação do corpo', String(body.status)]);
        if (!location && body.position) location = { ...body.position, label: `${Math.floor(body.position.x)}, ${Math.floor(body.position.y)}` };
      }
    }
  }

  if (notice.billId != null) {
    const bill = city.politics?.council?.bills?.find(b => b.id === notice.billId);
    if (bill) {
      details.push(['Proposição', bill.title]);
      details.push(['Tipo', bill.decree ? 'Decreto do Executivo' : 'Projeto de Lei']);
      details.push(['Autor', bill.authorName || 'Câmara Municipal']);
      details.push(['Situação', bill.status]);
      if (bill.votes?.length) {
        const yes = bill.votes.filter(v => v.yes).reduce((s, v) => s + (v.weight || 1), 0);
        const no = bill.votes.filter(v => !v.yes).reduce((s, v) => s + (v.weight || 1), 0);
        details.push(['Placar', `${yes} sim · ${no} não`]);
      }
      if (bill.partyId != null) addParty(bill.partyId, 'Partido autor');
      if (bill.payload?.buildingId != null) addBuilding(bill.payload.buildingId, 'Imóvel vinculado');
    }
  }

  if (data.kind === 'environment-cleanup-program') {
    if (data.opened != null) details.push(['Bicos abertos', `${data.opened}`]);
    if (data.spent != null) details.push(['Verba empenhada', `R$ ${Math.round(data.spent)}`]);
    if (Number.isFinite(data.unemploymentRate)) details.push(['Desemprego', `${Math.round(data.unemploymentRate * 100)}%`]);
    if (Number.isFinite(data.cleanlinessScore)) details.push(['Limpeza urbana', `${data.cleanlinessScore}%`]);
  }

  if (data.buildingId != null) addBuilding(data.buildingId, 'Local citado');
  for (const cid of notice.citizenIds || []) addPerson(cid, 'Envolvido(a)');
  for (const pid of data.partyIds || []) addParty(pid, 'Partido envolvido');
  if (data.partyId != null) addParty(data.partyId, 'Partido');
  if (!location && people[0]?.position) location = { ...people[0].position, label: people[0].name };
  if (!location && buildings[0]?.position) location = { ...buildings[0].position, label: buildings[0].name };

  return {
    title: notice.title,
    summary: notice.text || '',
    details,
    people,
    buildings,
    parties,
    location,
  };
}

export function createSimulationNoticeTracker() {
  return {
    lastEventId: null,
    lastMinute: null,
    billStates: new Map(),
    cooldowns: new Map(),
    queue: [],
    nextNoticeId: 1,
  };
}

export function dismissSimulationNotice(tracker, id) {
  if (!tracker?.queue?.length) return false;
  const idx = tracker.queue.findIndex(item => item.id === id);
  if (idx < 0) return false;
  tracker.queue.splice(idx, 1);
  return true;
}

export function takeSimulationNotice(tracker, id) {
  if (!tracker?.queue?.length) return null;
  const idx = tracker.queue.findIndex(item => item.id === id);
  if (idx < 0) return null;
  return tracker.queue.splice(idx, 1)[0];
}

export function pollSimulationNotices(city, tracker, now = Date.now(), { ttlMs = DEFAULT_INBOX_TTL_MS } = {}) {
  if (!city || !tracker) return [];
  if (tracker.lastMinute != null && city.minute < tracker.lastMinute) {
    tracker.lastEventId = null;
    tracker.billStates.clear();
    tracker.cooldowns.clear();
    tracker.queue.length = 0;
  }
  tracker.lastMinute = city.minute;

  // Discard expired inbox items that the player chose not to open.
  for (let i = tracker.queue.length - 1; i >= 0; i--) {
    const item = tracker.queue[i];
    if (now - (item.receivedAt ?? now) >= (item.durationMs ?? ttlMs)) {
      tracker.queue.splice(i, 1);
    }
  }

  const entries = city.history?.entries || [];
  if (tracker.lastEventId == null) {
    tracker.lastEventId = entries.at(-1)?.id ?? 0;
    for (const bill of city.politics?.council?.bills || []) {
      tracker.billStates.set(bill.id, bill.status);
    }
    return [];
  }

  for (const entry of entries) {
    if (entry.id <= tracker.lastEventId) continue;
    tracker.lastEventId = entry.id;
    const kind = entry.data?.kind;
    const rule = kind && EVENT_RULES[kind];
    if (!rule) continue;
    if (rule.cooldownKey) {
      const cKey = rule.cooldownKey(entry);
      const lastAt = tracker.cooldowns.get(cKey) ?? -Infinity;
      if (city.minute - lastAt < (rule.cooldownMinutes || 30)) continue;
      tracker.cooldowns.set(cKey, city.minute);
    }
    const record = kind === 'crime-recorded' && entry.data?.caseId != null ? city.justice?.cases?.find(c => c.id === entry.data.caseId) : null;
    const crimeInfo = crimeDetailsSummary(city, record);
    tracker.queue.push({
      id: `event:${entry.id}`,
      title: crimeInfo?.title || rule.title,
      category: rule.category,
      text: crimeInfo?.text || entry.text,
      minute: entry.minute ?? city.minute,
      receivedAt: now,
      durationMs: ttlMs,
      eventId: entry.id,
      billId: entry.data?.billId ?? null,
      justiceCaseId: kind === 'crime-recorded' ? (entry.data?.caseId ?? null) : null,
      citizenIds: entry.citizenIds || [],
      position: crimeInfo?.position || null,
      corruptionCaseId: kind !== 'crime-recorded' ? (entry.data?.caseId ?? null) : null,
    });
  }

  for (const bill of city.politics?.council?.bills || []) {
    const prev = tracker.billStates.get(bill.id);
    if (prev === bill.status) continue;
    tracker.billStates.set(bill.id, bill.status);
    if (bill.decree && DECREE_STATUS_LABELS[bill.status]) {
      tracker.queue.push({
        id: `decree:${bill.id}:${bill.status}`,
        title: 'Decreto do Prefeito',
        category: 'decree',
        text: `${bill.title} — ${DECREE_STATUS_LABELS[bill.status]}.`,
        minute: city.minute,
        receivedAt: now,
        durationMs: ttlMs,
        eventId: bill.eventId ?? null,
        billId: bill.id,
        citizenIds: [],
      });
    } else if (prev !== undefined && ['awaiting-sanction', 'approved', 'rejected', 'vetoed'].includes(bill.status)) {
      const label = bill.status === 'awaiting-sanction' ? 'aprovado na Câmara, aguardando sanção'
        : bill.status === 'approved' ? 'aprovado'
        : bill.status === 'rejected' ? 'rejeitado na Câmara'
        : 'vetado pelo prefeito';
      tracker.queue.push({
        id: `bill:${bill.id}:${bill.status}`,
        title: 'Decisão na Câmara',
        category: 'council',
        text: `${bill.title} — ${label}.`,
        minute: city.minute,
        receivedAt: now,
        durationMs: ttlMs,
        eventId: bill.eventId ?? null,
        billId: bill.id,
        citizenIds: [],
      });
    }
  }

  if (tracker.queue.length > 12) tracker.queue.splice(0, tracker.queue.length - 12);
  return tracker.queue;
}
