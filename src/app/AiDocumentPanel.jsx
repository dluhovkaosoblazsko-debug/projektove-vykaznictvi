import React from 'react';
import { CalendarDays, Download, Loader2, Save, Sparkles } from 'lucide-react';

import { InputField, Panel, SelectField, TextAreaField } from '../components/ui.jsx';

function AiDocumentPanel({
  allowedKeys,
  title,
  description,
  reportPrompts,
  generatorDraft,
  setGeneratorDraft,
  clients,
  tpmRecords = [],
  workers,
  generatedText,
  setGeneratedText,
  lastGeneratedText,
  generationNotice,
  aiGenerationStatus,
  isGenerating,
  isSaving,
  onGenerate,
  onSave,
  onExportPlan,
  planGoalOptions = [],
  lockClientSelection = false,
  lockedClientId = '',
  lockedClientName = '',
  hideStyleFeedback = false,
  panelClassName = ''
}) {
  const MENTOR_BARRIER_OPTIONS = [
    'Nestabilní docházka',
    'Pozdní příchody',
    'Nízké pracovní tempo',
    'Nejistota v pracovních úkolech',
    'Komunikační obtíže na pracovišti',
    'Konflikty na pracovišti',
    'Nízká motivace',
    'Zdravotní omezení',
    'Rodinná zátěž',
    'Dopravní dostupnost'
  ];
  const KA02_PLACE_OPTIONS = [
    'Dívčí Hrad',
    'Hlinka',
    'Slezské Pavlovice',
    'Třemešná',
    'Jindřichov',
    'Bohušov',
    'Slezské Rudoltice',
    'Vysoká',
    'Rusín',
    'Osoblaha',
    'Jiné místo (ručně)'
  ];
  const WORKDAY_TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
    const totalMinutes = 7 * 60 + index * 30;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const timeOptionsWithValue = (value) =>
    value && !WORKDAY_TIME_OPTIONS.includes(value) ? [value, ...WORKDAY_TIME_OPTIONS] : WORKDAY_TIME_OPTIONS;
  const parseTimeToMinutes = (value) => {
    const match = String(value || '').trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const formatDurationFromTimes = (startTime, endTime) => {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (startMinutes == null || endMinutes == null) return '';
    const durationMinutes = endMinutes >= startMinutes ? endMinutes - startMinutes : endMinutes + 24 * 60 - startMinutes;
    if (durationMinutes <= 0) return '';
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    if (hours && minutes) return `${hours} hod. ${minutes} min.`;
    if (hours) return `${hours} ${hours === 1 ? 'hodina' : hours < 5 ? 'hodiny' : 'hodin'}`;
    return `${minutes} min.`;
  };

  const isKa02Form = ['plan', 'consultation', 'debt', 'therapy', 'cv', 'simulator'].includes(generatorDraft.selectedKey);
  const isMentorForm = generatorDraft.selectedKey === 'mentor';
  const ka02WorkerOptionsByDocument = {
    consultation: ['Pracovní poradce', 'Dluhový poradce', 'Více pracovníků'],
    debt: ['Dluhový poradce'],
    therapy: ['Terapeut'],
    cv: ['Pracovní poradce'],
    simulator: ['Pracovní poradce'],
    plan: ['Pracovní poradce']
  };
  const workerOptionValues = isKa02Form
    ? ka02WorkerOptionsByDocument[generatorDraft.selectedKey] || workers.filter((worker) => worker !== 'Garant projektu')
    : workers;
  const workerOptions = workerOptionValues.map((worker) => ({
    value: worker,
    label: worker
  }));
  const mentorTpmOptions = (tpmRecords || [])
    .filter((record) => !lockClientSelection || !lockedClientId || record.clientId === lockedClientId)
    .map((record) => {
    const startDate = record.payload?.startDate || record.activityDate || '';
    const employer = record.payload?.employer || 'Bez zaměstnavatele';
    return {
      value: record.id,
      label: `${record.clientName || 'Bez klienta'} · ${employer}${startDate ? ` · ${startDate}` : ''}`,
      clientId: record.clientId || ''
    };
    });
  const ka02Duration = formatDurationFromTimes(generatorDraft.ka02StartTime, generatorDraft.ka02EndTime);
  const options = Object.entries(reportPrompts)
    .filter(([key]) => allowedKeys.includes(key))
    .map(([key, value]) => ({ value: key, label: value.label }));
  const isSingleKeyPanel = options.length <= 1;
  const headerGridClass = isMentorForm ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-2' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4';

  const updateDraft = (patch) => setGeneratorDraft((prev) => ({ ...prev, ...patch }));
  const updateLinkedGoal = (goalId) => {
    const selected = planGoalOptions.find((goal) => goal.value === goalId);
    updateDraft({
      linkedPlanGoalId: goalId,
      linkedPlanGoalLabel: selected?.label || ''
    });
  };
  const parseBarrierItems = (value) =>
    String(value || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
  const mergeBarriers = (items) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).join('; ');
  const barrierItems = parseBarrierItems(generatorDraft.barriers);
  const selectedPresetBarriers = barrierItems.filter((item) => MENTOR_BARRIER_OPTIONS.includes(item));
  const customBarrierItems = barrierItems.filter((item) => !MENTOR_BARRIER_OPTIONS.includes(item));
  const addPresetBarrier = (barrier) => {
    if (!barrier) return;
    updateDraft({ barriers: mergeBarriers([...barrierItems, barrier]) });
  };
  const removeBarrier = (barrier) => {
    updateDraft({ barriers: mergeBarriers(barrierItems.filter((item) => item !== barrier)) });
  };
  const updateCustomBarriers = (value) => {
    const customs = parseBarrierItems(value);
    updateDraft({ barriers: mergeBarriers([...selectedPresetBarriers, ...customs]) });
  };
  const updateGeneratedText = (value) => {
    setGeneratedText(value);
    updateDraft({ generatedText: value });
  };
  const hasGeneratedText = Boolean(String(generatedText || '').trim());

  return (
    <Panel title={title} description={description} icon={Sparkles} className={panelClassName}>
      <div className="space-y-3">
        <div className={headerGridClass}>
          {!isSingleKeyPanel && (
            <SelectField label="Typ dokumentu" value={generatorDraft.selectedKey} onChange={(value) => updateDraft({ selectedKey: value })} options={options} />
          )}
          {isMentorForm ? (
            <SelectField
              label="TPM"
              value={generatorDraft.tpmRecordId || ''}
              onChange={(value) => {
                const selected = mentorTpmOptions.find((option) => option.value === value);
                updateDraft({
                  tpmRecordId: value,
                  clientId: lockClientSelection ? lockedClientId : selected?.clientId || '',
                  linkedPlanGoalId: '',
                  linkedPlanGoalLabel: '',
                  workplace: selected?.label || ''
                });
              }}
              options={mentorTpmOptions}
            />
          ) : lockClientSelection ? null : (
            <SelectField
              label="Klient"
              value={generatorDraft.clientId}
              onChange={(value) => updateDraft({ clientId: value, linkedPlanGoalId: '', linkedPlanGoalLabel: '' })}
              options={clients.map((client) => ({ value: client.id, label: client.fullName }))}
            />
          )}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {isMentorForm ? 'Datum sepsání zprávy' : 'Datum aktivity'}
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                id="ka-date-input"
                type="date"
                value={generatorDraft.date}
                onChange={(event) => updateDraft({ date: event.target.value })}
                onFocus={(event) => event.currentTarget.showPicker?.()}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => document.getElementById('ka-date-input')?.showPicker?.()}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
                aria-label="Otevřít kalendář"
                title="Otevřít kalendář"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
            </div>
          </div>
          {!isMentorForm && (
            <SelectField
              label="Pracovník"
              value={generatorDraft.worker}
              onChange={(value) => updateDraft({ worker: value })}
              options={workerOptions}
            />
          )}
          {(isKa02Form || isMentorForm) && generatorDraft.selectedKey !== 'plan' && (
            <SelectField
              label="Cíl IPR *"
              value={generatorDraft.linkedPlanGoalId || ''}
              onChange={updateLinkedGoal}
              options={[
                { value: '', label: planGoalOptions.length ? 'Vyber cíl...' : 'Nejdřív doplň cíl v IPR' },
                ...planGoalOptions
              ]}
            />
          )}
        </div>

        {isKa02Form && (
          <div className="grid items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2 lg:grid-cols-[88px_88px_minmax(120px,150px)_minmax(200px,1fr)]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">OD</label>
              <select
                value={generatorDraft.ka02StartTime || ''}
                onChange={(event) => updateDraft({ ka02StartTime: event.target.value })}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Vyber čas</option>
                {timeOptionsWithValue(generatorDraft.ka02StartTime || '').map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">DO</label>
              <select
                value={generatorDraft.ka02EndTime || ''}
                onChange={(event) => updateDraft({ ka02EndTime: event.target.value })}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Vyber čas</option>
                {timeOptionsWithValue(generatorDraft.ka02EndTime || '').map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Trvání</label>
              <div className="flex h-9 items-center rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                {ka02Duration || '-'}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Místo setkání</label>
              <select
                value={generatorDraft.ka02Place || ''}
                onChange={(event) => updateDraft({ ka02Place: event.target.value })}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Vyber místo…</option>
                {KA02_PLACE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {generatorDraft.selectedKey === 'plan' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextAreaField label="Výchozí situace" value={generatorDraft.currentSituation} onChange={(value) => updateDraft({ currentSituation: value })} rows={2} />
            <TextAreaField label="Cíle" value={generatorDraft.goals} onChange={(value) => updateDraft({ goals: value })} rows={2} />
            <TextAreaField label="Bariéry" value={generatorDraft.barriers} onChange={(value) => updateDraft({ barriers: value })} rows={2} />
            <TextAreaField label="Plánované kroky" value={generatorDraft.plannedSteps} onChange={(value) => updateDraft({ plannedSteps: value })} rows={2} />
          </div>
        )}

        {generatorDraft.selectedKey === 'consultation' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Typ konzultace"
                value={generatorDraft.consultationType}
                onChange={(value) => updateDraft({ consultationType: value })}
                options={[
                  { value: 'Pracovní poradenství', label: 'Pracovní poradenství' },
                  { value: 'Dluhové poradenství', label: 'Dluhové poradenství' },
                  { value: 'Motivační podpora', label: 'Motivační podpora' }
                ]}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextAreaField label="Témata" value={generatorDraft.topics} onChange={(value) => updateDraft({ topics: value })} rows={2} />
              <TextAreaField label="Vyhodnocení" value={generatorDraft.outcome} onChange={(value) => updateDraft({ outcome: value })} rows={2} />
              <TextAreaField label="Další kroky" value={generatorDraft.nextSteps} onChange={(value) => updateDraft({ nextSteps: value })} rows={2} />
            </div>
          </>
        )}

        {generatorDraft.selectedKey === 'debt' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TextAreaField label="Mapované závazky" value={generatorDraft.debtSummary} onChange={(value) => updateDraft({ debtSummary: value })} rows={2} />
            <TextAreaField label="Příčiny předlužení" value={generatorDraft.debtCauses} onChange={(value) => updateDraft({ debtCauses: value })} rows={2} />
            <InputField label="Fáze řešení" value={generatorDraft.debtStage} onChange={(value) => updateDraft({ debtStage: value })} />
            <TextAreaField label="Návrh řešení" value={generatorDraft.solutionPlan} onChange={(value) => updateDraft({ solutionPlan: value })} rows={2} />
          </div>
        )}

        {generatorDraft.selectedKey === 'therapy' && (
          <>
            <div className="grid gap-3 sm:grid-cols-1">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pořadí setkání</label>
                <div className="flex h-9 items-center rounded-md border border-slate-300 bg-slate-50 px-2 text-sm font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
                  {generatorDraft.sessionOrder || '1'}/3 automaticky
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextAreaField label="Témata" value={generatorDraft.themes} onChange={(value) => updateDraft({ themes: value })} rows={2} />
              <TextAreaField label="Psychický stav" value={generatorDraft.mentalState} onChange={(value) => updateDraft({ mentalState: value })} rows={2} />
              <TextAreaField label="Doporučení" value={generatorDraft.recommendations} onChange={(value) => updateDraft({ recommendations: value })} rows={2} />
            </div>
          </>
        )}

        {generatorDraft.selectedKey === 'cv' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InputField label="Cílová pozice" value={generatorDraft.targetJob} onChange={(value) => updateDraft({ targetJob: value })} />
            <TextAreaField label="Zkušenosti" value={generatorDraft.experience} onChange={(value) => updateDraft({ experience: value })} rows={2} />
            <TextAreaField label="Dovednosti" value={generatorDraft.skills} onChange={(value) => updateDraft({ skills: value })} rows={2} />
          </div>
        )}

        {generatorDraft.selectedKey === 'simulator' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InputField label="Simulovaná pozice" value={generatorDraft.position} onChange={(value) => updateDraft({ position: value })} />
            <TextAreaField label="Průběh a výkon" value={generatorDraft.feedback} onChange={(value) => updateDraft({ feedback: value })} rows={2} />
            <TextAreaField label="Silné stránky" value={generatorDraft.strengths} onChange={(value) => updateDraft({ strengths: value })} rows={2} />
            <TextAreaField label="Rozvojové oblasti" value={generatorDraft.developmentAreas} onChange={(value) => updateDraft({ developmentAreas: value })} rows={2} />
          </div>
        )}

        {generatorDraft.selectedKey === 'mentor' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pozorované překážky</label>
              <select
                value=""
                onChange={(event) => addPresetBarrier(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Vyber typickou překážku…</option>
                {MENTOR_BARRIER_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={customBarrierItems.join('; ')}
                onChange={(event) => updateCustomBarriers(event.target.value)}
                placeholder="Jiná překážka / více překážek odděl středníkem"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="flex flex-wrap gap-2">
                {barrierItems.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => removeBarrier(item)}
                    className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                    title="Odebrat překážku"
                  >
                    {item} ×
                  </button>
                ))}
              </div>
            </div>
            <TextAreaField
              label="Průběh TPM a dosažený pokrok klienta"
              value={generatorDraft.nextSteps}
              onChange={(value) => updateDraft({ nextSteps: value })}
              rows={2}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={onGenerate} disabled={isGenerating} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Vygenerovat návrh
          </button>
          <button onClick={onSave} disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
            <Save className="h-4 w-4" />
            Ulož dokument
          </button>
          {generatorDraft.selectedKey === 'plan' && false && (
            <button onClick={onExportPlan} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              <Download className="h-4 w-4" />
              Export plánu do DOCX
            </button>
          )}
        </div>

        {!isMentorForm && generationNotice && (
          <div
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              aiGenerationStatus === 'error'
                ? 'border border-red-200 bg-red-50 text-red-800'
                : aiGenerationStatus === 'warning'
                  ? 'border border-amber-200 bg-amber-50 text-amber-800'
                  : aiGenerationStatus === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-blue-200 bg-blue-50 text-blue-800'
            }`}
          >
            {generationNotice}
          </div>
        )}

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold text-slate-700">
            <span>Výstup dokumentu</span>
            <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-xs font-semibold text-indigo-700">{generatedText.length} znaků</span>
          </div>
          <textarea
            value={generatedText}
            onChange={(event) => updateGeneratedText(event.target.value)}
            rows={hasGeneratedText ? 14 : 1}
            className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
              hasGeneratedText ? 'min-h-[280px]' : 'min-h-[40px]'
            }`}
            placeholder="Po vygenerování nebo ručním dopsání se zde zobrazí text dokumentu."
          />
        </div>

        {!hideStyleFeedback && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Hodnocení AI výstupu"
              value={generatorDraft.aiStyleRating}
              onChange={(value) => updateDraft({ aiStyleRating: value })}
              options={[
                { value: '5', label: '5 - výborné' },
                { value: '4', label: '4 - dobré' },
                { value: '3', label: '3 - použitelné' },
                { value: '2', label: '2 - slabší' },
                { value: '1', label: '1 - nepoužitelné' }
              ]}
            />
            <TextAreaField label="Poznámka k AI stylu (anonymizovaná)" value={generatorDraft.aiStyleFeedback} onChange={(value) => updateDraft({ aiStyleFeedback: value })} rows={2} />
          </div>
        )}
      </div>
    </Panel>
  );
}

export default AiDocumentPanel;

