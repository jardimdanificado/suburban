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

export function pollSimulationNotices(city, tracker) {
  if (!city || !tracker) return [];
  if (tracker.lastMinute != null && city.minute < tracker.lastMinute) {
    tracker.lastEventId = null;
    tracker.billStates.clear();
    tracker.cooldowns.clear();
    tracker.queue.length = 0;
  }
  tracker.lastMinute = city.minute;

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
        eventId: bill.eventId ?? null,
        billId: bill.id,
        citizenIds: [],
      });
    }
  }

  if (tracker.queue.length > 40) tracker.queue.splice(0, tracker.queue.length - 40);
  return tracker.queue;
}
