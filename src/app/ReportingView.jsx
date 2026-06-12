import React from 'react';
import { Activity, Archive, ClipboardCopy, FileSpreadsheet, FileText } from 'lucide-react';

import { Panel, SelectField, StatCard } from '../components/ui.jsx';
import { REPORTING_PERIODS, WORKERS } from '../config/projectConfig.js';

function ReportingView({
  computedIndicators,
  supportThresholdMetrics = [],
  exportClientsCsv,
  exportAllRecordsBackup,
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
                    Klienti a podpora
                  </button>
                  <button
                    onClick={exportAllRecordsBackup}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Archive className="h-4 w-4" />
                    Stáhnout všechny zápisy
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[...supportThresholdMetrics, ...computedIndicators].map((indicator) => (
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


          </div>
  );
}

export default ReportingView;
