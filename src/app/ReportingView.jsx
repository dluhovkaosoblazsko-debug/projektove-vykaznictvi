import React from 'react';
import { Activity, ClipboardCopy, Clock, DownloadCloud, FileSpreadsheet, FileText, PieChart, TrendingUp } from 'lucide-react';

import { EmptyState, Panel, SelectField, StatCard } from '../components/ui.jsx';
import { REPORTING_PERIODS, WORKERS } from '../config/projectConfig.js';

function ReportingView({
  computedIndicators,
  exportClientsCsv,
  exportActivitiesCsv,
  exportIndicatorsCsv,
  exportMonitoringBundle,
  dashboardFilters,
  setDashboardFilters,
  filteredRecords,
  handleGenerateZorTexts,
  zorTexts,
  copyToClipboard,
  setCopied,
  copied,
  deleteRecord,
  isSaving
}) {
  return (
          <div className="space-y-6">
            <Panel
              title="Projektový reporting"
              description="Indikátory se počítají ze strukturovaných záznamů, ne pouze z volného textu."
              icon={Activity}
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportClientsCsv}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export klientů
                  </button>
                  <button
                    onClick={exportActivitiesCsv}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    <DownloadCloud className="h-4 w-4" />
                    Export aktivit
                  </button>
                  <button
                    onClick={exportIndicatorsCsv}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    <PieChart className="h-4 w-4" />
                    Export indikátorů
                  </button>
                  <button
                    onClick={exportMonitoringBundle}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <FileText className="h-4 w-4" />
                    Souhrnná dokumentace
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {computedIndicators.map((indicator) => (
                    <StatCard key={indicator.key} title={indicator.label} current={indicator.current} target={indicator.target} ka={indicator.ka} />
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">Filtry reportingu</div>
                  <div className="mt-4 space-y-3">
                    <SelectField
                      label="Vykazované období"
                      value={dashboardFilters.period}
                      onChange={(value) => setDashboardFilters((prev) => ({ ...prev, period: value }))}
                      options={REPORTING_PERIODS.map((period) => ({ value: period.value, label: period.label }))}
                    />
                    <SelectField
                      label="Klíčová aktivita"
                      value={dashboardFilters.ka}
                      onChange={(value) => setDashboardFilters((prev) => ({ ...prev, ka: value }))}
                      options={[
                        { value: 'all', label: 'Všechny KA' },
                        { value: 'KA01', label: 'KA01' },
                        { value: 'KA02', label: 'KA02' },
                        { value: 'KA03', label: 'KA03' }
                      ]}
                    />
                    <SelectField
                      label="Pracovník"
                      value={dashboardFilters.worker}
                      onChange={(value) => setDashboardFilters((prev) => ({ ...prev, worker: value }))}
                      options={[{ value: 'all', label: 'Všichni pracovníci' }].concat(
                        WORKERS.map((worker) => ({ value: worker, label: worker }))
                      )}
                    />
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                      Aktivní filtr zahrnuje <strong>{filteredRecords.length}</strong> záznamů.
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateZorTexts}
                      disabled={dashboardFilters.period === 'all'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <FileText className="h-4 w-4" />
                      Vytvoř texty pro ZOR
                    </button>
                  </div>
                </div>
              </div>
            </Panel>

            {zorTexts && (
              <Panel title={`Texty pro ZOR (${zorTexts.periodLabel})`} description="Pracovní návrhy popisu pokroku za sledované období. Každá KA je omezena na 2000 znaků." icon={FileText}>
                <div className="space-y-4">
                  {Object.entries(zorTexts.texts).map(([ka, text]) => (
                    <div key={ka} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{ka}</div>
                          <div className="mt-1 text-xs text-slate-500">{text.length} / 2000 znaků</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(text, setCopied)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <ClipboardCopy className="h-4 w-4" />
                          {copied ?'Zkopírováno' : 'Kopírovat'}
                        </button>
                      </div>
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                        {text}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Panel title="Drill-down indikátorů" description="Každý indikátor ukazuje přesné zdrojové záznamy." icon={TrendingUp}>
                <div className="space-y-4">
                  {computedIndicators.map((indicator) => (
                    <div key={indicator.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-900">{indicator.label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {indicator.ka} · hodnota {indicator.current} / cíl {indicator.target}
                          </div>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          {indicator.currentIds.length} zdrojů
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {indicator.currentIds.length === 0 ?(
                          <span className="text-sm text-slate-400">Zatím bez zdrojových záznamů.</span>
                        ) : (
                          indicator.currentIds.slice(0, 8).map((value) => (
                            <span key={value} className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                              {value}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Poslední uložené aktivity" description="Rychlá kontrola nově zapsaných dat v systému." icon={Clock}>
                <div className="space-y-3">
                  {filteredRecords.length === 0 && (
                    <EmptyState icon={Clock} title="Dashboard nemá žádné uložené aktivity k započtení." />
                  )}
                  {filteredRecords.slice(0, 8).map((record) => (
                    <div key={record.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-bold text-slate-900">{record.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {record.activityDate || 'Bez data'} · {record.ka || 'Bez KA'} · {record.worker || 'Bez pracovníka'}
                      </div>
                      {record.clientName && <div className="mt-2 text-sm text-slate-700">{record.clientName}</div>}
                      <button
                        type="button"
                        onClick={() => deleteRecord(record)}
                        disabled={isSaving}
                        className="mt-3 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Smazat
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
  );
}

export default ReportingView;
