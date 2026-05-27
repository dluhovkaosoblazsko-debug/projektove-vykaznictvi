import React from 'react';
import { CalendarDays, Download, Filter, Save, Users } from 'lucide-react';

import { CheckboxField, EmptyState, InputField, Panel, SelectField, TextAreaField } from '../components/ui.jsx';
import { WORKERS } from '../config/projectConfig.js';
import { computedIndicatorsMap, truncate } from '../lib/projectUtils.js';

function Ka01View({
  ka01Draft,
  setKa01Draft,
  ka01ActorDraft,
  setKa01ActorDraft,
  ka01ActorOptions,
  ka01ActorCustomValue,
  updateKa01ActorEntry,
  ka01PlaceOptions,
  ka01PlaceCustomValue,
  updateKa01PlaceSelection,
  updateKa01PlaceCustom,
  clients,
  handleSaveKa01Assessment,
  isSaving,
  ka01NetworkDuration,
  ka01StartTimeSuggestions,
  ka01EndTimeSuggestions,
  editingKa01NetworkRecordId,
  handleSaveKa01Network,
  handleSaveKa01ActorRegistry,
  toggleKa01ActorAttendance,
  ka01AttendanceSelection,
  exportKa01AttendanceSheet,
  handleEditKa01ActorRegistry,
  exportKa01NetworkBulk,
  ka01NetworkTimeError,
  cancelKa01NetworkEdit,
  ka01NetworkRecords,
  ka01ActorRegistryRecords,
  expandedKa01NetworkRecordIds,
  toggleKa01NetworkDescription,
  exportKa01NetworkDocx,
  handleEditKa01Network,
  deleteRecord,
  computedIndicators,
  formatDurationFromTimes
}) {
  const [expandedActorDetailIds, setExpandedActorDetailIds] = React.useState([]);
  const workdayTimeOptions = React.useMemo(
    () =>
      Array.from({ length: 21 }, (_, index) => {
        const totalMinutes = 7 * 60 + index * 30;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = String(totalMinutes % 60).padStart(2, '0');
        return `${hours}:${minutes}`;
      }),
    []
  );
  const timeOptionsWithValue = (value) =>
    value && !workdayTimeOptions.includes(value) ? [value, ...workdayTimeOptions] : workdayTimeOptions;
  const isTeamMeeting = ka01Draft.networkType === 'porada týmu';
  const isNetworkActorsActivity = ka01Draft.networkType === 'síť aktérů';
  const registryActorOptions = React.useMemo(() => {
    const uniqueNames = Array.from(
      new Set(
        (Array.isArray(ka01ActorRegistryRecords) ? ka01ActorRegistryRecords : [])
          .map((record) => String(record?.payload?.name || '').trim())
          .filter(Boolean)
      )
    );
    return [
      ...uniqueNames.map((name) => ({ value: name, label: name })),
      { value: ka01ActorCustomValue, label: 'Jiná osoba (ručně)' }
    ];
  }, [ka01ActorRegistryRecords, ka01ActorCustomValue]);
  const actorOptionsForType = isTeamMeeting
    ? WORKERS
        .filter((worker) => worker !== ka01Draft.worker)
        .map((worker) => ({ value: worker, label: worker }))
        .concat([{ value: ka01ActorCustomValue, label: 'Další člen porady (ručně)' }])
    : isNetworkActorsActivity
      ? registryActorOptions
      : ka01ActorOptions;
  const indicatorMap = computedIndicatorsMap(computedIndicators);
  const emptyMetric = { current: 0, target: 0 };
  const ka01MeetingMetric = indicatorMap.ka01Meetings || emptyMetric;
  const ka01TeamMetric = indicatorMap.ka01TeamMeetings || emptyMetric;
  const ka01NetworkMetric = indicatorMap.ka01NetworkSize || emptyMetric;
  const normalizeForCompare = (value) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const normalizeUnknownValue = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return /(neuveden|nedohled)/i.test(text) ? '' : text;
  };
  const isCheckedValue = (value) => {
    if (value === true) return true;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['true', 'ano', '1', 'yes'].includes(value.trim().toLowerCase());
    return false;
  };
  const isCompleteActorIdentity = (record) => {
    const payload = record?.payload || {};
    const fullName = normalizeUnknownValue(payload.contactName);
    const fallbackTokens = fullName.split(/\s+/).filter(Boolean);
    const titleRegex = /^(Mgr\.?|Ing\.?|Bc\.?|JUDr\.?|MUDr\.?|PhDr\.?|doc\.?|prof\.?|DiS\.?)$/i;
    const title = normalizeUnknownValue(payload.contactTitle)
      || (fallbackTokens.length > 0 && titleRegex.test(fallbackTokens[0]) ? fallbackTokens[0] : '');
    const firstName = normalizeUnknownValue(payload.contactFirstName)
      || (fallbackTokens.length > 0 ? (title ? (fallbackTokens[1] || '') : fallbackTokens[0]) : '');
    const lastName = normalizeUnknownValue(payload.contactLastName)
      || (fallbackTokens.length > 0 ? fallbackTokens.slice(title ? 2 : 1).join(' ') : '');
    const subject = normalizeUnknownValue(payload.name);
    return Boolean(firstName && lastName && subject);
  };
  const sortedKa01ActorRegistryRecords = [...ka01ActorRegistryRecords].sort((a, b) => {
    const aComplete = isCompleteActorIdentity(a) ? 1 : 0;
    const bComplete = isCompleteActorIdentity(b) ? 1 : 0;
    return bComplete - aComplete;
  });
  const resolveActorOrigin = (record) => {
    const origin = String(record?.payload?.networkOrigin || '').trim().toLowerCase();
    if (origin.includes('vychozi')) return 'vychozi';
    if (origin.includes('nov')) return 'novy';
    return String(record?.id || '').startsWith('seed-ka01-actor-') ? 'vychozi' : 'novy';
  };
  const actorOriginStats = sortedKa01ActorRegistryRecords.reduce(
    (accumulator, record) => {
      const origin = resolveActorOrigin(record);
      if (origin === 'vychozi') accumulator.base += 1;
      if (origin === 'novy') accumulator.new += 1;
      return accumulator;
    },
    { base: 0, new: 0 }
  );
  const activeActorCount = (() => {
    const activeIds = new Set();
    const actorRoleFields = [
      'roleRecruitment',
      'roleClientReferral',
      'roleMaterialDistribution',
      'roleJobOpportunities',
      'roleTpm',
      'roleHpp',
      'roleFollowupService'
    ];
    sortedKa01ActorRegistryRecords.forEach((record) => {
      const payload = record.payload || {};
      if (actorRoleFields.some((field) => isCheckedValue(payload[field]))) {
        activeIds.add(record.id);
      }
    });

    const normalizedActorMap = sortedKa01ActorRegistryRecords.map((record) => ({
      id: record.id,
      name: normalizeForCompare(record.payload?.name)
    }));
    ka01NetworkRecords.forEach((record) => {
      const participants = normalizeForCompare(record?.payload?.participants || '');
      if (!participants) return;
      normalizedActorMap.forEach((actor) => {
        if (actor.name && participants.includes(actor.name)) {
          activeIds.add(actor.id);
        }
      });
    });
    return activeIds.size;
  })();
  const toggleActorDetail = (recordId) => {
    setExpandedActorDetailIds((prev) =>
      prev.includes(recordId) ?prev.filter((item) => item !== recordId) : [...prev, recordId]
    );
  };
  const formatActivityDateLabel = (value) => {
    if (!value) return 'Bez data';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('cs-CZ', {
      day: 'numeric',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  return (
          <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold uppercase tracking-wide text-slate-300">KA01 plnění:</span>
                <span>Koordinační setkání <strong>{ka01MeetingMetric.current}</strong>/<span className="text-slate-300">{ka01MeetingMetric.target}</span></span>
                <span>Porady týmu <strong>{ka01TeamMetric.current}</strong>/<span className="text-slate-300">{ka01TeamMetric.target}</span></span>
                <span>Síť <strong>{ka01NetworkMetric.current}</strong>/<span className="text-slate-300">{ka01NetworkMetric.target}</span></span>
                <span>Výchozí aktéři <strong>{actorOriginStats.base}</strong></span>
                <span>Nově přidaní <strong>{actorOriginStats.new}</strong></span>
                <span>Aktivně zapojení <strong>{activeActorCount}</strong></span>
              </div>
            </div>
            {false && (
            <Panel title="KA01 - Vstupní posouzení klienta" description="Formální, obsahová a motivační kritéria včetně čekací listiny." icon={Filter}>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datum</label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        id="ka01-date-input"
                        type="date"
                        value={ka01Draft.date}
                        onChange={(event) => setKa01Draft((prev) => ({ ...prev, date: event.target.value }))}
                        onFocus={(event) => event.currentTarget.showPicker?.()}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('ka01-date-input')?.showPicker?.()}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                        aria-label="Otevřít kalendář"
                        title="Otevřít kalendář"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <SelectField
                    label="Pracovník"
                    value={ka01Draft.worker}
                    onChange={(value) => setKa01Draft((prev) => ({ ...prev, worker: value }))}
                    options={WORKERS.map((worker) => ({ value: worker, label: worker }))}
                  />
                </div>
                <SelectField
                  label="Klient"
                  value={ka01Draft.assessmentClientId}
                  onChange={(value) => setKa01Draft((prev) => ({ ...prev, assessmentClientId: value }))}
                  options={clients.map((client) => ({ value: client.id, label: client.fullName }))}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <CheckboxField
                    label="Formální kritéria splněna"
                    checked={ka01Draft.formalCriteriaMet}
                    onChange={(checked) => setKa01Draft((prev) => ({ ...prev, formalCriteriaMet: checked }))}
                  />
                  <CheckboxField
                    label="Zařadit na čekací listinu"
                    checked={ka01Draft.waitingList}
                    onChange={(checked) => setKa01Draft((prev) => ({ ...prev, waitingList: checked }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputField label="Počet obsahových kritérií" value={ka01Draft.contentCriteriaCount} onChange={(value) => setKa01Draft((prev) => ({ ...prev, contentCriteriaCount: value }))} />
                  <SelectField
                    label="Míra motivace"
                    value={ka01Draft.motivationLevel}
                    onChange={(value) => setKa01Draft((prev) => ({ ...prev, motivationLevel: value }))}
                    options={[
                      { value: 'nízká', label: 'Nízká' },
                      { value: 'střední', label: 'Střední' },
                      { value: 'vysoká', label: 'Vysoká' }
                    ]}
                  />
                </div>
                <SelectField
                  label="Rozhodnutí"
                  value={ka01Draft.decision}
                  onChange={(value) => setKa01Draft((prev) => ({ ...prev, decision: value }))}
                  options={[
                    { value: 'accepted', label: 'Přijat do projektu' },
                    { value: 'waiting', label: 'Čekací listina' },
                    { value: 'rejected', label: 'Nezařazen' }
                  ]}
                />
                <TextAreaField label="Odůvodnění a poznámka" value={ka01Draft.rationale} onChange={(value) => setKa01Draft((prev) => ({ ...prev, rationale: value }))} />
                <button
                  onClick={handleSaveKa01Assessment}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  Uložit posouzení
                </button>
              </div>
            </Panel>
            )}

            <Panel title="KA01 - Zápis výkonů" description="Jednotná evidence výkonů KA01: koordinační setkání, porady a náborové kroky." icon={Users} className="w-full min-w-0">
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datum</label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input
                        id="ka01-date-input"
                        type="date"
                        value={ka01Draft.date}
                        onChange={(event) => setKa01Draft((prev) => ({ ...prev, date: event.target.value }))}
                        onFocus={(event) => event.currentTarget.showPicker?.()}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('ka01-date-input')?.showPicker?.()}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                        aria-label="Otevřít kalendář"
                        title="Otevřít kalendář"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <SelectField
                    label="Pracovník"
                    value={ka01Draft.worker}
                    onChange={(value) => setKa01Draft((prev) => ({ ...prev, worker: value }))}
                    options={WORKERS.map((worker) => ({ value: worker, label: worker }))}
                  />
                  <SelectField
                    label="Typ aktivity"
                    value={ka01Draft.networkType}
                    onChange={(value) => setKa01Draft((prev) => ({ ...prev, networkType: value }))}
                    options={[
                      { value: 'koordinační setkání', label: 'Koordinační setkání' },
                      { value: 'porada týmu', label: 'Porada týmu' },
                      { value: 'síť aktérů', label: 'Rozšíření nebo udržení sítě' }
                    ]}
                  />
                  <InputField label="Počet účastníků" value={ka01Draft.networkCount} onChange={(value) => setKa01Draft((prev) => ({ ...prev, networkCount: value }))} />
                </div>
                <div className="grid items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-[88px_88px_minmax(120px,150px)_minmax(180px,1fr)_minmax(240px,1.2fr)]">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">OD</label>
                    <select
                      value={ka01Draft.networkStartTime}
                      onChange={(event) => setKa01Draft((prev) => ({ ...prev, networkStartTime: event.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Vyber čas</option>
                      {timeOptionsWithValue(ka01Draft.networkStartTime).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">DO</label>
                    <select
                      value={ka01Draft.networkEndTime}
                      onChange={(event) => setKa01Draft((prev) => ({ ...prev, networkEndTime: event.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Vyber čas</option>
                      {timeOptionsWithValue(ka01Draft.networkEndTime).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Trvání</label>
                    <div className="flex h-9 items-center rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                      {ka01NetworkDuration || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Místo setkání</label>
                    <div className={`grid gap-2 ${ka01Draft.networkPlaceType === ka01PlaceCustomValue ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                      <select
                        value={ka01Draft.networkPlaceType || ''}
                        onChange={(event) => updateKa01PlaceSelection(event.target.value)}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Vyber místo…</option>
                        {ka01PlaceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {ka01Draft.networkPlaceType === ka01PlaceCustomValue && (
                        <input
                          type="text"
                          value={ka01Draft.networkPlaceCustom || ''}
                          onChange={(event) => updateKa01PlaceCustom(event.target.value)}
                          placeholder="Zadej jiné místo"
                          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{isTeamMeeting ?'Probírané body porady' : 'Obsah a výsledek aktivity'}</label>
                    <textarea
                      value={ka01Draft.networkNotes}
                      onChange={(event) => setKa01Draft((prev) => ({ ...prev, networkNotes: event.target.value }))}
                      rows={2}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Zapojení aktéři</label>
                  <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {(ka01Draft.networkActorEntries || []).map((entry, index) => (
                      <div key={`actor-${index}`} className="min-w-[300px] flex-1 rounded-md border border-slate-200 bg-white p-2">
                        <select
                          value={entry.actorType || ''}
                          onChange={(event) =>
                            updateKa01ActorEntry(index, {
                              actorType: event.target.value,
                              customName: event.target.value === ka01ActorCustomValue ?entry.customName || '' : ''
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          >
                            <option value="">Vyber aktéra…</option>
                            {actorOptionsForType.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        {entry.actorType === ka01ActorCustomValue && (
                          <input
                            type="text"
                            value={entry.customName || ''}
                            onChange={(event) => updateKa01ActorEntry(index, { customName: event.target.value })}
                            placeholder="Jméno a role osoby"
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {editingKa01NetworkRecordId && (
                  <TextAreaField
                    label="Popis aktivity"
                    value={ka01Draft.networkDescription}
                    onChange={(value) => setKa01Draft((prev) => ({ ...prev, networkDescription: value }))}
                    rows={4}
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveKa01Network}
                    disabled={isSaving}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {editingKa01NetworkRecordId ?'Uložit úpravu' : 'Uložit aktivitu'}
                  </button>
                  <button
                    type="button"
                    onClick={exportKa01NetworkBulk}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Download className="h-4 w-4" />
                    Hromadné stažení uložených aktivit
                  </button>
                  {ka01NetworkTimeError && (
                    <span className="inline-flex items-center rounded-lg px-1 text-sm font-semibold text-red-600">
                      {ka01NetworkTimeError}
                    </span>
                  )}
                  {editingKa01NetworkRecordId && (
                    <button
                      type="button"
                      onClick={cancelKa01NetworkEdit}
                      disabled={isSaving}
                      className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Zrušit úpravu
                    </button>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-sm font-bold text-slate-900">Uložené aktivity KA01</div>
                  {ka01NetworkRecords.length === 0 ?(
                    <EmptyState icon={Users} title="Zatím není uložená žádná síťová aktivita KA01." />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="max-h-[420px] overflow-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="sticky top-0 z-[1] bg-blue-50 text-xs font-semibold uppercase tracking-wide text-blue-800">
                            <tr>
                              <th className="px-3 py-2 text-left">Datum</th>
                              <th className="px-3 py-2 text-left">Čas</th>
                              <th className="px-3 py-2 text-left">Typ aktivity</th>
                              <th className="px-3 py-2 text-right">Počet</th>
                              <th className="px-3 py-2 text-left">Popis aktivity</th>
                              <th className="px-3 py-2 text-left">Pracovník</th>
                              <th className="px-3 py-2 text-right">Akce</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ka01NetworkRecords.map((record) => {
                              const description = record.payload?.description || record.payload?.notes || record.payload?.participants || 'Neuvedeno';
                              const isExpanded = Array.isArray(expandedKa01NetworkRecordIds)
                                ? expandedKa01NetworkRecordIds.includes(record.id)
                                : false;

                              return (
                                <tr key={record.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-blue-50/50">
                                  <td className="whitespace-nowrap px-2 py-1 font-medium text-slate-800">{formatActivityDateLabel(record.activityDate)}</td>
                                  <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                                    {record.payload?.startTime || record.payload?.endTime ?(
                                      <span>
                                        {record.payload?.startTime || '?'}-{record.payload?.endTime || '?'}
                                        {' '}
                                        <span className="text-slate-500">({record.payload?.duration || formatDurationFromTimes(record.payload?.startTime, record.payload?.endTime)})</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">Neuvedeno</span>
                                    )}
                                  </td>
                                  <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-1 text-slate-700" title={record.payload?.type || record.payload?.networkType || record.title || 'Neuvedeno'}>{record.payload?.type || record.payload?.networkType || record.title || 'Neuvedeno'}</td>
                                  <td className="whitespace-nowrap px-2 py-1 text-right font-semibold text-slate-900">{record.payload?.count || 0}</td>
                                  <td className="max-w-[360px] px-2 py-1 text-slate-700">
                                    <div className="flex items-start gap-2">
                                      <div
                                        className={`min-w-0 ${isExpanded ? 'whitespace-pre-wrap break-words leading-5' : 'truncate whitespace-nowrap'}`}
                                        title={description}
                                      >
                                        {isExpanded ? description : truncate(description, 120)}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => toggleKa01NetworkDescription?.(record.id)}
                                        className="shrink-0 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
                                      >
                                        {isExpanded ?'Méně' : 'Zobrazit více'}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="max-w-[140px] truncate whitespace-nowrap px-2 py-1 text-slate-600" title={record.worker || 'Neuvedeno'}>{record.worker || 'Neuvedeno'}</td>
                                  <td className="whitespace-nowrap px-2 py-1 text-right">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => exportKa01NetworkDocx(record)}
                                        className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-100"
                                      >
                                        Stáhnout DOCX
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditKa01Network(record)}
                                        disabled={isSaving}
                                        className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                                      >
                                        Upravit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteRecord(record)}
                                        disabled={isSaving}
                                        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                      >
                                        Smazat
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Panel>

	            <Panel title="KA01 - Síť aktérů" description="Registr aktérů a jejich rolí." icon={Users} className="w-full min-w-0 overflow-hidden">
	              <div className="grid min-w-0 gap-2.5">
                <div className="grid min-w-0 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  <InputField label="Název subjektu" value={ka01ActorDraft.name} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, name: value }))} />
                  <SelectField
                    label="Původ sítě"
                    value={ka01ActorDraft.networkOrigin || ''}
                    onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, networkOrigin: value }))}
                    options={[
                      { value: '', label: 'Automaticky podle kontextu' },
                      { value: 'výchozí síť', label: 'Výchozí síť' },
                      { value: 'nově přidaný v realizaci', label: 'Nově přidaný v realizaci' }
                    ]}
                  />
                  <SelectField
                    label="Typ aktéra"
                    value={ka01ActorDraft.actorType}
                    onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, actorType: value }))}
                    options={[
                      { value: 'obec', label: 'Obec' },
                      { value: 'ÚP', label: 'ÚP' },
                      { value: 'zaměstnavatel', label: 'Zaměstnavatel' },
                      { value: 'sociální služba', label: 'Sociální služba' },
                      { value: 'škola', label: 'Škola' },
                      { value: 'zdravotní služba', label: 'Zdravotní služba' },
                      { value: 'právní poradna', label: 'Právní poradna' },
                      { value: 'jiný subjekt', label: 'Jiný subjekt' }
                    ]}
                  />
                  <InputField label="IČO" value={ka01ActorDraft.ico} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, ico: value }))} />
                  <InputField label="Území působnosti" value={ka01ActorDraft.municipality} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, municipality: value }))} />
                  <InputField label="Web / kontakt" value={ka01ActorDraft.web} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, web: value }))} />
                  <InputField label="Kontaktní osoba" value={ka01ActorDraft.contactName} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, contactName: value }))} />
                  <InputField label="Funkce" value={ka01ActorDraft.contactRole} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, contactRole: value }))} />
                  <InputField label="Telefon" value={ka01ActorDraft.phone} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, phone: value }))} />
                  <InputField label="E-mail" value={ka01ActorDraft.email} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, email: value }))} />
                  <InputField label="Datum zapojení" value={ka01ActorDraft.joinedNetworkDate} onChange={(value) => setKa01ActorDraft((prev) => ({ ...prev, joinedNetworkDate: value }))} />
                </div>
	                <div className="grid min-w-0 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <CheckboxField compact label="Nábor klientů" checked={ka01ActorDraft.roleRecruitment} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleRecruitment: checked }))} />
                  <CheckboxField compact label="Doporučuje klienty" checked={ka01ActorDraft.roleClientReferral} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleClientReferral: checked }))} />
                  <CheckboxField compact label="Distribuuje materiály" checked={ka01ActorDraft.roleMaterialDistribution} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleMaterialDistribution: checked }))} />
                  <CheckboxField compact label="Zaměstnavatel" checked={ka01ActorDraft.roleJobOpportunities} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleJobOpportunities: checked }))} />
                  <CheckboxField compact label="Poskytuje TPM" checked={ka01ActorDraft.roleTpm} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleTpm: checked }))} />
                  <CheckboxField compact label="Poskytuje HPP" checked={ka01ActorDraft.roleHpp} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleHpp: checked }))} />
                  <CheckboxField compact label="Návazná služba" checked={ka01ActorDraft.roleFollowupService} onChange={(checked) => setKa01ActorDraft((prev) => ({ ...prev, roleFollowupService: checked }))} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={handleSaveKa01ActorRegistry}
                    disabled={isSaving}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Ukládám…' : (ka01ActorDraft.id ? 'Uložit úpravu aktéra' : 'Uložit aktéra do registru')}
                  </button>
                  <button
                    type="button"
                    onClick={exportKa01AttendanceSheet}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Download className="h-4 w-4" />
                    Vytvořit prezenční listinu
                  </button>
                </div>
                <div>
                  <div className="mb-2 text-sm font-bold text-slate-900">Uložený registr aktérů</div>
                  {sortedKa01ActorRegistryRecords.length === 0 ?(
                    <EmptyState icon={Users} title="Zatím není uložen žádný aktér v síti." />
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
	                      <div className="max-h-[360px] overflow-auto">
	                        <table className="min-w-full table-fixed divide-y divide-slate-200 text-xs">
	                          <thead className="sticky top-0 z-[1] bg-sky-50 text-xs font-semibold uppercase tracking-wide text-sky-800">
	                            <tr>
	                              <th className="w-14 px-2 py-1 text-left">Titul</th>
	                              <th className="w-24 px-2 py-1 text-left">Jméno</th>
	                              <th className="w-28 px-2 py-1 text-left">Příjmení</th>
	                              <th className="px-2 py-1 text-left">Subjekt</th>
	                              <th className="w-40 px-2 py-1 text-left">Původ</th>
	                              <th className="w-28 px-2 py-1 text-left">Prezenční listina</th>
	                              <th className="w-44 px-2 py-1 text-right">Akce</th>
	                            </tr>
	                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sortedKa01ActorRegistryRecords.map((record) => {
                              const payload = record.payload || {};
                              const fullName = normalizeUnknownValue(payload.contactName);
                              const fallbackTokens = fullName.split(/\s+/).filter(Boolean);
                              const titleRegex = /^(Mgr\.?|Ing\.?|Bc\.?|JUDr\.?|MUDr\.?|PhDr\.?|doc\.?|prof\.?|DiS\.?)$/i;
                              const title = normalizeUnknownValue(payload.contactTitle)
                                || (fallbackTokens.length > 0 && titleRegex.test(fallbackTokens[0]) ? fallbackTokens[0] : '');
                              const firstName = normalizeUnknownValue(payload.contactFirstName)
                                || (fallbackTokens.length > 0 ? (title ? (fallbackTokens[1] || '') : fallbackTokens[0]) : '');
                              const lastName = normalizeUnknownValue(payload.contactLastName)
                                || (fallbackTokens.length > 0 ? fallbackTokens.slice(title ? 2 : 1).join(' ') : '');
                              const subject = normalizeUnknownValue(payload.name);
                              const canIncludeInAttendance = Boolean(firstName && lastName && subject);
                              const roleLabels = [
                                isCheckedValue(payload.roleRecruitment) ? 'Nábor' : '',
                                isCheckedValue(payload.roleClientReferral) ? 'Doporučuje klienty' : '',
                                isCheckedValue(payload.roleMaterialDistribution) ? 'Materiály' : '',
                                isCheckedValue(payload.roleJobOpportunities) ? 'Zaměstnavatel' : '',
                                isCheckedValue(payload.roleTpm) ? 'TPM' : '',
                                isCheckedValue(payload.roleHpp) ? 'HPP' : '',
                                isCheckedValue(payload.roleFollowupService) ? 'Návazná služba' : ''
                              ].filter(Boolean);
                              const detailLine = [
                                payload.actorType ? `Typ: ${payload.actorType}` : '',
                                payload.contactRole ? `Funkce: ${payload.contactRole}` : '',
                                payload.ico ? `IČO: ${payload.ico}` : '',
                                payload.phone ? `Tel.: ${payload.phone}` : '',
                                payload.email ? `E-mail: ${payload.email}` : '',
                                payload.web ? `Web: ${payload.web}` : '',
                                payload.municipality ? `Území: ${payload.municipality}` : ''
                              ].filter(Boolean).join(' | ');
	                              const detailsOpen = expandedActorDetailIds.includes(record.id);
	                              return (
	                              <React.Fragment key={record.id}>
	                                <tr className="odd:bg-white even:bg-slate-50/60">
	                                  <td className="truncate px-2 py-1 text-slate-700" title={title || '-'}>{title || '-'}</td>
	                                  <td className="truncate px-2 py-1 text-slate-700" title={firstName || '-'}>{firstName || '-'}</td>
	                                  <td className="truncate px-2 py-1 text-slate-700" title={lastName || '-'}>{lastName || '-'}</td>
	                                  <td className="px-2 py-1 font-semibold text-slate-900">
	                                    <div className="truncate" title={subject || record.title || '-'}>
	                                      {subject || record.title || '-'}
	                                    </div>
	                                    <div className="truncate text-[10px] font-normal text-slate-500" title={roleLabels.length ? `Role: ${roleLabels.join(', ')}` : '-'}>
	                                      {[
	                                        roleLabels.length ? `Role: ${roleLabels.join(', ')}` : ''
	                                      ].filter(Boolean).join(' | ') || '-'}
	                                    </div>
	                                  </td>
                                  <td className="px-2 py-1 text-slate-700">
                                    <span className="truncate" title={payload.networkOrigin || '-'}>
                                      {payload.networkOrigin || '-'}
                                    </span>
                                  </td>
	                                  <td className="px-2 py-1 text-slate-700">
	                                    <label className="inline-flex items-center gap-2">
	                                      <input
	                                        type="checkbox"
	                                        checked={Boolean(ka01AttendanceSelection?.[record.id])}
	                                        onChange={(event) => toggleKa01ActorAttendance(record.id, event.target.checked)}
	                                        disabled={!canIncludeInAttendance}
	                                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
	                                      />
	                                      <span className="truncate">{canIncludeInAttendance ? 'Ano' : 'Doplň údaje'}</span>
	                                    </label>
	                                  </td>
	                                  <td className="whitespace-nowrap px-2 py-1 text-right">
	                                    <button type="button" onClick={() => toggleActorDetail(record.id)} className="mr-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50">
	                                      {detailsOpen ? 'Skrýt' : 'Podrobnosti'}
	                                    </button>
	                                    <button type="button" onClick={() => handleEditKa01ActorRegistry(record)} className="mr-2 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 hover:bg-blue-100">
	                                      Upravit
	                                    </button>
	                                    <button type="button" onClick={() => deleteRecord(record)} disabled={isSaving} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 hover:bg-red-100 disabled:opacity-50">
	                                      Smazat
	                                    </button>
	                                  </td>
	                                </tr>
	                                {detailsOpen && (
	                                  <tr className="bg-white">
	                                    <td colSpan={7} className="px-3 py-2 text-[11px] leading-relaxed text-slate-600">
	                                      {detailLine || 'Žádné další podrobnosti nejsou vyplněny.'}
	                                    </td>
	                                  </tr>
	                                )}
	                              </React.Fragment>
	                            )})}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </div>
  );
}

export default Ka01View;


