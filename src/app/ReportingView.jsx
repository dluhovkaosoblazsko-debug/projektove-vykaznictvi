import React from 'react';
import { Activity, Archive, ClipboardCopy, Download, FileSpreadsheet, FileText, HardDriveDownload, Loader2, ShieldCheck } from 'lucide-react';

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
  isSaving,
  backupStatus = null,
  isBackupActionRunning = false,
  handleStartFullBackup,
  handleInstallWeeklyBackup
}) {
  const backupBusy = isBackupActionRunning || ['queued', 'running'].includes(backupStatus?.state);
  const backupFinishedAt = backupStatus?.finishedAt
    ? new Date(backupStatus.finishedAt).toLocaleString('cs-CZ')
    : '';
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

            <Panel
              title="Kompletní ZIP záloha Google Drive"
              description="Zálohuje klientské složky, MON listy, smlouvy, souhlasy a generované dokumenty z Google Drive. Uchovává se posledních 12 ZIP záloh. Data Firestore stáhnete samostatně tlačítkem Stáhnout všechny zápisy."
              icon={HardDriveDownload}
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleStartFullBackup}
                    disabled={backupBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {backupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                    {backupBusy ? 'Záloha se připravuje…' : 'Vytvořit kompletní ZIP zálohu'}
                  </button>
                  {!backupStatus?.weeklyEnabled && (
                    <button
                      type="button"
                      onClick={handleInstallWeeklyBackup}
                      disabled={isBackupActionRunning}
                      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      <ShieldCheck className="h-4 w-4" /> Zapnout týdenní zálohy
                    </button>
                  )}
                  {backupStatus?.downloadUrl && backupStatus?.state === 'success' && (
                    <a
                      href={backupStatus.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Download className="h-4 w-4" /> Stáhnout poslední ZIP
                    </a>
                  )}
                </div>
              }
            >
              <div className={`rounded-xl border px-3 py-2 text-sm ${
                backupStatus?.state === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : backupStatus?.state === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}>
                <div className="font-semibold">{backupStatus?.message || 'Záloha zatím nebyla vytvořena.'}</div>
                <div className="mt-1 text-xs">
                  Automaticky každou neděli ve 2:00: <strong>{backupStatus?.weeklyEnabled ? 'zapnuto' : 'vypnuto'}</strong>
                  {backupFinishedAt ? ` · Poslední dokončení: ${backupFinishedAt}` : ''}
                  {backupStatus?.fileCount ? ` · Souborů v záloze: ${backupStatus.fileCount}` : ''}
                </div>
                {backupStatus?.statusError && <div className="mt-1 text-xs text-red-700">{backupStatus.statusError}</div>}
              </div>
              <p className="mt-2 text-xs text-slate-500">ZIP je uložen ve složce „Zálohy - Projektové výkaznictví Osoblažsko“ na Google Drive. Pravidelně stahujte kopii také mimo tento Google účet.</p>
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
