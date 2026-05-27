import React from 'react';
import { computedIndicatorsMap } from '../lib/projectUtils.js';
import ClientPlanSidebar from './ClientPlanSidebar.jsx';

function Ka02View({
  clients,
  ka02Draft,
  setKa02Draft,
  setGeneratorDraft,
  renderAiDocumentPanel,
  ka02AiDocumentKeys,
  computedIndicators
}) {
  const indicatorMap = computedIndicatorsMap(computedIndicators);
  const plans = indicatorMap.ka02Plans;
  const consultations = indicatorMap.ka02Consultations;
  const supported = indicatorMap.ka02SupportedClients;
  const simulator = indicatorMap.ka02SimulatorRuns;
  const therapy = indicatorMap.ka02TherapyClients;
  const cv = indicatorMap.ka02CvOutputs;
  const debts = indicatorMap.ka02DebtMappedClients;
  const repayments = indicatorMap.ka02RepaymentArrangements;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold uppercase tracking-wide text-slate-300">KA02 plnění:</span>
          <span>IPR <strong>{plans.current}</strong>/<span className="text-slate-300">{plans.target}</span></span>
          <span>Konzultace <strong>{consultations.current}</strong>/<span className="text-slate-300">{consultations.target}</span></span>
          <span>Klienti <strong>{supported.current}</strong>/<span className="text-slate-300">{supported.target}</span></span>
          <span>Simulátor <strong>{simulator.current}</strong>/<span className="text-slate-300">{simulator.target}</span></span>
          <span>3 terapie <strong>{therapy.current}</strong>/<span className="text-slate-300">{therapy.target}</span></span>
          <span>CV <strong>{cv.current}</strong>/<span className="text-slate-300">{cv.target}</span></span>
          <span>Map. závazků <strong>{debts.current}</strong>/<span className="text-slate-300">{debts.target}</span></span>
          <span>Splátkové kal. <strong>{repayments.current}</strong>/<span className="text-slate-300">{repayments.target}</span></span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <ClientPlanSidebar
          clients={clients}
          selectedClientId={ka02Draft.selectedClientId}
          onClientChange={(clientId) => {
            setKa02Draft((prev) => ({ ...prev, selectedClientId: clientId }));
            setGeneratorDraft((prev) => ({
              ...prev,
              clientId,
              linkedPlanGoalId: '',
              linkedPlanGoalLabel: ''
            }));
          }}
        />

        <div className="min-w-0">
          {renderAiDocumentPanel({
            allowedKeys: ka02AiDocumentKeys.filter((key) => key !== 'plan'),
            title: 'KA02 - další dokumenty přímé práce',
            description: 'Konzultace, dluhové poradenství, terapie, CV a pracovní simulátor.',
            lockClientSelection: true,
            hideStyleFeedback: true
          })}
        </div>
      </div>
    </div>
  );
}

export default Ka02View;
