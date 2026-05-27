import React from 'react';
import { Briefcase, CalendarDays, Save } from 'lucide-react';

import { EmptyState, InputField, Panel, SelectField, TextAreaField } from '../components/ui.jsx';
import { computedIndicatorsMap } from '../lib/projectUtils.js';
import ClientPlanSidebar from './ClientPlanSidebar.jsx';

function Ka03View({
  ka03Draft,
  setKa03Draft,
  setGeneratorDraft,
  clients,
  handleSaveKa03,
  isSaving,
  tpmRecords,
  employmentRecords,
  mentorReportRecords,
  deleteRecord,
  renderAiDocumentPanel,
  ka03AiDocumentKeys,
  getPlanGoalOptions,
  computedIndicators
}) {
  const indicatorMap = computedIndicatorsMap(computedIndicators || []);
  const tpm = indicatorMap.ka03TpmRecords || { current: 0, target: 0 };
  const employment = indicatorMap.ka03EmploymentRecords || { current: 0, target: 0 };
  const mentorReports = indicatorMap.ka03MentorReports || { current: 0, target: 0 };
  const [expandedTpmIds, setExpandedTpmIds] = React.useState([]);
  const [expandedMentorReportIds, setExpandedMentorReportIds] = React.useState([]);
  const toggleTpmDetails = (recordId) => {
    setExpandedTpmIds((prev) => (prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId]));
  };
  const toggleMentorReport = (reportId) => {
    setExpandedMentorReportIds((prev) => (prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]));
  };
  const getMentorReportsForTpm = (tpmRecord) =>
    (mentorReportRecords || []).filter((record) => {
      const linkedTpmId = record.payload?.tpmRecordId || '';
      if (linkedTpmId) return linkedTpmId === tpmRecord.id;
      return record.clientId === tpmRecord.clientId;
    });
  const hasMentorReportForTpm = (tpmRecord) =>
    Boolean(tpmRecord?.id) && getMentorReportsForTpm(tpmRecord).length > 0;
  const tpmGoalOptions = getPlanGoalOptions?.(ka03Draft.tpmClientId || ka03Draft.selectedClientId) || [];
  const employmentGoalOptions = getPlanGoalOptions?.(ka03Draft.employmentClientId || ka03Draft.selectedClientId) || [];
  const goalSelectOptions = (options) => [
    { value: '', label: options.length ? 'Vyber cíl...' : 'Nejdřív doplň cíl v IPR' },
    ...options
  ];
  const updateGoalLink = (fieldPrefix, options, goalId) => {
    const selected = options.find((goal) => goal.value === goalId);
    setKa03Draft((prev) => ({
      ...prev,
      [`${fieldPrefix}LinkedPlanGoalId`]: goalId,
      [`${fieldPrefix}LinkedPlanGoalLabel`]: selected?.label || ''
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold uppercase tracking-wide text-slate-300">KA03 plnění:</span>
          <span>TPM <strong>{tpm.current}</strong>/<span className="text-slate-300">{tpm.target}</span></span>
          <span>HPP <strong>{employment.current}</strong>/<span className="text-slate-300">{employment.target}</span></span>
          <span>Zprávy mentora <strong>{mentorReports.current}</strong>/<span className="text-slate-300">{mentorReports.target}</span></span>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <ClientPlanSidebar
          clients={clients}
          selectedClientId={ka03Draft.selectedClientId || ka03Draft.tpmClientId || ka03Draft.employmentClientId}
          onClientChange={(clientId) => {
            setKa03Draft((prev) => ({
              ...prev,
              selectedClientId: clientId,
              tpmClientId: clientId,
              employmentClientId: clientId,
              tpmLinkedPlanGoalId: '',
              tpmLinkedPlanGoalLabel: '',
              employmentLinkedPlanGoalId: '',
              employmentLinkedPlanGoalLabel: ''
            }));
            setGeneratorDraft((prev) => ({
              ...prev,
              clientId,
              linkedPlanGoalId: '',
              linkedPlanGoalLabel: ''
            }));
          }}
        />
        <div className="min-w-0 space-y-4">
      <Panel title="KA03 - Vytvořit TPM a HPP" description="Rychlé založení tréninkového pracovního místa nebo pracovního uplatnění a okamžitý přehled uložených záznamů." icon={Briefcase}>
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <div className="self-start space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Nové TPM</div>
              <p className="mt-1 text-xs text-slate-600">Založení tréninkového pracovního místa pro vybraného klienta.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Cíl IPR *"
                value={ka03Draft.tpmLinkedPlanGoalId || ''}
                onChange={(value) => updateGoalLink('tpm', tpmGoalOptions, value)}
                options={goalSelectOptions(tpmGoalOptions)}
              />
              <InputField label="Zaměstnavatel" value={ka03Draft.employer} onChange={(value) => setKa03Draft((prev) => ({ ...prev, employer: value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datum záznamu TPM</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  id="ka03-tpm-record-date"
                  type="date"
                  value={ka03Draft.tpmDate || ''}
                  onChange={(event) => setKa03Draft((prev) => ({ ...prev, tpmDate: event.target.value }))}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('ka03-tpm-record-date')?.showPicker?.()}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                  aria-label="Otevřít kalendář"
                  title="Otevřít kalendář"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Začátek</label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    id="ka03-tpm-start-date"
                    type="date"
                    value={ka03Draft.startDate}
                    onChange={(event) => setKa03Draft((prev) => ({ ...prev, startDate: event.target.value }))}
                    onFocus={(event) => event.currentTarget.showPicker?.()}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('ka03-tpm-start-date')?.showPicker?.()}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                    aria-label="Otevřít kalendář"
                    title="Otevřít kalendář"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Konec</label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    id="ka03-tpm-end-date"
                    type="date"
                    value={ka03Draft.endDate}
                    onChange={(event) => setKa03Draft((prev) => ({ ...prev, endDate: event.target.value }))}
                    onFocus={(event) => event.currentTarget.showPicker?.()}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('ka03-tpm-end-date')?.showPicker?.()}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                    aria-label="Otevřít kalendář"
                    title="Otevřít kalendář"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              <InputField label="Plánovaný počet měsíců" value={ka03Draft.plannedMonths} onChange={(value) => setKa03Draft((prev) => ({ ...prev, plannedMonths: value }))} />
            </div>
            <button
              onClick={() => handleSaveKa03('tpm_records')}
              disabled={isSaving}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Uložit TPM
            </button>
          </div>

          <div className="self-start space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Nové HPP / pracovní uplatnění</div>
              <p className="mt-1 text-xs text-slate-600">Záznam nástupu do zaměstnání nebo jiné formy uplatnění.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Cíl IPR *"
                value={ka03Draft.employmentLinkedPlanGoalId || ''}
                onChange={(value) => updateGoalLink('employment', employmentGoalOptions, value)}
                options={goalSelectOptions(employmentGoalOptions)}
              />
              <InputField label="Zaměstnavatel" value={ka03Draft.employer} onChange={(value) => setKa03Draft((prev) => ({ ...prev, employer: value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Datum záznamu HPP</label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  id="ka03-employment-record-date"
                  type="date"
                  value={ka03Draft.employmentDate || ''}
                  onChange={(event) => setKa03Draft((prev) => ({ ...prev, employmentDate: event.target.value }))}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('ka03-employment-record-date')?.showPicker?.()}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                  aria-label="Otevřít kalendář"
                  title="Otevřít kalendář"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Začátek</label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    id="ka03-employment-start-date"
                    type="date"
                    value={ka03Draft.employmentStartDate}
                    onChange={(event) => setKa03Draft((prev) => ({ ...prev, employmentStartDate: event.target.value }))}
                    onFocus={(event) => event.currentTarget.showPicker?.()}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('ka03-employment-start-date')?.showPicker?.()}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                    aria-label="Otevřít kalendář"
                    title="Otevřít kalendář"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Konec</label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    id="ka03-employment-end-date"
                    type="date"
                    value={ka03Draft.employmentEndDate || ''}
                    onChange={(event) => setKa03Draft((prev) => ({ ...prev, employmentEndDate: event.target.value }))}
                    onFocus={(event) => event.currentTarget.showPicker?.()}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('ka03-employment-end-date')?.showPicker?.()}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                    aria-label="Otevřít kalendář"
                    title="Otevřít kalendář"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-1">
              <InputField
                label="Plánovaný počet měsíců"
                value={ka03Draft.employmentPlannedMonths}
                onChange={(value) => setKa03Draft((prev) => ({ ...prev, employmentPlannedMonths: value }))}
              />
            </div>
            <button
              onClick={() => handleSaveKa03('employment_records')}
              disabled={isSaving}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Uložit HPP
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Uložená TPM</div>
            {tpmRecords.length === 0 ?(
              <EmptyState icon={Briefcase} title="Zatím není uložené žádné TPM." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white/80">
                <div className="max-h-[320px] overflow-auto">
                  <table className="min-w-full divide-y divide-stone-200 text-xs">
                    <thead className="sticky top-0 z-[1] bg-amber-50 text-xs font-semibold uppercase tracking-wide text-amber-800">
                      <tr>
                        <th className="px-2 py-1 text-left">Klient</th>
                        <th className="px-2 py-1 text-left">Zaměstnavatel</th>
                        <th className="px-2 py-1 text-center">Zpráva mentora</th>
                        <th className="px-2 py-1 text-right">Měsíce</th>
                        <th className="px-2 py-1 text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {tpmRecords.map((record) => (
                        <React.Fragment key={record.id}>
                          <tr className="odd:bg-white even:bg-stone-50/70 hover:bg-amber-50/50">
                          <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-1 font-semibold text-slate-900" title={record.clientName || 'Bez klienta'}>{record.clientName || 'Bez klienta'}</td>
                          <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-1 text-slate-700" title={record.payload?.employer || 'Neuvedeno'}>{record.payload?.employer || 'Neuvedeno'}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-center">
                            {hasMentorReportForTpm(record) ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Ano</span>
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Ne</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 text-right font-medium text-slate-800">{record.payload?.actualMonths || 0} / {record.payload?.plannedMonths || 0} měs.</td>
                          <td className="whitespace-nowrap px-2 py-1 text-right">
                            <button
                              type="button"
                              onClick={() => toggleTpmDetails(record.id)}
                              className="mr-2 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                            >
                              {expandedTpmIds.includes(record.id) ? 'Skrýt více' : 'Zobrazit více'}
                            </button>
                            <button type="button" onClick={() => deleteRecord(record)} disabled={isSaving} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50">
                              Smazat
                            </button>
                          </td>
                          </tr>
                          {expandedTpmIds.includes(record.id) && (
                            <tr className="bg-amber-50/40">
                              <td colSpan={5} className="px-3 py-2 text-[11px] text-slate-700">
                                <div><span className="font-semibold">TPM ID:</span> {record.id}</div>
                                <div><span className="font-semibold">Datum záznamu TPM:</span> {record.activityDate || 'Neuvedeno'}</div>
                                <div><span className="font-semibold">Začátek:</span> {record.payload?.startDate || 'Neuvedeno'} · <span className="font-semibold">Konec:</span> {record.payload?.endDate || 'Neuvedeno'}</div>
                                <div className="mt-1 font-semibold">Navázané zprávy mentora: {getMentorReportsForTpm(record).length}</div>
                                {getMentorReportsForTpm(record).length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {getMentorReportsForTpm(record).map((report) => (
                                      <div key={report.id} className="rounded border border-amber-200 bg-white px-2 py-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <div><span className="font-semibold">Datum zprávy:</span> {report.activityDate || 'Bez data'} · {report.title || 'Zpráva mentora'}</div>
                                          <button
                                            type="button"
                                            onClick={() => toggleMentorReport(report.id)}
                                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                                          >
                                            {expandedMentorReportIds.includes(report.id) ? 'Skrýt zprávu' : 'Zobrazit zprávu'}
                                          </button>
                                        </div>
                                        {expandedMentorReportIds.includes(report.id) && (
                                          <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                                            {report.documentText || 'Text zprávy není dostupný.'}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-bold text-slate-900">Uložená HPP / uplatnění</div>
            {employmentRecords.length === 0 ?(
              <EmptyState icon={Briefcase} title="Zatím není uložené žádné pracovní uplatnění." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white/80">
                <div className="max-h-[320px] overflow-auto">
                  <table className="min-w-full divide-y divide-stone-200 text-xs">
                    <thead className="sticky top-0 z-[1] bg-emerald-50 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      <tr>
                        <th className="px-2 py-1 text-left">Klient</th>
                        <th className="px-2 py-1 text-left">Zaměstnavatel</th>
                        <th className="px-2 py-1 text-right">Měsíce</th>
                        <th className="px-2 py-1 text-right">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {employmentRecords.map((record) => (
                        <tr key={record.id} className="odd:bg-white even:bg-stone-50/70 hover:bg-emerald-50/50">
                          <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-1 font-semibold text-slate-900" title={record.clientName || 'Bez klienta'}>{record.clientName || 'Bez klienta'}</td>
                          <td className="max-w-[180px] truncate whitespace-nowrap px-2 py-1 text-slate-700" title={record.payload?.employer || 'Neuvedeno'}>{record.payload?.employer || 'Neuvedeno'}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-right font-medium text-slate-800">{record.payload?.employmentActualMonths || 0} / {record.payload?.employmentPlannedMonths || 0} měs.</td>
                          <td className="whitespace-nowrap px-2 py-1 text-right">
                            <button type="button" onClick={() => deleteRecord(record)} disabled={isSaving} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50">
                              Smazat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      {renderAiDocumentPanel({
        allowedKeys: ka03AiDocumentKeys,
        title: 'Zpráva mentora',
        description: 'Vypracování a uložení závěrečné referenční zprávy mentora ke klientovi.',
        lockClientSelection: true,
        hideStyleFeedback: true,
        panelClassName: 'border-cyan-300 bg-cyan-50/80'
      })}
        </div>
      </div>
    </div>
  );
}

export default Ka03View;



