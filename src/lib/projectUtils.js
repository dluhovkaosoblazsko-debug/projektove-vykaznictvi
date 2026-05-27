import { REPORT_PROMPTS, TARGETS } from '../config/projectConfig.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationMinutesFromTimes(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return 0;
  const duration = endMinutes >= startMinutes ? endMinutes - startMinutes : endMinutes + 24 * 60 - startMinutes;
  return duration > 0 ? duration : 0;
}

function getKa02DurationMinutes(draft) {
  return durationMinutesFromTimes(draft.ka02StartTime, draft.ka02EndTime);
}

function mapSheetRowToClient(row, index) {
  let active = '';
  let columns = [];

  if (Array.isArray(row)) {
    active = row[22];
    columns = row.slice(1, 18);
  } else if (row && typeof row === 'object') {
    if ('W' in row || 'w' in row) {
      active = row.W || row.w;
      columns = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'].map(
        (key) => row[key] || row[key.toLowerCase()] || ''
      );
    } else {
      const values = Object.values(row);
      active = values[22];
      columns = values.slice(1, 18);
    }
  }

  if (String(active || '').trim().toLowerCase() !== 'ano') {
    return null;
  }

  return enrichClient({
    id: buildSheetClientId(columns, index),
    source: 'sheets',
    sheetRowKey: `row-${index}`,
    jmeno: columns[0] || '',
    prijmeni: columns[1] || '',
    datumNarozeni: formatDate(columns[2]),
    ulice: columns[3] || '',
    cisloPopisne: columns[4] || '',
    mesto: columns[5] || '',
    psc: columns[6] || '',
    spadoveMesto: columns[7] || '',
    email: columns[8] || '',
    telefon: columns[9] || '',
    pohlavi: columns[10] || '',
    postaveniNaTrhu: columns[11] || '',
    vzdelani: columns[12] || '',
    znevyhodneni: columns[13] || '',
    datumVstupu: formatDate(columns[14]),
    datumVystupu: formatDate(columns[15]),
    situacePoUkonceni: columns[16] || ''
  });
}

function enrichClient(client) {
  const normalizedClient = {
    ...client,
    datumNarozeni: formatDate(client.datumNarozeni),
    datumVstupu: formatDate(client.datumVstupu),
    datumVystupu: formatDate(client.datumVystupu)
  };
  const projectStatus = deriveProjectStatus(normalizedClient);
  return {
    ...normalizedClient,
    fullName: [normalizedClient.jmeno, normalizedClient.prijmeni].filter(Boolean).join(' ').trim(),
    projectStatus,
    projectStatusLabel: translateProjectStatus(projectStatus)
  };
}

function deriveProjectStatus(client) {
  if (client.projectStatus) return client.projectStatus;
  if (client.datumVystupu) return 'completed';
  return 'active';
}

function translateProjectStatus(status) {
  if (status === 'waiting') return 'Čekací listina';
  if (status === 'completed') return 'Ukončen';
  if (status === 'inactive') return 'Neaktivní';
  return 'Aktivní';
}

function buildSheetClientId(columns, index) {
  const birthDate = formatDate(columns[2]);
  const seed = `${columns[0] || 'klient'}-${columns[1] || 'bezprijmeni'}-${birthDate || index}`;
  return `sheet-${slugify(seed)}`;
}

function buildManualClientId(clientDraft) {
  return `manual-${slugify(`${clientDraft.jmeno}-${clientDraft.prijmeni}-${Date.now()}`)}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(value) {
  if (!value) return '';
  const stringValue = String(value).trim();
  const isoMatch = stringValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${Number(isoMatch[3])}.${Number(isoMatch[2])}.${isoMatch[1]}`;
  }

  const czechMatch = stringValue.match(/^(\d{1,2})[./]\s*(\d{1,2})[./]\s*(\d{4})/);
  if (czechMatch) {
    return `${Number(czechMatch[1])}.${Number(czechMatch[2])}.${czechMatch[3]}`;
  }

  const date = new Date(stringValue);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  }
  return stringValue;
}

function getMockClients() {
  return [
    enrichClient({
      id: 'mock-jan-novak',
      source: 'mock',
      sheetRowKey: null,
      jmeno: 'Jan',
      prijmeni: 'NovĂˇk',
      datumNarozeni: '15.04.1985',
      ulice: 'HlavnĂ­',
      cisloPopisne: '12',
      mesto: 'DĂ­vÄŤĂ­ Hrad',
      psc: '793 99',
      spadoveMesto: 'Krnov',
      email: 'jan.novak@email.cz',
      telefon: '777 123 456',
      pohlavi: 'MuĹľ',
      postaveniNaTrhu: 'DlouhodobÄ› nezamÄ›stnanĂ˝',
      vzdelani: 'ZĹ ',
      znevyhodneni: 'Exekuce, nĂ­zkĂˇ kvalifikace',
      datumVstupu: '01.09.2023',
      datumVystupu: '',
      situacePoUkonceni: ''
    }),
    enrichClient({
      id: 'mock-eva-kolarova',
      source: 'mock',
      sheetRowKey: null,
      jmeno: 'Eva',
      prijmeni: 'KolĂˇĹ™ovĂˇ',
      datumNarozeni: '03.02.1992',
      ulice: 'SadovĂˇ',
      cisloPopisne: '8',
      mesto: 'Hlinka',
      psc: '793 99',
      spadoveMesto: 'Krnov',
      email: 'eva.kolarova@email.cz',
      telefon: '777 987 654',
      pohlavi: 'Ĺ˝ena',
      postaveniNaTrhu: 'Osoba mimo evidenci ĂšP',
      vzdelani: 'SOU',
      znevyhodneni: 'NĂ­zkĂ© sebevÄ›domĂ­, dluhy',
      datumVstupu: '15.10.2023',
      datumVystupu: '',
      situacePoUkonceni: ''
    })
  ];
}

function groupRecordsByType(records) {
  return records.reduce((accumulator, record) => {
    if (!accumulator[record.entityType]) {
      accumulator[record.entityType] = [];
    }
    accumulator[record.entityType].push(record);
    return accumulator;
  }, {});
}

function buildIndicators({ clients, records }) {
  const counts = computedIndicatorsMapRaw(clients, records);
  return [
    makeIndicator('ka01Meetings', 'KA01', 'Koordinační setkání', TARGETS.ka01Meetings, counts),
    makeIndicator('ka01Materials', 'KA01', 'Distribuované materiály', TARGETS.ka01Materials, counts),
    makeIndicator('ka01TeamMeetings', 'KA01', 'Porady realizačního týmu', TARGETS.ka01TeamMeetings, counts),
    makeIndicator('ka01NetworkSize', 'KA01', 'Síť aktérů', TARGETS.ka01NetworkSize, counts),
    makeIndicator('ka02Plans', 'KA02', 'Individuální plány rozvoje', TARGETS.ka02Plans, counts),
    makeIndicator('ka02Consultations', 'KA02', 'Individuální konzultace', TARGETS.ka02Consultations, counts),
    makeIndicator('ka02SupportedClients', 'KA02', 'Klienti v poradenství', TARGETS.ka02SupportedClients, counts),
    makeIndicator('ka02SimulatorRuns', 'KA02', 'Realizace pracovního simulátoru', TARGETS.ka02SimulatorRuns, counts),
    makeIndicator('ka02TherapyClients', 'KA02', 'Klienti se 3 terapiemi', TARGETS.ka02TherapyClients, counts),
    makeIndicator('ka02CvOutputs', 'KA02', 'CV a motivační dopisy', TARGETS.ka02CvOutputs, counts),
    makeIndicator('ka02DebtMappedClients', 'KA02', 'Klienti se zmapovanými závazky', TARGETS.ka02DebtMappedClients, counts),
    makeIndicator('ka02RepaymentArrangements', 'KA02', 'Splátkové kalendáře', TARGETS.ka02RepaymentArrangements, counts),
    makeIndicator('ka03TpmRecords', 'KA03', 'Zřízená TPM', TARGETS.ka03TpmRecords, counts),
    makeIndicator('ka03EmploymentRecords', 'KA03', 'Zřízená HPP', TARGETS.ka03EmploymentRecords, counts),
    makeIndicator('ka03MentorReports', 'KA03', 'Referenční zprávy mentora', TARGETS.ka03MentorReports, counts)
  ];
}

function computedIndicatorsMap(indicators) {
  return indicators.reduce((accumulator, item) => {
    accumulator[item.key] = item;
    return accumulator;
  }, {});
}

function computedIndicatorsMapRaw(clients, records) {
  const map = createIndicatorAccumulator();
  const normalizeType = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  records.forEach((record) => {
    const flags = record.indicatorFlags || {};
    Object.entries(flags).forEach(([key, value]) => {
      if (!(key in map)) return;
      if (typeof value === 'number') {
        if (value <= 0) return;
        map[key].current += value;
        map[key].currentIds.push(record.id);
      } else if (value) {
        map[key].current += 1;
        map[key].currentIds.push(record.id);
      }
    });
  });

  const networkRecords = records.filter((record) => record.entityType === 'network_activities');
  const meetingRecords = networkRecords.filter((record) => normalizeType(record.payload?.type).includes('koordinacni setkani'));
  const teamMeetingRecords = networkRecords.filter((record) => normalizeType(record.payload?.type).includes('porada tymu'));
  const networkSupportRecords = networkRecords.filter((record) => {
    const type = normalizeType(record.payload?.type);
    return type.includes('sit akteru') || type.includes('rozsireni nebo udrzeni site');
  });
  map.ka01Meetings.current = meetingRecords.length;
  map.ka01Meetings.currentIds = meetingRecords.map((record) => record.id);
  map.ka01TeamMeetings.current = teamMeetingRecords.length;
  map.ka01TeamMeetings.currentIds = teamMeetingRecords.map((record) => record.id);
  map.ka01NetworkSize.current = networkSupportRecords.length > 0 ? 1 : 0;
  map.ka01NetworkSize.currentIds = networkSupportRecords.length > 0 ? [networkSupportRecords[0].id] : [];

  const planRecords = records.filter((record) => record.entityType === 'plans');
  map.ka02Plans.current = planRecords.length;
  map.ka02Plans.currentIds = planRecords.map((record) => record.id);

  const individualConsultationRecords = records.filter((record) =>
    ['consultations', 'debt_cases', 'therapy_sessions'].includes(record.entityType)
  );
  map.ka02Consultations.current = individualConsultationRecords.length;
  map.ka02Consultations.currentIds = individualConsultationRecords.map((record) => record.id);

  const supportedClientIds = new Set(
    records
      .filter((record) => ['plans', 'consultations', 'debt_cases'].includes(record.entityType))
      .map((record) => record.clientId)
      .filter(Boolean)
  );
  map.ka02SupportedClients.current = supportedClientIds.size;
  map.ka02SupportedClients.currentIds = Array.from(supportedClientIds);

  const therapyCounter = records
    .filter((record) => record.entityType === 'therapy_sessions' && record.clientId)
    .reduce((accumulator, record) => {
      accumulator[record.clientId] = (accumulator[record.clientId] || 0) + 1;
      return accumulator;
    }, {});
  const therapyClients = Object.entries(therapyCounter)
    .filter(([, count]) => count >= 3)
    .map(([clientId]) => clientId);
  map.ka02TherapyClients.current = therapyClients.length;
  map.ka02TherapyClients.currentIds = therapyClients;

  const debtMappedIds = new Set(
    records
      .filter((record) => record.entityType === 'debt_cases')
      .map((record) => record.clientId)
      .filter(Boolean)
  );
  map.ka02DebtMappedClients.current = debtMappedIds.size;
  map.ka02DebtMappedClients.currentIds = Array.from(debtMappedIds);

  return map;
}

function createIndicatorAccumulator() {
  return Object.keys(TARGETS).reduce((accumulator, key) => {
    accumulator[key] = { current: 0, currentIds: [] };
    return accumulator;
  }, {});
}

function makeIndicator(key, ka, label, target, counts) {
  return {
    key,
    ka,
    label,
    target,
    current: counts[key].current,
    currentIds: counts[key].currentIds
  };
}

function buildGeneratorRecord({ client, generatorDraft, generatedText, selectedTpmRecord = null }) {
  const config = REPORT_PROMPTS[generatorDraft.selectedKey];
  const linkedGoalPayload = {
    linkedPlanGoalId: generatorDraft.linkedPlanGoalId || '',
    linkedPlanGoalLabel: generatorDraft.linkedPlanGoalLabel || ''
  };
  const basePayload = {
    entityType: config.entityType,
    ka: config.ka,
    title: `${config.label} - ${client.fullName}`,
    activityDate: generatorDraft.date,
    worker: generatorDraft.worker,
    clientId: client.id,
    clientIds: [client.id],
    clientName: client.fullName,
    documentText: generatedText,
    ...linkedGoalPayload
  };
  const ka02SessionFields = {
    startTime: generatorDraft.ka02StartTime || '',
    endTime: generatorDraft.ka02EndTime || '',
    place: generatorDraft.ka02Place || ''
  };

  if (generatorDraft.selectedKey === 'plan') {
    return {
      ...basePayload,
      payload: {
        ...linkedGoalPayload,
        ...ka02SessionFields,
        version: 1,
        currentSituation: generatorDraft.currentSituation,
        goals: generatorDraft.goals,
        barriers: generatorDraft.barriers,
        plannedSteps: generatorDraft.plannedSteps,
        durationMinutes: 60
      },
      indicatorFlags: { ka02Plans: true }
    };
  }

  if (generatorDraft.selectedKey === 'consultation') {
    return {
      ...basePayload,
      payload: {
        ...linkedGoalPayload,
        ...ka02SessionFields,
        consultationType: generatorDraft.consultationType,
        topics: generatorDraft.topics,
        outcome: generatorDraft.outcome,
        nextSteps: generatorDraft.nextSteps,
        durationMinutes: getKa02DurationMinutes(generatorDraft)
      },
      indicatorFlags: { ka02Consultations: true }
    };
  }

  if (generatorDraft.selectedKey === 'debt') {
    return {
      ...basePayload,
      payload: {
        ...linkedGoalPayload,
        ...ka02SessionFields,
        debtSummary: generatorDraft.debtSummary,
        debtCauses: generatorDraft.debtCauses,
        debtStage: generatorDraft.debtStage,
        solutionPlan: generatorDraft.solutionPlan,
        durationMinutes: getKa02DurationMinutes(generatorDraft)
      },
      indicatorFlags: { ka02DebtMappedClients: true }
    };
  }

  if (generatorDraft.selectedKey === 'therapy') {
    return {
      ...basePayload,
      payload: {
        ...linkedGoalPayload,
        ...ka02SessionFields,
        sessionOrder: Number(generatorDraft.sessionOrder || 1),
        themes: generatorDraft.themes,
        mentalState: generatorDraft.mentalState,
        recommendations: generatorDraft.recommendations,
        durationMinutes: getKa02DurationMinutes(generatorDraft)
      },
      indicatorFlags: {}
    };
  }

  if (generatorDraft.selectedKey === 'cv') {
    return {
      ...basePayload,
      payload: {
        ...linkedGoalPayload,
        ...ka02SessionFields,
        targetJob: generatorDraft.targetJob,
        experience: generatorDraft.experience,
        skills: generatorDraft.skills,
        durationMinutes: getKa02DurationMinutes(generatorDraft)
      },
      indicatorFlags: { ka02CvOutputs: true }
    };
  }

  if (generatorDraft.selectedKey === 'simulator') {
    return {
      ...basePayload,
      payload: {
        ...linkedGoalPayload,
        ...ka02SessionFields,
        position: generatorDraft.position,
        feedback: generatorDraft.feedback,
        strengths: generatorDraft.strengths,
        developmentAreas: generatorDraft.developmentAreas,
        durationMinutes: getKa02DurationMinutes(generatorDraft)
      },
      indicatorFlags: { ka02SimulatorRuns: true }
    };
  }

  return {
    ...basePayload,
    entityType: 'mentor_report_document',
    worker: 'Mentor/Kouč',
    payload: {
      ...linkedGoalPayload,
      tpmRecordId: generatorDraft.tpmRecordId || selectedTpmRecord?.id || '',
      tpmEmployer: selectedTpmRecord?.payload?.employer || '',
      tpmStartDate: selectedTpmRecord?.payload?.startDate || '',
      workplace: generatorDraft.workplace,
      progressSummary: generatorDraft.nextSteps || generatorDraft.progressSummary,
      barriers: generatorDraft.barriers,
      nextSupportSteps: generatorDraft.nextSteps
    },
    indicatorFlags: { ka03MentorReports: true }
  };
}

function buildKa02Record(entityType, draft, client) {
  const basePayload = {
    ka: 'KA02',
    activityDate: draft.date,
    worker: draft.worker,
    clientId: client.id,
    clientIds: [client.id],
    clientName: client.fullName
  };
  const ka02SessionFields = {
    startTime: draft.ka02StartTime || '',
    endTime: draft.ka02EndTime || '',
    place: draft.ka02Place || ''
  };

  if (entityType === 'plans') {
    return {
      ...basePayload,
      entityType,
      title: `IPR v${draft.planVersion} - ${client.fullName}`,
      payload: {
        ...ka02SessionFields,
        version: Number(draft.planVersion || 1),
        currentSituation: draft.currentSituation,
        goals: draft.goals,
        barriers: draft.barriers,
        plannedSteps: draft.plannedSteps,
        durationMinutes: 60
      },
      indicatorFlags: { ka02Plans: true }
    };
  }

  if (entityType === 'consultations') {
    return {
      ...basePayload,
      entityType,
      title: `Konzultace - ${draft.consultationType} - ${client.fullName}`,
      payload: {
        ...ka02SessionFields,
        consultationType: draft.consultationType,
        durationMinutes: getKa02DurationMinutes(draft),
        topics: draft.topics,
        outcome: draft.outcome,
        nextSteps: draft.nextSteps
      },
      indicatorFlags: { ka02Consultations: true }
    };
  }

  if (entityType === 'debt_cases') {
    return {
      ...basePayload,
      entityType,
      title: `DluhovĂ© poradenstvĂ­ - ${client.fullName}`,
      payload: {
        ...ka02SessionFields,
        debtSummary: draft.debtSummary,
        debtCauses: draft.debtCauses,
        debtStage: draft.debtStage,
        solutionPlan: draft.solutionPlan,
        hasRepaymentArrangement: draft.hasRepaymentArrangement,
        educationTopic: draft.educationTopic,
        durationMinutes: getKa02DurationMinutes(draft)
      },
      indicatorFlags: {
        ka02DebtMappedClients: true,
        ka02RepaymentArrangements: draft.hasRepaymentArrangement
      }
    };
  }

  if (entityType === 'therapy_sessions') {
    return {
      ...basePayload,
      entityType,
      title: `Terapie ${draft.therapyOrder}/3 - ${client.fullName}`,
      payload: {
        ...ka02SessionFields,
        sessionOrder: Number(draft.therapyOrder || 1),
        durationMinutes: getKa02DurationMinutes(draft),
        themes: draft.therapyThemes,
        mentalState: draft.therapyMentalState,
        recommendations: draft.therapyRecommendations
      },
      indicatorFlags: {}
    };
  }

  if (entityType === 'cv_outputs') {
    return {
      ...basePayload,
      entityType,
      title: `CV a motivaÄŤnĂ­ dopis - ${client.fullName}`,
      payload: {
        ...ka02SessionFields,
        targetJob: draft.targetJob,
        experience: draft.experience,
        skills: draft.skills,
        durationMinutes: getKa02DurationMinutes(draft)
      },
      indicatorFlags: { ka02CvOutputs: true }
    };
  }

  return {
    ...basePayload,
    entityType,
    title: draft.simulatorLabel || `PracovnĂ­ simulĂˇtor - ${client.fullName}`,
    payload: {
      ...ka02SessionFields,
      position: draft.simulatorPosition,
      participants: splitMultiValue(draft.simulatorParticipants),
      committee: splitMultiValue(draft.simulatorCommittee),
      feedback: draft.simulatorFeedback,
      durationMinutes: getKa02DurationMinutes(draft)
    },
    indicatorFlags: { ka02SimulatorRuns: true }
  };
}

function buildKa03Record(entityType, draft, client) {
  const linkedGoalId =
    entityType === 'employment_records'
      ? draft.employmentLinkedPlanGoalId || ''
      : draft.tpmLinkedPlanGoalId || '';
  const linkedGoalLabel =
    entityType === 'employment_records'
      ? draft.employmentLinkedPlanGoalLabel || ''
      : draft.tpmLinkedPlanGoalLabel || '';
  const linkedGoalPayload = {
    linkedPlanGoalId: linkedGoalId,
    linkedPlanGoalLabel: linkedGoalLabel
  };
  const basePayload = {
    ka: 'KA03',
    activityDate: draft.date,
    worker: draft.worker,
    clientId: client.id,
    clientIds: [client.id],
    clientName: client.fullName,
    ...linkedGoalPayload
  };

  if (entityType === 'tpm_records') {
    return {
      ...basePayload,
      entityType,
      title: `TPM - ${client.fullName}`,
      payload: {
        ...linkedGoalPayload,
        employer: draft.employer,
        startDate: draft.startDate,
        endDate: draft.endDate,
        plannedMonths: Number(draft.plannedMonths || 0),
        actualMonths: Number(draft.actualMonths || 0)
      },
      indicatorFlags: { ka03TpmRecords: true }
    };
  }

  if (entityType === 'mentoring_records') {
    return {
      ...basePayload,
      entityType,
      title: `Mentoring TPM - ${client.fullName}`,
      payload: {
        ...linkedGoalPayload,
        employer: draft.employer,
        workplace: draft.workplace,
        mentoringFrequency: draft.mentoringFrequency,
        progressSummary: draft.progressSummary,
        barriers: draft.barriers,
        nextSupportSteps: draft.nextSupportSteps
      },
      indicatorFlags: {}
    };
  }

  if (entityType === 'employment_records') {
    return {
      ...basePayload,
      entityType,
      title: `HPP - ${client.fullName}`,
      payload: {
        ...linkedGoalPayload,
        employmentType: 'HPP',
        employer: draft.employer,
        employmentStartDate: draft.employmentStartDate,
        employmentEndDate: draft.employmentEndDate || '',
        employmentPlannedMonths: Number(draft.employmentPlannedMonths || 0),
        employmentActualMonths: Number(draft.employmentActualMonths || 0)
      },
      indicatorFlags: {
        ka03EmploymentRecords: true
      }
    };
  }

  return {
    ...basePayload,
    entityType: 'mentor_report_document',
    title: draft.mentorReportTitle || `ReferenÄŤnĂ­ zprĂˇva mentora - ${client.fullName}`,
    documentText: draft.mentorReportText,
    payload: {
      ...linkedGoalPayload,
      workplace: draft.workplace,
      employer: draft.employer
    },
    indicatorFlags: { ka03MentorReports: true }
  };
}

function buildFallbackGeneratedText(label, client, fields) {
  const lines = [
    `${label}`,
    '',
    `Klient: ${client.fullName}`,
    `Datum: ${fields.date || todayIso()}`,
    `PracovnĂ­k: ${fields.worker || 'Neuvedeno'}`,
    '',
    'PracovnĂ­ podklad:'
  ];

  Object.entries(fields).forEach(([key, value]) => {
    if (['clientId', 'tpmRecordId', 'selectedKey', 'worker', 'date', 'generatedText'].includes(key)) return;
    if (value === '' || value === false || value == null) return;
    lines.push(`${translateFieldLabel(key)}: ${String(value)}`);
  });

  lines.push('');
  lines.push('PoznĂˇmka: Tento text byl vytvoĹ™en z ruÄŤnÄ› vyplnÄ›nĂ˝ch polĂ­, protoĹľe AI generĂˇtor nenĂ­ aktivnĂ­.');
  return lines.join('\n');
}

function anonymizeStyleMemoryText(value, client) {
  let text = String(value || '');
  if (!text.trim()) return '';

  const fullName = String(client?.fullName || '').trim();
  const firstName = String(client?.jmeno || '').trim();
  const lastName = String(client?.prijmeni || '').trim();
  const escape = (input) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  [fullName, firstName, lastName].filter(Boolean).forEach((name) => {
    text = text.replace(new RegExp(escape(name), 'gi'), '[KLIENT]');
  });

  text = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/(?<!\d)(\+?\d[\d\s-]{7,}\d)(?!\d)/g, '[KONTAKT]')
    .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, '[DATUM]')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATUM]');

  return text.replace(/\s{3,}/g, ' ').trim();
}

function buildAiStyleMemoryRecord({ client, generatorDraft, generatedText, promptText, config }) {
  const rating = Number(generatorDraft.aiStyleRating || 0);
  const feedback = anonymizeStyleMemoryText(generatorDraft.aiStyleFeedback || '', client);
  const promptAnonymized = anonymizeStyleMemoryText(promptText || '', client);
  const outputAnonymized = anonymizeStyleMemoryText(generatedText || '', client);

  return {
    entityType: 'ai_style_memory',
    ka: config.ka || '',
    title: `AI stylova pamet - ${config.label}`,
    activityDate: generatorDraft.date || todayIso(),
    worker: generatorDraft.worker || 'Neuvedeno',
    clientId: '',
    clientIds: [],
    clientName: 'Anonymizovano',
    documentText: '',
    payload: {
      version: 1,
      documentType: generatorDraft.selectedKey,
      documentLabel: config.label,
      workerRole: generatorDraft.worker || 'Neuvedeno',
      workerRating: Number.isFinite(rating) ? Math.min(5, Math.max(1, rating)) : 3,
      workerFeedback: feedback,
      promptAnonymized: truncate(promptAnonymized, 1800),
      outputAnonymized: truncate(outputAnonymized, 1800)
    },
    indicatorFlags: {}
  };
}

function buildStyleMemoryContext(records, { selectedKey, worker, maxItems = 3 }) {
  const items = records
    .filter((record) => record.entityType === 'ai_style_memory')
    .filter((record) => record.payload?.documentType === selectedKey)
    .filter((record) => !worker || !record.payload?.workerRole || record.payload.workerRole === worker)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, maxItems);

  if (items.length === 0) return '';

  const lines = items.map((item, index) => {
    const rating = item.payload?.workerRating ?? '?';
    const feedback = String(item.payload?.workerFeedback || '').trim();
    const prompt = String(item.payload?.promptAnonymized || '').trim();
    const output = String(item.payload?.outputAnonymized || '').trim();
    return [
      `Vzor ${index + 1} (hodnoceni ${rating}/5):`,
      feedback ?`Zpetna vazba pracovnika: ${feedback}` : '',
      prompt ?`Anonymizovany prompt: ${truncate(prompt, 600)}` : '',
      output ?`Anonymizovany vystup: ${truncate(output, 700)}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  });

  return `Interni stylova pamet projektu (anonymizovane vzory):\n${lines.join('\n\n')}\n\nPouzij tento styl pouze jako voditko tonu a struktury. Nevymyslej nova fakta.`;
}

function extractGeminiText(result) {
  const candidate = result?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((part) => part.text || '')
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (text) return cleanGeneratedText(text);

  if (candidate?.finishReason) {
    const safety = candidate.safetyRatings
      ?.map((rating) => `${rating.category}: ${rating.probability}`)
      .join(', ');
    throw new Error(`AI nevrĂˇtila text. DĹŻvod: ${candidate.finishReason}${safety ? ` (${safety})` : ''}`);
  }

  if (result?.promptFeedback?.blockReason) {
    throw new Error(`AI poĹľadavek byl zablokovĂˇn: ${result.promptFeedback.blockReason}`);
  }

  throw new Error('AI nevrĂˇtila text v oÄŤekĂˇvanĂ© struktuĹ™e.');
}

function cleanGeneratedText(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/`{1,3}/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function translateFieldLabel(key) {
  const labels = {
    currentSituation: 'Výchozí situace',
    goals: 'Cíle',
    barriers: 'Bariéry',
    plannedSteps: 'Plánované kroky',
    consultationType: 'Typ konzultace',
    topics: 'Témata',
    outcome: 'Vyhodnocení',
    nextSteps: 'Další kroky',
    durationMinutes: 'Délka v minutách',
    debtSummary: 'Mapované závazky',
    debtCauses: 'Příčiny předlužení',
    debtStage: 'Fáze řešení',
    solutionPlan: 'Plán řešení',
    educationTopic: 'Edukace',
    sessionOrder: 'Pořadí setkání',
    themes: 'Témata setkání',
    mentalState: 'Psychický stav',
    recommendations: 'Doporučení',
    targetJob: 'Cílová pozice',
    experience: 'Zkušenosti',
    skills: 'Dovednosti',
    position: 'Simulovaná pozice',
    feedback: 'Průběh a výkon',
    strengths: 'Silné stránky',
    developmentAreas: 'Rozvojové oblasti',
    workplace: 'Pracoviště',
    progressSummary: 'Pokrok',
    consultationType: 'Typ konzultace'
  };
  return labels[key] || key;
}

const CLIENT_SUPPORT_TYPE_META = [
  { key: 'plans', label: 'Plány rozvoje' },
  { key: 'consultations', label: 'Konzultace' },
  { key: 'debt_cases', label: 'Dluhové poradenství' },
  { key: 'therapy_sessions', label: 'Terapie' },
  { key: 'cv_outputs', label: 'CV a motivační dopis' },
  { key: 'job_simulators', label: 'Pracovní simulátor' },
  { key: 'tpm_records', label: 'TPM' },
  { key: 'mentoring_records', label: 'Mentoring' },
  { key: 'employment_records', label: 'Pracovní uplatnění' },
  { key: 'mentor_report_document', label: 'Referenční zpráva' }
];

function extractSupportHours(record) {
  const payload = record.payload || {};
  if (record.entityType === 'plans') return 1;
  if (['consultations', 'debt_cases', 'therapy_sessions', 'cv_outputs', 'job_simulators'].includes(record.entityType)) {
    return durationMinutesFromTimes(payload.startTime, payload.endTime) / 60;
  }
  if (typeof payload.actualHours === 'number') return payload.actualHours;
  if (typeof payload.durationMinutes === 'number') return payload.durationMinutes / 60;
  return 0;
}

function getClientSupportBreakdown(clientId, records) {
  const related = records.filter((record) => {
    const clientIds = Array.isArray(record.clientIds) ?record.clientIds : [];
    return clientIds.includes(clientId) || record.clientId === clientId;
  });

  const byType = CLIENT_SUPPORT_TYPE_META.map((item) => {
    const matching = related.filter((record) => record.entityType === item.key);
    const hours = matching.reduce((sum, record) => sum + extractSupportHours(record), 0);
    return {
      key: item.key,
      label: item.label,
      count: matching.length,
      hours: Number(hours.toFixed(1))
    };
  }).filter((item) => item.count > 0 || item.hours > 0);

  return {
    totalCount: related.length,
    totalDocuments: related.filter((record) => Boolean(record.documentText)).length,
    totalHours: Number(byType.reduce((sum, item) => sum + item.hours, 0).toFixed(1)),
    totalMinutes: Math.round(byType.reduce((sum, item) => sum + item.hours, 0) * 60),
    byType
  };
}

function getClientStats(clientId, records) {
  const summary = getClientSupportBreakdown(clientId, records);

  return {
    activities: summary.totalCount,
    documents: summary.totalDocuments,
    supportMinutes: summary.totalMinutes,
    supportHours: summary.totalHours
  };
}

function splitMultiValue(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAddress(client) {
  return [client.ulice, client.cisloPopisne].filter(Boolean).join(' ') + (client.mesto ?`, ${client.mesto}` : '');
}

function truncate(value, length) {
  const stringValue = String(value || '');
  if (stringValue.length <= length) return stringValue;
  return `${stringValue.slice(0, length)}...`;
}

function copyToClipboard(text, setCopied) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  setCopied(true);
  window.setTimeout(() => setCopied(false), 1800);
}

function downloadCsv(headers, rows, filename) {
  const content = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const href = `data:text/csv;charset=utf-8,\ufeff${encodeURIComponent(content)}`;
  downloadHref(href, filename);
}

function downloadHtmlDocument(htmlContent, filename) {
  const rawHtml = String(htmlContent || '');
  let normalizedHtml = rawHtml;

  if (/<meta[^>]*charset=/i.test(normalizedHtml)) {
    normalizedHtml = normalizedHtml.replace(/<meta[^>]*charset=[^>]*>/i, '<meta charset="utf-8" />');
  } else if (/<head[^>]*>/i.test(normalizedHtml)) {
    normalizedHtml = normalizedHtml.replace(/<head[^>]*>/i, '$&\n<meta charset="utf-8" />');
  } else {
    normalizedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${normalizedHtml}</body></html>`;
  }

  const blob = new Blob([`\ufeff${normalizedHtml}`], { type: 'application/msword;charset=utf-8' });
  const href = window.URL.createObjectURL(blob);
  downloadHref(href, filename);
  window.setTimeout(() => window.URL.revokeObjectURL(href), 4000);
}

function buildDriveUploadPayload(record, client) {
  const safeClient = client || {
    id: record.clientId || 'bez-id',
    fullName: record.clientName || 'Bez klienta'
  };
  const filename = `${record.activityDate || todayIso()} - ${record.ka || 'KA'} - ${record.title || record.entityType || 'zaznam'}`;
  return {
    client: {
      id: safeClient.id || record.clientId || 'bez-id',
      fullName: safeClient.fullName || record.clientName || 'Bez klienta',
      sheetRowKey: safeClient.sheetRowKey || '',
      source: safeClient.source || '',
      datumNarozeni: safeClient.datumNarozeni || '',
      mesto: safeClient.mesto || ''
    },
    record: {
      id: record.id || '',
      title: record.title || 'ZĂˇznam',
      filename,
      entityType: record.entityType || '',
      ka: record.ka || '',
      activityDate: record.activityDate || '',
      worker: record.worker || '',
      clientName: record.clientName || safeClient.fullName || '',
      payload: record.payload || {},
      indicatorFlags: record.indicatorFlags || {},
      documentText: record.documentText || ''
    },
    contentHtml: buildRecordHtmlDocument(record, safeClient)
  };
}

function buildDriveProvisionPayload(client) {
  const safeClient = client || {};
  return {
    action: 'provisionClientFolder',
    client: {
      id: safeClient.id || 'bez-id',
      fullName: safeClient.fullName || 'Bez klienta',
      jmeno: safeClient.jmeno || '',
      prijmeni: safeClient.prijmeni || '',
      datumNarozeni: safeClient.datumNarozeni || '',
      mesto: safeClient.mesto || '',
      ulice: safeClient.ulice || '',
      cisloPopisne: safeClient.cisloPopisne || '',
      psc: safeClient.psc || '',
      email: safeClient.email || '',
      telefon: safeClient.telefon || '',
      spadoveMesto: safeClient.spadoveMesto || '',
      pohlavi: safeClient.pohlavi || '',
      postaveniNaTrhu: safeClient.postaveniNaTrhu || '',
      vzdelani: safeClient.vzdelani || '',
      znevyhodneni: safeClient.znevyhodneni || ''
    }
  };
}

function buildRecordHtmlDocument(record, client) {
  const payloadRows = Object.entries(record.payload || {})
    .filter(([, value]) => value !== '' && value !== false && value != null)
    .map(
      ([key, value]) => `
        <tr>
          <th style="width:32%;padding:8px;border:1px solid #d6d3d1;background:#fafaf9;text-align:left;">${escapeHtml(
            translateFieldLabel(key)
          )}</th>
          <td style="padding:8px;border:1px solid #d6d3d1;">${escapeHtml(
            typeof value === 'object' ?JSON.stringify(value, null, 2) : value
          )}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(record.title || 'ZĂˇznam')}</title>
  </head>
  <body style="font-family:Arial, sans-serif;color:#1f2937;line-height:1.55;">
    <h1 style="font-size:22px;margin-bottom:8px;">${escapeHtml(record.title || 'ZĂˇznam')}</h1>
    <p style="color:#64748b;font-size:13px;margin-top:0;">
      ${escapeHtml(record.activityDate || 'Bez data')} | ${escapeHtml(record.ka || 'Bez KA')} | ${escapeHtml(
        record.worker || 'Bez pracovnĂ­ka'
      )}
    </p>
    <h2 style="font-size:16px;margin-top:24px;">Klient</h2>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <tr><th style="width:32%;padding:8px;border:1px solid #d6d3d1;background:#fafaf9;text-align:left;">JmĂ©no</th><td style="padding:8px;border:1px solid #d6d3d1;">${escapeHtml(
        client.fullName || record.clientName || ''
      )}</td></tr>
      <tr><th style="padding:8px;border:1px solid #d6d3d1;background:#fafaf9;text-align:left;">InternĂ­ ID</th><td style="padding:8px;border:1px solid #d6d3d1;">${escapeHtml(
        client.id || record.clientId || ''
      )}</td></tr>
    </table>
    <h2 style="font-size:16px;margin-top:24px;">StrukturovanĂˇ data</h2>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      ${payloadRows || '<tr><td style="padding:8px;border:1px solid #d6d3d1;">Bez strukturovanĂ˝ch polĂ­.</td></tr>'}
    </table>
    <h2 style="font-size:16px;margin-top:24px;">Text zĂˇpisu</h2>
    <pre style="white-space:pre-wrap;font-family:Arial, sans-serif;font-size:13px;background:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:14px;">${escapeHtml(
      record.documentText || JSON.stringify(record.payload || {}, null, 2)
    )}</pre>
  </body>
</html>`;
}

function downloadHref(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function buildClientFolderHtml(client, timeline) {
  const sections = timeline
    .map((record) => {
      return `
        <section style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e2e8f0;">
          <h2 style="font-size:18px;margin-bottom:8px;">${escapeHtml(record.title || 'Aktivita')}</h2>
          <p style="color:#64748b;font-size:12px;">${escapeHtml(record.activityDate || '')} | ${escapeHtml(record.ka || '')} | ${escapeHtml(record.worker || '')}</p>
          <pre style="white-space:pre-wrap;font-family:Arial, sans-serif;font-size:13px;line-height:1.6;">${escapeHtml(
            record.documentText || JSON.stringify(record.payload || {}, null, 2)
          )}</pre>
        </section>
      `;
    })
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>SloĹľka klienta ${escapeHtml(client.fullName)}</title>
      </head>
      <body style="font-family:Arial, sans-serif;padding:32px;color:#1e293b;">
        <h1 style="font-size:28px;margin-bottom:8px;">SloĹľka klienta: ${escapeHtml(client.fullName)}</h1>
        <p style="color:#475569;">InternĂ­ ID: ${escapeHtml(client.id)} | Obec: ${escapeHtml(client.mesto || 'Neuvedeno')}</p>
        ${sections || '<p>Ĺ˝ĂˇdnĂ© zĂˇznamy.</p>'}
      </body>
    </html>
  `;
}

function buildMonitoringBundleHtml({ indicators, records, clients }) {
  const indicatorHtml = indicators
    .map(
      (indicator) => `
      <tr>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(indicator.ka)}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(indicator.label)}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${indicator.current}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${indicator.target}</td>
      </tr>
    `
    )
    .join('');

  const activityHtml = records
    .slice(0, 50)
    .map(
      (record) => `
      <tr>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(record.activityDate || '')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(record.ka || '')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(record.entityType || '')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(record.clientName || '')}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(record.title || '')}</td>
      </tr>
    `
    )
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>SouhrnnĂˇ monitorovacĂ­ dokumentace</title>
      </head>
      <body style="font-family:Arial, sans-serif;padding:32px;color:#1e293b;">
        <h1>SouhrnnĂˇ monitorovacĂ­ dokumentace</h1>
        <p>Klienti v registru: ${clients.length} | Aktivity v systĂ©mu: ${records.length}</p>
        <h2>IndikĂˇtory</h2>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">KA</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">IndikĂˇtor</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">Hodnota</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">CĂ­l</th>
            </tr>
          </thead>
          <tbody>${indicatorHtml}</tbody>
        </table>
        <h2>VĂ˝bÄ›r poslednĂ­ch aktivit</h2>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">Datum</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">KA</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">Entita</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">Klient</th>
              <th style="padding:8px;border:1px solid #cbd5e1;background:#f8fafc;">NĂˇzev</th>
            </tr>
          </thead>
          <tbody>${activityHtml}</tbody>
        </table>
      </body>
    </html>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadLocalRecords() {
  try {
    const stored = window.localStorage.getItem('projectReporting.records');
    return stored ?JSON.parse(stored) : [];
  } catch (error) {
    console.error('Local records load error:', error);
    return [];
  }
}

function saveLocalRecords(records) {
  try {
    window.localStorage.setItem('projectReporting.records', JSON.stringify(records));
  } catch (error) {
    console.error('Local records save error:', error);
  }
}

export {
  todayIso,
  mapSheetRowToClient,
  enrichClient,
  getMockClients,
  groupRecordsByType,
  buildIndicators,
  computedIndicatorsMap,
  buildGeneratorRecord,
  buildKa02Record,
  buildKa03Record,
  anonymizeStyleMemoryText,
  buildAiStyleMemoryRecord,
  buildStyleMemoryContext,
  buildFallbackGeneratedText,
  extractGeminiText,
  cleanGeneratedText,
  getClientSupportBreakdown,
  getClientStats,
  buildAddress,
  truncate,
  copyToClipboard,
  downloadCsv,
  downloadHtmlDocument,
  buildDriveUploadPayload,
  buildDriveProvisionPayload,
  buildRecordHtmlDocument,
  buildClientFolderHtml,
  buildMonitoringBundleHtml,
  buildManualClientId,
  loadLocalRecords,
  saveLocalRecords,
  slugify,
  splitMultiValue
};


