// ==========================================
// CONFIGURAÇÃO CENTRALIZADA DA API DO GOOGLE
// ==========================================
const URL_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbwkkvgiCsccGV3vs04KJ4taKDoIf6HW0GA9VrMiHelDhO10zMOWqn-s4N8ND1X47qvK/exec";

// DENTES POR QUADRANTE
const dentesQ1 = [
  { id: '18', label: '18' }, { id: '17', label: '17' }, { id: '16', label: '16' },
  { id: '15_55', label: '15 / 55' }, { id: '14_54', label: '14 / 54' },
  { id: '13_53', label: '13 / 53' }, { id: '12_52', label: '12 / 52' }, { id: '11_51', label: '11 / 51' }
];
const dentesQ2 = [
  { id: '21_61', label: '21 / 61' }, { id: '22_62', label: '22 / 62' }, { id: '23_63', label: '23 / 63' },
  { id: '24_64', label: '24 / 64' }, { id: '25_65', label: '25 / 65' }, { id: '26', label: '26' },
  { id: '27', label: '27' }, { id: '28', label: '28' }
];
const dentesQ4 = [
  { id: '48', label: '48' }, { id: '47', label: '47' }, { id: '46', label: '46' },
  { id: '45_85', label: '45 / 85' }, { id: '44_84', label: '44 / 84' },
  { id: '43_83', label: '43 / 83' }, { id: '42_82', label: '42 / 82' }, { id: '41_81', label: '41 / 81' }
];
const dentesQ3 = [
  { id: '31_71', label: '31 / 71' }, { id: '32_72', label: '32 / 72' }, { id: '33_73', label: '33 / 73' },
  { id: '34_74', label: '34 / 74' }, { id: '35_75', label: '35 / 75' }, { id: '36', label: '36' },
  { id: '37', label: '37' }, { id: '38', label: '38' }
];

function createToothRow(tooth) {
  return `
    <div class="tooth-row" data-tooth-id="${tooth.id}" data-status="pendente">
      <span class="tooth-code">${tooth.label}</span>
      <input type="text" class="tooth-proc" placeholder="Procedimento">
      <div class="tooth-price-wrap">
        <span class="cur-symbol">R$</span>
        <input type="number" class="tooth-price" step="0.01" min="0" placeholder="0,00">
      </div>
      <select class="tooth-status">
        <option value="pendente">Pendente</option>
        <option value="andamento">Em Andamento</option>
        <option value="realizado">Realizado</option>
      </select>
      <input type="date" class="tooth-date" title="Data de Realização">
    </div>
  `;
}

document.getElementById('q1List').innerHTML = dentesQ1.map(createToothRow).join('');
document.getElementById('q2List').innerHTML = dentesQ2.map(createToothRow).join('');
document.getElementById('q4List').innerHTML = dentesQ4.map(createToothRow).join('');
document.getElementById('q3List').innerHTML = dentesQ3.map(createToothRow).join('');

// ==========================================
// ALTERNÂNCIA DE TELAS: CALENDÁRIO (INÍCIO) <-> PRONTUÁRIO
// ==========================================
function mostrarTelaCalendario() {
  document.getElementById('viewCalendario').style.display = 'block';
  document.getElementById('viewProntuario').style.display = 'none';
  document.getElementById('btnSave').style.display = 'none';
  document.getElementById('btnPrint').style.display = 'none';
  renderizarCalendarioMensal();
}

function mostrarTelaProntuario() {
  document.getElementById('viewCalendario').style.display = 'none';
  document.getElementById('viewProntuario').style.display = 'block';
  document.getElementById('btnSave').style.display = 'inline-block';
  document.getElementById('btnPrint').style.display = 'inline-block';
}

document.getElementById('btnAbrirAgenda').addEventListener('click', mostrarTelaCalendario);

// NAVEGAÇÃO ENTRE ABAS DO PRONTUÁRIO
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const targetTab = document.getElementById(btn.dataset.tab);
    if (targetTab) targetTab.classList.add('active');

    if (btn.dataset.tab === 'tab-evolucao') {
      atualizarListaEvolucoesUI();
    }
    syncDocumentData();
  });
});

// BOTÃO IMPRIMIR / PDF (COMPATÍVEL DESKTOP, IPHONE E IPAD)
const btnPrint = document.getElementById('btnPrint');
if (btnPrint) {
  btnPrint.addEventListener('click', () => {
    syncDocumentData();
    const activeTextarea = document.querySelector('.tab-content.active textarea');
    if (activeTextarea && document.activeElement === activeTextarea) {
      activeTextarea.blur();
    }
    setTimeout(() => {
      window.print();
    }, 120);
  });
}

// ==========================================
// MÓDULO DO CALENDÁRIO MENSAL & AGENDAMENTOS
// ==========================================
const AGENDA_STORAGE_KEY = 'clinica_sindeaux_agenda_v1';
let calAnoAtual = new Date().getFullYear();
let calMesAtual = new Date().getMonth();

function carregarAgendamentos() {
  try {
    const dados = JSON.parse(localStorage.getItem(AGENDA_STORAGE_KEY));
    return Array.isArray(dados) ? dados : [];
  } catch (e) {
    return [];
  }
}

let listaAgendamentos = carregarAgendamentos();

async function salvarAgendamentos() {
  localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(listaAgendamentos));
  renderizarCalendarioMensal();

  if (!URL_APPS_SCRIPT) return;
  try {
    await fetch(URL_APPS_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        acao: 'salvarAgenda',
        agenda: listaAgendamentos
      })
    });
  } catch (err) {
    console.warn('Agenda salva localmente; sincronização com a nuvem pendente.', err);
  }
}

function formatarDataISO(ano, mesZeroBased, dia) {
  const m = String(mesZeroBased + 1).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${ano}-${m}-${d}`;
}

function renderizarCalendarioMensal() {
  const grid = document.getElementById('calendarGrid');
  const titulo = document.getElementById('calMesAnoTitulo');
  const badgeTotal = document.getElementById('calTotalMesBadge');
  if (!grid || !titulo) return;

  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  titulo.textContent = `${nomesMeses[calMesAtual]} ${calAnoAtual}`;

  const primeiroDiaSemana = new Date(calAnoAtual, calMesAtual, 1).getDay();
  const diasNoMes = new Date(calAnoAtual, calMesAtual + 1, 0).getDate();
  const diasMesAnterior = new Date(calAnoAtual, calMesAtual, 0).getDate();

  const hoje = new Date();
  const hojeISO = formatarDataISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const prefixoMesAtual = `${calAnoAtual}-${String(calMesAtual + 1).padStart(2, '0')}`;

  const totalNoMes = listaAgendamentos.filter(a => a.data && a.data.startsWith(prefixoMesAtual)).length;
  if (badgeTotal) {
    badgeTotal.textContent = `${totalNoMes} ${totalNoMes === 1 ? 'agendamento no mês' : 'agendamentos no mês'}`;
  }

  let htmlCelulas = '';

  // Dias do mês anterior para completar a primeira semana
  for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
    const diaAnt = diasMesAnterior - i;
    htmlCelulas += `
      <div class="calendar-day other-month">
        <div class="calendar-day-header">
          <span class="calendar-day-num">${diaAnt}</span>
        </div>
      </div>
    `;
  }

  // Dias do mês atual
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataISO = formatarDataISO(calAnoAtual, calMesAtual, dia);
    const isToday = dataISO === hojeISO;
    const eventosDia = listaAgendamentos
      .filter(a => a.data === dataISO)
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    const chipsHTML = eventosDia.map(ev => `
      <button type="button" class="cal-patient-chip" data-ag-id="${ev.id}" title="${escapeHTML(ev.hora || '')} - ${escapeHTML(ev.pacienteNome)} ${ev.obs ? '(' + escapeHTML(ev.obs) + ')' : ''}">
        ${ev.hora ? `<span class="cal-chip-time">${escapeHTML(ev.hora)}</span>` : ''}
        <span class="cal-chip-name">${escapeHTML(ev.pacienteNome)}</span>
      </button>
    `).join('');

    htmlCelulas += `
      <div class="calendar-day ${isToday ? 'is-today' : ''}" data-date="${dataISO}">
        <div class="calendar-day-header">
          <span class="calendar-day-num">${dia}</span>
          <span class="calendar-day-add-hint">+</span>
        </div>
        <div class="calendar-events-list">
          ${chipsHTML}
        </div>
      </div>
    `;
  }

  // Dias do próximo mês para fechar a grade de 7 colunas
  const totalCelulas = primeiroDiaSemana + diasNoMes;
  const restante = totalCelulas % 7 === 0 ? 0 : 7 - (totalCelulas % 7);
  for (let dProx = 1; dProx <= restante; dProx++) {
    htmlCelulas += `
      <div class="calendar-day other-month">
        <div class="calendar-day-header">
          <span class="calendar-day-num">${dProx}</span>
        </div>
      </div>
    `;
  }

  grid.innerHTML = htmlCelulas;

  // Evento: clicar no chip do paciente abre diretamente o prontuário dele
  grid.querySelectorAll('.cal-patient-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirProntuarioPorAgendamento(chip.dataset.agId);
    });
  });

  // Evento: clicar na célula do dia abre o modal daquele dia para agendar/visualizar
  grid.querySelectorAll('.calendar-day:not(.other-month)').forEach(celula => {
    celula.addEventListener('click', () => {
      abrirModalAgendaDia(celula.dataset.date);
    });
  });
}

function abrirProntuarioPorAgendamento(agendamentoId) {
  const ag = listaAgendamentos.find(item => item.id === agendamentoId);
  if (!ag) return;

  const pacientes = getAllPatients();
  let pacienteEncontrado = null;

  if (ag.pacienteId && pacientes[ag.pacienteId]) {
    pacienteEncontrado = pacientes[ag.pacienteId];
  } else {
    const nomeBusca = (ag.pacienteNome || '').trim().toLowerCase();
    pacienteEncontrado = Object.values(pacientes).find(
      p => p.nome && p.nome.trim().toLowerCase() === nomeBusca
    );
  }

  mostrarTelaProntuario();

  if (pacienteEncontrado) {
    loadPatient(pacienteEncontrado.id);
  } else {
    resetForm();
    document.getElementById('pacienteNome').value = ag.pacienteNome || '';
    if (ag.obs) {
      document.getElementById('queixaPrincipal').value = ag.obs;
    }
    syncDocumentData();
  }
}

function atualizarDatalistPacientesAgenda() {
  const datalist = document.getElementById('datalistPacientesAgenda');
  if (!datalist) return;
  const pacientes = Object.values(getAllPatients()).sort((a, b) =>
    (a.nome || '').localeCompare(b.nome || '')
  );
  datalist.innerHTML = pacientes
    .map(p => `<option value="${escapeHTML(p.nome)}">`)
    .join('');
}

function abrirModalAgendaDia(dataISO, nomePrePreenchido = '') {
  const modal = document.getElementById('modalAgendaDia');
  const titulo = document.getElementById('tituloModalAgenda');
  const inputData = document.getElementById('agDataInput');
  const inputPaciente = document.getElementById('agPacienteInput');
  const inputObs = document.getElementById('agObsInput');

  const dataAlvo = dataISO || formatarDataISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  titulo.textContent = `Agenda — ${formatarDataBR(dataAlvo)}`;
  inputData.value = dataAlvo;
  inputPaciente.value = nomePrePreenchido;
  inputObs.value = '';

  atualizarDatalistPacientesAgenda();
  renderizarListaAgendadosNoModal(dataAlvo);

  modal.style.display = 'flex';
  if (!nomePrePreenchido) {
    inputPaciente.focus();
  } else {
    inputObs.focus();
  }
}

function renderizarListaAgendadosNoModal(dataISO) {
  const container = document.getElementById('listaAgendadosDia');
  if (!container) return;

  const eventos = listaAgendamentos
    .filter(a => a.data === dataISO)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  if (eventos.length === 0) {
    container.innerHTML = `<p class="text-center text-muted" style="padding: 16px;">Nenhum paciente agendado para esta data.</p>`;
    return;
  }

  container.innerHTML = eventos.map(ev => `
    <div class="evolucao-card" style="padding: 10px 14px;">
      <div class="evolucao-card-header" style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
        <div>
          <strong style="font-size: 13.5px; color: var(--primary);">
            ${ev.hora ? `🕒 ${escapeHTML(ev.hora)} — ` : ''}${escapeHTML(ev.pacienteNome)}
          </strong>
          ${ev.obs ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHTML(ev.obs)}</div>` : ''}
        </div>
        <div class="evolucao-card-actions" style="display: flex; gap: 6px; align-items: center;">
          <button type="button" class="btn btn-sm btn-primary" onclick="abrirFichaPeloModalAgenda('${ev.id}')">Abrir Prontuário</button>
          <button type="button" class="btn-action-doc danger" onclick="excluirAgendamento('${ev.id}')" title="Remover">&times;</button>
        </div>
      </div>
    </div>
  `).join('');
}

function abrirFichaPeloModalAgenda(agId) {
  document.getElementById('modalAgendaDia').style.display = 'none';
  abrirProntuarioPorAgendamento(agId);
}

function excluirAgendamento(agId) {
  if (!confirm('Remover este agendamento do calendário?')) return;
  const dataAtualModal = document.getElementById('agDataInput').value;
  listaAgendamentos = listaAgendamentos.filter(a => a.id !== agId);
  salvarAgendamentos();
  renderizarListaAgendadosNoModal(dataAtualModal);
}

// Eventos do Calendário e Modal de Agendamento
document.getElementById('btnCalPrev').addEventListener('click', () => {
  calMesAtual--;
  if (calMesAtual < 0) {
    calMesAtual = 11;
    calAnoAtual--;
  }
  renderizarCalendarioMensal();
});

document.getElementById('btnCalNext').addEventListener('click', () => {
  calMesAtual++;
  if (calMesAtual > 11) {
    calMesAtual = 0;
    calAnoAtual++;
  }
  renderizarCalendarioMensal();
});

document.getElementById('btnCalHoje').addEventListener('click', () => {
  const hoje = new Date();
  calAnoAtual = hoje.getFullYear();
  calMesAtual = hoje.getMonth();
  renderizarCalendarioMensal();
});

document.getElementById('btnNovoAgendamentoRapido').addEventListener('click', () => {
  const hoje = new Date();
  abrirModalAgendaDia(formatarDataISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
});

document.getElementById('btnAgendarEstePaciente').addEventListener('click', () => {
  const nomeAtual = document.getElementById('pacienteNome').value.trim();
  const hoje = new Date();
  abrirModalAgendaDia(formatarDataISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()), nomeAtual);
});

document.getElementById('agDataInput').addEventListener('change', (e) => {
  const novaData = e.target.value;
  if (novaData) {
    document.getElementById('tituloModalAgenda').textContent = `Agenda — ${formatarDataBR(novaData)}`;
    renderizarListaAgendadosNoModal(novaData);
  }
});

document.getElementById('btnSalvarAgendamento').addEventListener('click', () => {
  const data = document.getElementById('agDataInput').value;
  const hora = document.getElementById('agHoraInput').value;
  const pacienteNome = document.getElementById('agPacienteInput').value.trim();
  const obs = document.getElementById('agObsInput').value.trim();

  if (!data) {
    alert('Selecione a data do agendamento.');
    return;
  }
  if (!pacienteNome) {
    alert('Informe o nome do paciente.');
    document.getElementById('agPacienteInput').focus();
    return;
  }

  const pacientes = getAllPatients();
  const match = Object.values(pacientes).find(
    p => p.nome && p.nome.trim().toLowerCase() === pacienteNome.toLowerCase()
  );

  listaAgendamentos.push({
    id: 'ag_' + Date.now(),
    data: data,
    hora: hora,
    pacienteId: match ? match.id : null,
    pacienteNome: match ? match.nome : pacienteNome,
    obs: obs
  });

  const partesData = data.split('-');
  if (partesData.length === 3) {
    calAnoAtual = parseInt(partesData[0], 10);
    calMesAtual = parseInt(partesData[1], 10) - 1;
  }

  salvarAgendamentos();
  document.getElementById('agPacienteInput').value = '';
  document.getElementById('agObsInput').value = '';
  renderizarListaAgendadosNoModal(data);
});

document.getElementById('btnFecharModalAgenda').addEventListener('click', () => {
  document.getElementById('modalAgendaDia').style.display = 'none';
});

document.getElementById('modalAgendaDia').addEventListener('click', (e) => {
  if (e.target.id === 'modalAgendaDia') {
    document.getElementById('modalAgendaDia').style.display = 'none';
  }
});

// ==========================================
// BANCO INTELIGENTE DE MEDICAÇÕES & POSOLOGIAS
// ==========================================
const MEDS_STORAGE_KEY = 'clinica_sindeaux_medicacoes_v1';

const MEDICACOES_PADRAO = {
  comum: [
    {
      id: 'med_c1',
      titulo: 'Dipirona 500mg — Analgésico (6/6h)',
      texto: 'Dipirona Monoidratada 500mg -------------------- 1 caixa\n   Tomar 1 comprimido via oral de 6 em 6 horas em caso de dor.'
    },
    {
      id: 'med_c2',
      titulo: 'Ibuprofeno 600mg — Anti-inflamatório (8/8h)',
      texto: 'Ibuprofeno 600mg --------------------------------- 1 caixa\n   Tomar 1 comprimido via oral de 8 em 8 horas por 3 dias, após as refeições.'
    },
    {
      id: 'med_c3',
      titulo: 'Nimesulida 100mg — Anti-inflamatório (12/12h)',
      texto: 'Nimesulida 100mg --------------------------------- 1 caixa\n   Tomar 1 comprimido via oral de 12 em 12 horas por 3 dias.'
    },
    {
      id: 'med_c4',
      titulo: 'Dexametasona 4mg — Pré-operatório (Dose única)',
      texto: 'Dexametasona 4mg --------------------------------- 1 caixa\n   Tomar 1 comprimido via oral 1 hora antes do procedimento cirúrgico.'
    },
    {
      id: 'med_c5',
      titulo: 'Clorexidina 0,12% — Enxaguatório Pós-Cirúrgico',
      texto: 'Digluconato de Clorexidina 0,12% (sem álcool) ---- 1 frasco\n   Bochechar suavemente 15mL por 1 minuto, de 12 em 12 horas, durante 7 dias (iniciar 24h após a cirurgia).'
    }
  ],
  especial: [
    {
      id: 'med_e1',
      titulo: 'Amoxicilina 500mg — 8/8h por 7 dias (21 cápsulas)',
      texto: 'Amoxicilina 500mg -------------------------------- 21 cápsulas\n   Tomar 1 cápsula via oral de 8 em 8 horas durante 7 dias.'
    },
    {
      id: 'med_e2',
      titulo: 'Amoxicilina + Clavulanato 875/125mg — 12/12h (7 dias)',
      texto: 'Amoxicilina + Clavulanato de Potássio 875mg/125mg -- 14 comprimidos\n   Tomar 1 comprimido via oral de 12 em 12 horas durante 7 dias.'
    },
    {
      id: 'med_e3',
      titulo: 'Clindamicina 300mg — Alérgicos a Penicilina (8/8h)',
      texto: 'Cloridrato de Clindamicina 300mg ----------------- 21 cápsulas\n   Tomar 1 cápsula via oral de 8 em 8 horas durante 7 dias.'
    },
    {
      id: 'med_e4',
      titulo: 'Azitromicina 500mg — 1x ao dia por 5 dias',
      texto: 'Azitromicina Di-hidratada 500mg ------------------ 5 comprimidos\n   Tomar 1 comprimido via oral uma vez ao dia durante 5 dias.'
    },
    {
      id: 'med_e5',
      titulo: 'Paracetamol 500mg + Codeína 30mg (Tylex) — Dor Intensa',
      texto: 'Paracetamol 500mg + Fosfato de Codeína 30mg ------ 1 caixa\n   Tomar 1 comprimido via oral de 6 em 6 horas em caso de dor intensa.'
    }
  ]
};

function carregarBancoMedicacoes() {
  try {
    const salvo = JSON.parse(localStorage.getItem(MEDS_STORAGE_KEY));
    if (salvo && Array.isArray(salvo.comum) && Array.isArray(salvo.especial)) {
      return salvo;
    }
  } catch (e) {
    console.warn('Erro ao ler banco de medicações:', e);
  }
  localStorage.setItem(MEDS_STORAGE_KEY, JSON.stringify(MEDICACOES_PADRAO));
  return JSON.parse(JSON.stringify(MEDICACOES_PADRAO));
}

let bancoMedicacoes = carregarBancoMedicacoes();
let modalModeloTipoAtual = 'comum';

async function salvarBancoMedicacoes() {
  localStorage.setItem(MEDS_STORAGE_KEY, JSON.stringify(bancoMedicacoes));
  popularSelectsMedicacoes();

  if (!URL_APPS_SCRIPT) return;
  try {
    await fetch(URL_APPS_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        acao: 'salvarMedicacoes',
        medicacoes: bancoMedicacoes
      })
    });
  } catch (err) {
    console.warn('Medicações salvas localmente; sincronização com a nuvem pendente.', err);
  }
}

function popularSelectsMedicacoes() {
  const selComum = document.getElementById('selectMedComum');
  const selEspecial = document.getElementById('selectMedEspecial');

  if (selComum) {
    const ordenadosC = [...bancoMedicacoes.comum].sort((a, b) => a.titulo.localeCompare(b.titulo));
    selComum.innerHTML = `<option value="">Selecione uma medicação salva (${ordenadosC.length})...</option>` +
      ordenadosC.map(m => `<option value="${m.id}">${escapeHTML(m.titulo)}</option>`).join('');
  }

  if (selEspecial) {
    const ordenadosE = [...bancoMedicacoes.especial].sort((a, b) => a.titulo.localeCompare(b.titulo));
    selEspecial.innerHTML = `<option value="">Selecione um antimicrobiano/controlado salvo (${ordenadosE.length})...</option>` +
      ordenadosE.map(m => `<option value="${m.id}">${escapeHTML(m.titulo)}</option>`).join('');
  }
}

function obterProximoNumeroReceita(textoAtual) {
  const matches = textoAtual.match(/^\s*(\d+)[\.\-\)]/gm);
  if (!matches || matches.length === 0) return 1;
  const nums = matches.map(m => parseInt(m.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

function inserirMedicacaoNaReceita(tipo) {
  const selectEl = document.getElementById(tipo === 'comum' ? 'selectMedComum' : 'selectMedEspecial');
  if (!selectEl || !selectEl.value) {
    alert('Selecione uma medicação na lista primeiro.');
    return;
  }

  const item = bancoMedicacoes[tipo].find(m => m.id === selectEl.value);
  if (!item) return;

  if (tipo === 'comum') {
    const textarea = document.getElementById('rcPrescricao');
    const atual = textarea.value.trim();
    const proxNum = obterProximoNumeroReceita(atual);
    const bloco = `${proxNum}. ${item.texto.trim()}`;
    textarea.value = atual ? `${atual}\n\n${bloco}` : `Uso Interno:\n\n${bloco}`;
    textarea.focus();
  } else {
    const via1 = document.getElementById('rePrescricaoVia1');
    const via2 = document.getElementById('rePrescricaoVia2');
    const atual = via1.value.trim();
    const proxNum = obterProximoNumeroReceita(atual);
    const bloco = `${proxNum}. ${item.texto.trim()}`;
    const novoTexto = atual ? `${atual}\n\n${bloco}` : `Uso Interno:\n\n${bloco}`;
    via1.value = novoTexto;
    via2.value = novoTexto;
    via1.focus();
  }

  selectEl.value = '';
}

function capturarItensDaReceitaParaBanco(tipo) {
  const textarea = tipo === 'comum'
    ? document.getElementById('rcPrescricao')
    : document.getElementById('rePrescricaoVia1');

  const texto = textarea ? textarea.value.trim() : '';
  if (!texto) {
    alert('A caixa de prescrição está vazia. Digite ao menos uma medicação para salvar.');
    return;
  }

  const semCabecalho = texto.replace(/^Uso\s+(Interno|Externo|Tópico)\s*:?\s*/i, '').trim();
  const blocos = semCabecalho
    .split(/\n(?=\s*\d+[\.\-\)])/)
    .map(b => b.replace(/^\s*\d+[\.\-\)]\s*/, '').trim())
    .filter(Boolean);

  if (blocos.length === 0) {
    alert('Não foi possível identificar itens válidos na prescrição.');
    return;
  }

  let salvos = 0;
  blocos.forEach(bloco => {
    const primeiraLinha = bloco.split('\n')[0];
    const nomeLimpo = primeiraLinha.split(/\s*-{2,}\s*/)[0].trim();
    const tituloSugerido = nomeLimpo.substring(0, 52) || 'Medicação Personalizada';

    const jaExiste = bancoMedicacoes[tipo].some(
      m => m.texto.trim().toLowerCase() === bloco.toLowerCase()
    );

    if (!jaExiste) {
      bancoMedicacoes[tipo].push({
        id: 'med_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        titulo: tituloSugerido,
        texto: bloco
      });
      salvos++;
    }
  });

  if (salvos > 0) {
    salvarBancoMedicacoes();
    alert(`${salvos} ${salvos === 1 ? 'nova medicação salva' : 'novas medicações salvas'} no menu suspenso e sincronizada na nuvem!`);
  } else {
    alert('Todas as medicações desta receita já estão salvas no seu banco.');
  }
}

function abrirModalModelos(tipo) {
  modalModeloTipoAtual = tipo;
  const modal = document.getElementById('modalModelosMed');
  const titulo = document.getElementById('tituloModalModelos');
  titulo.textContent = tipo === 'comum'
    ? 'Modelos — Receituário Comum'
    : 'Modelos — Receituário Especial / Antimicrobianos';

  limparFormModalModelo();
  renderizarListaModelosModal();
  modal.style.display = 'flex';
}

function limparFormModalModelo() {
  document.getElementById('editModeloId').value = '';
  document.getElementById('modeloTituloInput').value = '';
  document.getElementById('modeloTextoInput').value = '';
  document.getElementById('btnSalvarNovoModelo').textContent = '💾 Salvar Modelo';
  document.getElementById('btnCancelarEdicaoModelo').style.display = 'none';
}

function renderizarListaModelosModal() {
  const container = document.getElementById('listaModelosGerenciar');
  const lista = [...bancoMedicacoes[modalModeloTipoAtual]].sort((a, b) => a.titulo.localeCompare(b.titulo));

  if (lista.length === 0) {
    container.innerHTML = `<p class="text-center text-muted" style="padding: 16px;">Nenhum modelo cadastrado nesta categoria.</p>`;
    return;
  }

  container.innerHTML = lista.map(m => `
    <div class="evolucao-card" style="padding: 10px 14px;">
      <div class="evolucao-card-header" style="margin-bottom: 4px; padding-bottom: 4px;">
        <strong style="font-size: 13px; color: var(--primary);">${escapeHTML(m.titulo)}</strong>
        <div class="evolucao-card-actions">
          <button type="button" class="btn-action-doc" onclick="editarModeloMed('${m.id}')">✏️ Editar</button>
          <button type="button" class="btn-action-doc danger" onclick="excluirModeloMed('${m.id}')">&times;</button>
        </div>
      </div>
      <div class="evolucao-card-body" style="font-size: 12px; color: #475569;">${escapeHTML(m.texto)}</div>
    </div>
  `).join('');
}

function editarModeloMed(id) {
  const item = bancoMedicacoes[modalModeloTipoAtual].find(m => m.id === id);
  if (!item) return;

  document.getElementById('editModeloId').value = item.id;
  document.getElementById('modeloTituloInput').value = item.titulo;
  document.getElementById('modeloTextoInput').value = item.texto;
  document.getElementById('btnSalvarNovoModelo').textContent = '💾 Atualizar Modelo';
  document.getElementById('btnCancelarEdicaoModelo').style.display = 'inline-block';
  document.getElementById('modeloTituloInput').focus();
}

function excluirModeloMed(id) {
  if (!confirm('Deseja excluir este modelo de medicação?')) return;
  bancoMedicacoes[modalModeloTipoAtual] = bancoMedicacoes[modalModeloTipoAtual].filter(m => m.id !== id);
  salvarBancoMedicacoes();
  renderizarListaModelosModal();
}

// Eventos dos controles de medicação
document.getElementById('btnInserirMedComum').addEventListener('click', () => inserirMedicacaoNaReceita('comum'));
document.getElementById('btnInserirMedEspecial').addEventListener('click', () => inserirMedicacaoNaReceita('especial'));

document.getElementById('btnLimparReceitaComum').addEventListener('click', () => {
  if (confirm('Limpar o texto do Receituário Comum?')) {
    document.getElementById('rcPrescricao').value = '';
  }
});

document.getElementById('btnLimparReceitaEspecial').addEventListener('click', () => {
  if (confirm('Limpar o texto das duas vias do Receituário Especial?')) {
    document.getElementById('rePrescricaoVia1').value = '';
    document.getElementById('rePrescricaoVia2').value = '';
  }
});

document.getElementById('btnSalvarModeloComum').addEventListener('click', () => capturarItensDaReceitaParaBanco('comum'));
document.getElementById('btnSalvarModeloEspecial').addEventListener('click', () => capturarItensDaReceitaParaBanco('especial'));

document.getElementById('btnGerenciarModelosComum').addEventListener('click', () => abrirModalModelos('comum'));
document.getElementById('btnGerenciarModelosEspecial').addEventListener('click', () => abrirModalModelos('especial'));

document.getElementById('btnFecharModalModelos').addEventListener('click', () => {
  document.getElementById('modalModelosMed').style.display = 'none';
});

document.getElementById('modalModelosMed').addEventListener('click', (e) => {
  if (e.target.id === 'modalModelosMed') {
    document.getElementById('modalModelosMed').style.display = 'none';
  }
});

document.getElementById('btnCancelarEdicaoModelo').addEventListener('click', limparFormModalModelo);

document.getElementById('btnSalvarNovoModelo').addEventListener('click', () => {
  const editId = document.getElementById('editModeloId').value;
  const titulo = document.getElementById('modeloTituloInput').value.trim();
  const texto = document.getElementById('modeloTextoInput').value.trim();

  if (!titulo || !texto) {
    alert('Preencha o título e o texto da prescrição.');
    return;
  }

  if (editId) {
    const idx = bancoMedicacoes[modalModeloTipoAtual].findIndex(m => m.id === editId);
    if (idx !== -1) {
      bancoMedicacoes[modalModeloTipoAtual][idx].titulo = titulo;
      bancoMedicacoes[modalModeloTipoAtual][idx].texto = texto;
    }
  } else {
    bancoMedicacoes[modalModeloTipoAtual].push({
      id: 'med_' + Date.now(),
      titulo: titulo,
      texto: texto
    });
  }

  salvarBancoMedicacoes();
  limparFormModalModelo();
  renderizarListaModelosModal();
});

// PROCEDIMENTOS EXTRAS
const extraContainer = document.getElementById('extraProceduresList');
function addExtraProcedure(desc = '', price = '', status = 'pendente', date = '') {
  const div = document.createElement('div');
  div.className = 'extra-row';
  div.innerHTML = `
    <input type="text" class="extra-desc" placeholder="Ex.: Profilaxia ultrassônica + Flúor" value="${desc}">
    <div class="tooth-price-wrap">
      <span class="cur-symbol">R$</span>
      <input type="number" class="extra-price" step="0.01" min="0" placeholder="0,00" value="${price}">
    </div>
    <select class="extra-status" data-val="${status}">
      <option value="pendente" ${status === 'pendente' ? 'selected' : ''}>Pendente</option>
      <option value="andamento" ${status === 'andamento' ? 'selected' : ''}>Em Andamento</option>
      <option value="realizado" ${status === 'realizado' ? 'selected' : ''}>Realizado</option>
    </select>
    <input type="date" class="extra-date" value="${date}">
    <button type="button" class="btn-remove-extra no-print" title="Remover">&times;</button>
  `;

  const sel = div.querySelector('.extra-status');
  const dInput = div.querySelector('.extra-date');

  sel.addEventListener('change', (e) => {
    sel.dataset.val = e.target.value;
    if (e.target.value === 'realizado' && !dInput.value) {
      dInput.value = new Date().toISOString().split('T')[0];
    }
    calcTotals();
  });

  div.querySelector('.btn-remove-extra').addEventListener('click', () => {
    div.remove();
    calcTotals();
  });

  div.querySelector('.extra-price').addEventListener('input', calcTotals);
  extraContainer.appendChild(div);
  calcTotals();
}
document.getElementById('btnAddExtra').addEventListener('click', () => addExtraProcedure());

// CÁLCULOS TOTAIS
function calcTotals() {
  let subtotal = 0;
  let executado = 0;
  let totalItens = 0;
  let concluidos = 0;

  document.querySelectorAll('.tooth-row').forEach(row => {
    const price = parseFloat(row.querySelector('.tooth-price').value) || 0;
    const status = row.querySelector('.tooth-status').value;
    const proc = row.querySelector('.tooth-proc').value.trim();

    if (price > 0 || proc !== '') {
      totalItens++;
      subtotal += price;
      if (status === 'realizado') {
        concluidos++;
        executado += price;
        row.classList.add('is-done');
      } else {
        row.classList.remove('is-done');
      }
    }
  });

  document.querySelectorAll('.extra-row').forEach(row => {
    const price = parseFloat(row.querySelector('.extra-price').value) || 0;
    const status = row.querySelector('.extra-status').value;
    const desc = row.querySelector('.extra-desc').value.trim();

    if (price > 0 || desc !== '') {
      totalItens++;
      subtotal += price;
      if (status === 'realizado') {
        concluidos++;
        executado += price;
        row.classList.add('is-done');
      } else {
        row.classList.remove('is-done');
      }
    }
  });

  const desconto = parseFloat(document.getElementById('descontoReais').value) || 0;
  const totalLiquido = Math.max(0, subtotal - desconto);
  const pendente = Math.max(0, totalLiquido - executado);
  const percent = totalItens > 0 ? Math.round((concluidos / totalItens) * 100) : 0;

  const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  document.getElementById('kpiTotal').textContent = fmt(totalLiquido);
  document.getElementById('kpiExecutado').textContent = fmt(executado);
  document.getElementById('kpiPendente').textContent = fmt(pendente);
  document.getElementById('kpiPercent').textContent = `${percent}%`;
  document.getElementById('progressBar').style.width = `${percent}%`;

  document.getElementById('lblSubtotal').textContent = fmt(subtotal);
  document.getElementById('lblDesconto').textContent = fmt(desconto);
  document.getElementById('lblLiquido').textContent = fmt(totalLiquido);
}

document.querySelectorAll('.tooth-price').forEach(inp => inp.addEventListener('input', calcTotals));
document.getElementById('descontoReais').addEventListener('input', calcTotals);

document.querySelectorAll('.tooth-status').forEach(sel => {
  sel.addEventListener('change', (e) => {
    const row = e.target.closest('.tooth-row');
    row.dataset.status = e.target.value;
    const dt = row.querySelector('.tooth-date');
    if (e.target.value === 'realizado' && !dt.value) {
      dt.value = new Date().toISOString().split('T')[0];
    }
    calcTotals();
  });
});

// ==========================================
// SISTEMA MULTI-PACIENTES & PESQUISA INTELIGENTE
// ==========================================
const STORAGE_KEY = 'clinica_sindeaux_pacientes';
let currentPatientId = null;
let currentPatientDocs = [];
let currentPatientEvolucoes = [];
let editingEvolucaoId = null;

function getAllPatients() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveAllPatients(patients) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

function resetForm() {
  currentPatientId = null;
  document.getElementById('pacienteNome').value = '';
  document.getElementById('pacienteDataNasc').value = '';
  document.getElementById('pacienteCPF').value = '';
  document.getElementById('pacienteTel').value = '';
  document.getElementById('pacienteEmergencia').value = '';
  document.getElementById('queixaPrincipal').value = '';
  document.getElementById('tempoEvolucao').value = '';
  document.getElementById('escalaDor').value = '';
  document.getElementById('ultimaVisita').value = '';
  document.getElementById('condicaoPgto').value = '';
  document.getElementById('descontoReais').value = '0.00';
  document.getElementById('pacienteCEP').value = '';
  document.getElementById('pacienteLogradouro').value = '';
  document.getElementById('pacienteBairroCidade').value = '';

  currentPatientDocs = [];
  atualizarListaDocumentosUI();

  currentPatientEvolucoes = [];
  limparFormEvolucao();
  atualizarListaEvolucoesUI();

  document.querySelectorAll('#anamneseTbody tr').forEach(tr => {
    const name = tr.dataset.key;
    const noRadio = tr.querySelector(`input[name="${name}"][value="nao"]`);
    if (noRadio) noRadio.checked = true;
    const textInp = tr.querySelector('.table-input');
    if (textInp) textInp.value = '';
  });

  document.querySelectorAll('.tooth-row').forEach(row => {
    row.querySelector('.tooth-proc').value = '';
    row.querySelector('.tooth-price').value = '';
    row.querySelector('.tooth-status').value = 'pendente';
    row.dataset.status = 'pendente';
    row.querySelector('.tooth-date').value = '';
    row.classList.remove('is-done');
  });

  extraContainer.innerHTML = '';
  addExtraProcedure('Profilaxia ultrassônica com jato de bicarbonato', '');

  document.getElementById('badgePacienteAtual').textContent = 'Modo: Novo Cadastro';
  document.getElementById('badgePacienteAtual').className = 'badge-status';
  document.getElementById('btnExcluirPaciente').style.display = 'none';

  calcTotals();
  syncDocumentData();
}

function loadPatient(id) {
  const patients = getAllPatients();
  const p = patients[id];
  if (!p) return;

  mostrarTelaProntuario();

  currentPatientId = id;
  currentPatientDocs = Array.isArray(p.documentos) ? p.documentos : [];
  atualizarListaDocumentosUI();

  currentPatientEvolucoes = Array.isArray(p.evolucoes) ? p.evolucoes : [];
  limparFormEvolucao();
  atualizarListaEvolucoesUI();

  document.getElementById('pacienteNome').value = p.nome || '';
  document.getElementById('pacienteDataNasc').value = p.nasc || '';
  document.getElementById('pacienteCPF').value = p.cpf || '';
  document.getElementById('pacienteTel').value = p.tel || '';
  document.getElementById('pacienteEmergencia').value = p.emergencia || '';
  document.getElementById('queixaPrincipal').value = p.qp || '';
  document.getElementById('tempoEvolucao').value = p.tempo || '';
  document.getElementById('escalaDor').value = p.dor || '';
  document.getElementById('ultimaVisita').value = p.ultima || '';
  document.getElementById('condicaoPgto').value = p.condPgto || '';
  document.getElementById('descontoReais').value = p.desconto || '0.00';
  document.getElementById('pacienteCEP').value = p.cep || '';
  document.getElementById('pacienteLogradouro').value = p.logradouro || '';
  document.getElementById('pacienteBairroCidade').value = p.bairroCidade || '';

  if (p.anamnese) {
    document.querySelectorAll('#anamneseTbody tr').forEach(tr => {
      const key = tr.dataset.key;
      const aData = p.anamnese[key];
      if (aData) {
        const radio = tr.querySelector(`input[name="${key}"][value="${aData.resp}"]`);
        if (radio) radio.checked = true;
        const textInp = tr.querySelector('.table-input');
        if (textInp) textInp.value = aData.obs || '';
      }
    });
  }

  if (p.teeth) {
    p.teeth.forEach(t => {
      const row = document.querySelector(`.tooth-row[data-tooth-id="${t.id}"]`);
      if (row) {
        row.querySelector('.tooth-proc').value = t.proc || '';
        row.querySelector('.tooth-price').value = t.price || '';
        row.querySelector('.tooth-status').value = t.status || 'pendente';
        row.dataset.status = t.status || 'pendente';
        row.querySelector('.tooth-date').value = t.date || '';
      }
    });
  }

  extraContainer.innerHTML = '';
  if (p.extras && p.extras.length > 0) {
    p.extras.forEach(ex => addExtraProcedure(ex.desc, ex.price, ex.status, ex.date));
  } else {
    addExtraProcedure('Profilaxia ultrassônica com jato de bicarbonato', '');
  }

  const badge = document.getElementById('badgePacienteAtual');
  badge.textContent = `Paciente Ativo: ${p.nome}`;
  badge.className = 'badge-status active-patient';
  document.getElementById('btnExcluirPaciente').style.display = 'inline-block';

  document.getElementById('searchResultsList').style.display = 'none';
  document.getElementById('inputBuscaPaciente').value = '';

  calcTotals();
  syncDocumentData();
}

// ==========================================
// MÓDULO DE EVOLUÇÃO CLÍNICA
// ==========================================
function limparFormEvolucao() {
  editingEvolucaoId = null;
  const inputData = document.getElementById('evolucaoData');
  const inputTexto = document.getElementById('evolucaoTexto');
  const tituloForm = document.getElementById('tituloFormEvolucao');
  const badgeModo = document.getElementById('badgeModoEvolucao');
  const btnSalvar = document.getElementById('btnSalvarEvolucao');
  const btnCancelar = document.getElementById('btnCancelarEdicaoEvolucao');

  if (inputData) inputData.value = new Date().toISOString().split('T')[0];
  if (inputTexto) inputTexto.value = '';
  if (tituloForm) tituloForm.textContent = 'Nova Evolução Clínica';
  if (badgeModo) {
    badgeModo.textContent = 'Novo Registro';
    badgeModo.style.background = '';
    badgeModo.style.color = '';
  }
  if (btnSalvar) btnSalvar.textContent = '💾 Salvar Evolução';
  if (btnCancelar) btnCancelar.style.display = 'none';
}

function salvarEvolucoesNoStorage() {
  if (!currentPatientId) return;
  const patients = getAllPatients();
  if (patients[currentPatientId]) {
    patients[currentPatientId].evolucoes = currentPatientEvolucoes;
    patients[currentPatientId].updatedAt = new Date().toISOString();
    saveAllPatients(patients);
  }
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarDataBR(dataISO) {
  if (!dataISO) return 'Data não informada';
  const partes = dataISO.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataISO;
}

function atualizarListaEvolucoesUI() {
  const container = document.getElementById('listaEvolucoesContainer');
  const badgeTotal = document.getElementById('badgeTotalEvolucoes');
  if (!container || !badgeTotal) return;

  badgeTotal.textContent = `${currentPatientEvolucoes.length} ${currentPatientEvolucoes.length === 1 ? 'registro' : 'registros'}`;

  if (currentPatientEvolucoes.length === 0) {
    container.innerHTML = `<p class="text-center text-muted" style="padding: 24px;">Nenhuma evolução clínica registrada para este paciente.</p>`;
    return;
  }

  const ordenadas = [...currentPatientEvolucoes].sort((a, b) => {
    const da = a.data || '';
    const db = b.data || '';
    if (db !== da) return db.localeCompare(da);
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  container.innerHTML = ordenadas.map(ev => {
    const isEditing = editingEvolucaoId === ev.id;
    return `
      <div class="evolucao-card ${isEditing ? 'is-editing' : ''}">
        <div class="evolucao-card-header">
          <div class="evolucao-date-badge">
            📅 ${formatarDataBR(ev.data)}
            ${ev.editado ? '<span class="evolucao-edited-tag">(Editado)</span>' : ''}
          </div>
          <div class="evolucao-card-actions no-print">
            <button type="button" class="btn-action-doc" onclick="editarEvolucao('${ev.id}')">✏️ Editar</button>
            <button type="button" class="btn-action-doc danger" onclick="excluirEvolucao('${ev.id}')" title="Excluir">&times;</button>
          </div>
        </div>
        <div class="evolucao-card-body">${escapeHTML(ev.texto)}</div>
      </div>
    `;
  }).join('');
}

function editarEvolucao(id) {
  const ev = currentPatientEvolucoes.find(item => item.id === id);
  if (!ev) return;

  editingEvolucaoId = ev.id;
  document.getElementById('evolucaoData').value = ev.data || '';
  document.getElementById('evolucaoTexto').value = ev.texto || '';
  document.getElementById('tituloFormEvolucao').textContent = 'Editando Evolução Clínica';

  const badgeModo = document.getElementById('badgeModoEvolucao');
  badgeModo.textContent = 'Modo Edição';
  badgeModo.style.background = '#fef3c7';
  badgeModo.style.color = '#92400e';

  document.getElementById('btnSalvarEvolucao').textContent = '💾 Atualizar Evolução';
  document.getElementById('btnCancelarEdicaoEvolucao').style.display = 'inline-block';

  atualizarListaEvolucoesUI();
  document.getElementById('evolucaoTexto').focus();
}

function excluirEvolucao(id) {
  if (confirm('Deseja realmente excluir este registro de evolução?')) {
    currentPatientEvolucoes = currentPatientEvolucoes.filter(item => item.id !== id);
    if (editingEvolucaoId === id) {
      limparFormEvolucao();
    }
    salvarEvolucoesNoStorage();
    atualizarListaEvolucoesUI();
  }
}

document.getElementById('btnSalvarEvolucao').addEventListener('click', () => {
  const dataVal = document.getElementById('evolucaoData').value;
  const textoVal = document.getElementById('evolucaoTexto').value.trim();

  if (!dataVal) {
    alert('Por favor, informe a data do atendimento.');
    document.getElementById('evolucaoData').focus();
    return;
  }

  if (!textoVal) {
    alert('Por favor, descreva o que foi realizado na evolução.');
    document.getElementById('evolucaoTexto').focus();
    return;
  }

  if (editingEvolucaoId) {
    const idx = currentPatientEvolucoes.findIndex(item => item.id === editingEvolucaoId);
    if (idx !== -1) {
      currentPatientEvolucoes[idx].data = dataVal;
      currentPatientEvolucoes[idx].texto = textoVal;
      currentPatientEvolucoes[idx].editado = true;
      currentPatientEvolucoes[idx].updatedAt = new Date().toISOString();
    }
  } else {
    currentPatientEvolucoes.unshift({
      id: 'ev_' + Date.now(),
      data: dataVal,
      texto: textoVal,
      editado: false,
      updatedAt: new Date().toISOString()
    });
  }

  limparFormEvolucao();
  atualizarListaEvolucoesUI();

  if (currentPatientId) {
    salvarEvolucoesNoStorage();
  } else {
    alert('Evolução adicionada à ficha! Lembre-se de clicar em "💾 Gravar Paciente" no topo para salvar o cadastro completo.');
  }
});

document.getElementById('btnCancelarEdicaoEvolucao').addEventListener('click', () => {
  limparFormEvolucao();
  atualizarListaEvolucoesUI();
});

// GRAVAR PACIENTE NOVO OU ATUALIZAR (LOCALSTORAGE + GOOGLE SHEETS)
document.getElementById('btnSave').addEventListener('click', async () => {
  const nome = document.getElementById('pacienteNome').value.trim();
  if (!nome) {
    alert('Por favor, introduza o Nome Completo do paciente antes de gravar.');
    document.getElementById('pacienteNome').focus();
    return;
  }

  const btnSave = document.getElementById('btnSave');
  btnSave.disabled = true;
  btnSave.textContent = 'Gravando... ⏳';

  const patients = getAllPatients();
  const patientId = currentPatientId || 'p_' + Date.now();

  const anamneseData = {};
  document.querySelectorAll('#anamneseTbody tr').forEach(tr => {
    const key = tr.dataset.key;
    if (key) {
      const selectedRadio = tr.querySelector(`input[name="${key}"]:checked`);
      const textInp = tr.querySelector('.table-input');
      anamneseData[key] = {
        resp: selectedRadio ? selectedRadio.value : 'nao',
        obs: textInp ? textInp.value : ''
      };
    }
  });

  const teethData = [];
  document.querySelectorAll('.tooth-row').forEach(row => {
    teethData.push({
      id: row.dataset.toothId,
      proc: row.querySelector('.tooth-proc') ? row.querySelector('.tooth-proc').value : '',
      price: row.querySelector('.tooth-price') ? row.querySelector('.tooth-price').value : '',
      status: row.querySelector('.tooth-status') ? row.querySelector('.tooth-status').value : 'pendente',
      date: row.querySelector('.tooth-date') ? row.querySelector('.tooth-date').value : ''
    });
  });

  const extrasData = [];
  document.querySelectorAll('.extra-row').forEach(row => {
    extrasData.push({
      desc: row.querySelector('.extra-desc') ? row.querySelector('.extra-desc').value : '',
      price: row.querySelector('.extra-price') ? row.querySelector('.extra-price').value : '',
      status: row.querySelector('.extra-status') ? row.querySelector('.extra-status').value : 'pendente',
      date: row.querySelector('.extra-date') ? row.querySelector('.extra-date').value : ''
    });
  });

  const pacienteObjeto = {
    id: patientId,
    nome: nome,
    nasc: document.getElementById('pacienteDataNasc').value,
    cpf: document.getElementById('pacienteCPF').value,
    tel: document.getElementById('pacienteTel').value,
    emergencia: document.getElementById('pacienteEmergencia').value,
    cep: document.getElementById('pacienteCEP') ? document.getElementById('pacienteCEP').value : '',
    logradouro: document.getElementById('pacienteLogradouro') ? document.getElementById('pacienteLogradouro').value : '',
    bairroCidade: document.getElementById('pacienteBairroCidade') ? document.getElementById('pacienteBairroCidade').value : '',
    qp: document.getElementById('queixaPrincipal').value,
    tempo: document.getElementById('tempoEvolucao').value,
    dor: document.getElementById('escalaDor').value,
    ultima: document.getElementById('ultimaVisita').value,
    condPgto: document.getElementById('condicaoPgto').value,
    desconto: document.getElementById('descontoReais').value,
    anamnese: anamneseData,
    teeth: teethData,
    extras: extrasData,
    evolucoes: currentPatientEvolucoes || [],
    documentos: currentPatientDocs || [],
    updatedAt: new Date().toISOString()
  };

  // 1. Grava no LocalStorage local
  patients[patientId] = pacienteObjeto;
  saveAllPatients(patients);
  currentPatientId = patientId;

  const badge = document.getElementById('badgePacienteAtual');
  if (badge) {
    badge.textContent = `Paciente Ativo: ${nome}`;
    badge.className = 'badge-status active-patient';
  }

  const btnExcluir = document.getElementById('btnExcluirPaciente');
  if (btnExcluir) {
    btnExcluir.style.display = 'inline-block';
  }

  // 2. Grava na Planilha via Google Apps Script
  if (URL_APPS_SCRIPT) {
    try {
      const response = await fetch(URL_APPS_SCRIPT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          acao: 'salvarPaciente',
          paciente: pacienteObjeto
        })
      });

      const resultado = await response.json();
      if (resultado.status === 'sucesso') {
        alert(`Ficha de "${nome}" gravada localmente e sincronizada no Google Sheets com sucesso!`);
      } else {
        alert(`Salvo localmente! Aviso da Planilha: ${resultado.mensagem}`);
      }
    } catch (err) {
      console.error('Erro na sincronização com Apps Script:', err);
      alert(`Ficha de "${nome}" gravada localmente. A sincronização com a nuvem ocorrerá na próxima tentativa.`);
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = '💾 Gravar Paciente';
    }
  } else {
    btnSave.disabled = false;
    btnSave.textContent = '💾 Gravar Paciente';
    alert(`Registo de "${nome}" gravado com sucesso!`);
  }
});

// BOTÃO NOVO PACIENTE
document.getElementById('btnNovoPaciente').addEventListener('click', () => {
  const prontuarioVisivel = document.getElementById('viewProntuario').style.display !== 'none';
  if (!prontuarioVisivel || confirm('Deseja iniciar o cadastro de um Novo Paciente? O formulário será limpo.')) {
    mostrarTelaProntuario();
    resetForm();
  }
});

// EXCLUIR PACIENTE
document.getElementById('btnExcluirPaciente').addEventListener('click', () => {
  if (!currentPatientId) return;
  const patients = getAllPatients();
  const p = patients[currentPatientId];
  if (p && confirm(`Tem a certeza de que deseja eliminar o registo de "${p.nome}"? Esta ação não pode ser revertida.`)) {
    delete patients[currentPatientId];
    saveAllPatients(patients);
    resetForm();
    alert('Paciente eliminado.');
  }
});

// BUSCA EM TEMPO REAL
const searchInput = document.getElementById('inputBuscaPaciente');
const searchResults = document.getElementById('searchResultsList');
const clearSearchBtn = document.getElementById('btnClearSearch');

function renderSearchResults(term) {
  const patients = getAllPatients();
  const list = Object.values(patients);
  const query = term.toLowerCase().trim();

  if (!query) {
    searchResults.style.display = 'none';
    return;
  }

  const filtered = list.filter(p => {
    const matchNome = p.nome && p.nome.toLowerCase().includes(query);
    const matchCpf = p.cpf && p.cpf.toLowerCase().includes(query);
    const matchTel = p.tel && p.tel.includes(query);
    return matchNome || matchCpf || matchTel;
  });

  if (filtered.length === 0) {
    searchResults.innerHTML = `<div class="search-item empty">Nenhum paciente encontrado para "${term}"</div>`;
    searchResults.style.display = 'block';
    return;
  }

  searchResults.innerHTML = filtered.map(p => `
    <div class="search-item" data-id="${p.id}">
      <div class="search-item-info">
        <span class="search-item-name">${p.nome}</span>
        <span class="search-item-meta">CPF: ${p.cpf || 'Não informado'} | Tel: ${p.tel || 'Não informado'}</span>
      </div>
      <span class="btn-select-tag">Carregar Ficha &rarr;</span>
    </div>
  `).join('');

  searchResults.style.display = 'block';

  searchResults.querySelectorAll('.search-item:not(.empty)').forEach(item => {
    item.addEventListener('click', () => {
      loadPatient(item.dataset.id);
    });
  });
}

searchInput.addEventListener('input', (e) => renderSearchResults(e.target.value));

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchResults.style.display = 'none';
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-section')) {
    searchResults.style.display = 'none';
  }
});

// BUSCA AUTOMÁTICA DE CEP (VIACEP)
document.getElementById('pacienteCEP').addEventListener('blur', function () {
  const cep = this.value.replace(/\D/g, '');
  if (cep.length === 8) {
    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(res => res.json())
      .then(data => {
        if (!data.erro) {
          document.getElementById('pacienteLogradouro').value = data.logradouro ? `${data.logradouro}, ` : '';
          document.getElementById('pacienteBairroCidade').value = `${data.bairro || ''}, ${data.localidade || ''} - ${data.uf || ''}`;
          document.getElementById('pacienteLogradouro').focus();
          syncDocumentData();
        }
      })
      .catch(err => console.error('Erro na consulta do CEP:', err));
  }
});

// ==========================================
// INTEGRAÇÃO DOS DOCUMENTOS CLÍNICOS
// ==========================================
function syncDocumentData() {
  const nome = document.getElementById('pacienteNome').value.trim() || '_______________________________________';
  const cpf = document.getElementById('pacienteCPF').value.trim() || 'Não informado';
  const nasc = document.getElementById('pacienteDataNasc').value;
  const logradouro = document.getElementById('pacienteLogradouro') ? document.getElementById('pacienteLogradouro').value.trim() : '';
  const bairroCidade = document.getElementById('pacienteBairroCidade') ? document.getElementById('pacienteBairroCidade').value.trim() : '';
  const cep = document.getElementById('pacienteCEP') ? document.getElementById('pacienteCEP').value.trim() : '';

  const sigLabel = document.getElementById('sigPacienteNome');
  if (sigLabel) {
    sigLabel.textContent = document.getElementById('pacienteNome').value.trim() || 'Assinatura do Paciente / Responsável Legal';
  }

  let idadeTexto = '___ anos';
  if (nasc) {
    const diff = Date.now() - new Date(nasc).getTime();
    const ageDate = new Date(diff);
    idadeTexto = `${Math.abs(ageDate.getUTCFullYear() - 1970)} anos`;
  }

  let enderecoCompleto = [logradouro, bairroCidade, cep ? `CEP: ${cep}` : ''].filter(Boolean).join(' - ');
  if (!enderecoCompleto) enderecoCompleto = '_____________________________________________________';

  const hoje = new Date();
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  document.querySelectorAll('.bind-nome').forEach(el => el.textContent = nome);
  document.querySelectorAll('.bind-cpf').forEach(el => el.textContent = cpf);
  document.querySelectorAll('.bind-idade').forEach(el => el.textContent = idadeTexto);
  document.querySelectorAll('.bind-endereco').forEach(el => el.textContent = enderecoCompleto);
  document.querySelectorAll('.bind-data-atual').forEach(el => el.textContent = dataExtenso);

  const dtInicioAtestado = document.getElementById('atDataInicio');
  if (dtInicioAtestado && !dtInicioAtestado.value) {
    dtInicioAtestado.value = hoje.toISOString().split('T')[0];
  }
}

['pacienteNome', 'pacienteCPF', 'pacienteDataNasc', 'pacienteLogradouro', 'pacienteBairroCidade', 'pacienteCEP'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', syncDocumentData);
});

const textAreasAntibiotico = document.querySelectorAll('.bind-antibiotico-text');
if (textAreasAntibiotico.length === 2) {
  textAreasAntibiotico[0].addEventListener('input', (e) => {
    textAreasAntibiotico[1].value = e.target.value;
  });
}

const chkCid = document.getElementById('chkCid');
const cidInputBox = document.getElementById('cidInputBox');
if (chkCid && cidInputBox) {
  chkCid.addEventListener('change', (e) => {
    cidInputBox.style.display = e.target.checked ? 'block' : 'none';
  });
}

// ==========================================
// FUNÇÕES DE ARQUIVAMENTO DE DOCUMENTOS
// ==========================================
function salvarDocumentoGerado(categoria, conteudo) {
  if (!currentPatientId) {
    alert('Por favor, salve ou selecione um paciente antes de arquivar um documento.');
    return;
  }
  if (!conteudo || !conteudo.trim()) {
    alert('O conteúdo do documento está vazio.');
    return;
  }

  const novoDoc = {
    id: 'doc_' + Date.now(),
    tipo: 'clinico',
    categoria: categoria,
    descricao: conteudo.substring(0, 80) + (conteudo.length > 80 ? '...' : ''),
    conteudoCompleto: conteudo,
    data: new Date().toLocaleString('pt-BR')
  };

  currentPatientDocs.unshift(novoDoc);
  atualizarListaDocumentosUI();
  salvarDocsNoStorage();
  alert(`${categoria} arquivado em "Documentos & Exames" com sucesso!`);
}

// Eventos dos botões de arquivamento direto
document.getElementById('btnArquivarReceitaComum').addEventListener('click', () => {
  salvarDocumentoGerado('Receituário Comum', document.getElementById('rcPrescricao').value);
});

document.getElementById('btnArquivarReceitaEspecial').addEventListener('click', () => {
  const txt = textAreasAntibiotico[0] ? textAreasAntibiotico[0].value : '';
  salvarDocumentoGerado('Receituário Especial', txt);
});

document.getElementById('btnArquivarAtestado').addEventListener('click', () => {
  const dias = document.getElementById('atDias').value || '1';
  const inicio = document.getElementById('atDataInicio').value || 'hoje';
  const cidAtivo = document.getElementById('chkCid').checked;
  const codCid = document.getElementById('txtCid').value;
  const textoCompleto = `Atestado concedido para repouso de ${dias} dia(s), com início em ${inicio}.${cidAtivo ? ' CID-10: ' + codCid : ''}`;
  salvarDocumentoGerado('Atestado Odontológico', textoCompleto);
});

document.getElementById('btnArquivarDeclaracao').addEventListener('click', () => {
  const ini = document.getElementById('decHoraIni').value || '';
  const fim = document.getElementById('decHoraFim').value || '';
  const texto = `Declaração de comparecimento no intervalo das ${ini} às ${fim}.`;
  salvarDocumentoGerado('Declaração de Comparecimento', texto);
});

// ==========================================
// UPLOAD DE EXAMES PARA O GOOGLE DRIVE
// ==========================================
document.getElementById('btnUploadDoc').addEventListener('click', () => {
  if (!currentPatientId) {
    alert('Selecione ou grave o paciente ativo primeiro.');
    return;
  }

  const fileInput = document.getElementById('inputFileExame');
  const tipo = document.getElementById('docTipoUpload').value;
  const desc = document.getElementById('docDescUpload').value.trim();
  const nomePaciente = document.getElementById('pacienteNome').value.trim();
  const cpfPaciente = document.getElementById('pacienteCPF').value.trim();

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Por favor, selecione um arquivo de exame.');
    return;
  }

  const file = fileInput.files[0];
  const btnUpload = document.getElementById('btnUploadDoc');
  btnUpload.disabled = true;
  btnUpload.textContent = 'Enviando para o Drive... ⏳';

  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64Data = e.target.result.split(',')[1];

    const payload = {
      acao: 'uploadArquivo',
      pacienteNome: nomePaciente,
      pacienteCPF: cpfPaciente,
      nomeArquivo: file.name,
      mimeType: file.type || 'application/octet-stream',
      tipoExame: tipo,
      descricao: desc || file.name,
      base64: base64Data
    };

    try {
      const response = await fetch(URL_APPS_SCRIPT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const resultado = await response.json();

      if (resultado.status === 'sucesso') {
        const novoDocDrive = {
          id: 'doc_' + Date.now(),
          tipo: 'exame',
          categoria: tipo,
          descricao: desc || file.name,
          fileName: file.name,
          driveUrl: resultado.viewUrl,
          driveId: resultado.fileId,
          data: new Date().toLocaleString('pt-BR')
        };

        currentPatientDocs.unshift(novoDocDrive);
        atualizarListaDocumentosUI();
        salvarDocsNoStorage();

        fileInput.value = '';
        document.getElementById('docDescUpload').value = '';
        alert('Exame armazenado com sucesso no Google Drive!');
      } else {
        alert('Erro retornado pelo Drive: ' + resultado.mensagem);
      }
    } catch (err) {
      console.error(err);
      alert('Falha na conexão com o Google Apps Script para envio do arquivo.');
    } finally {
      btnUpload.disabled = false;
      btnUpload.textContent = '+ Adicionar ao Prontuário';
    }
  };

  reader.readAsDataURL(file);
});

// RENDERIZAÇÃO DA TABELA DE DOCUMENTOS
function atualizarListaDocumentosUI() {
  const tbody = document.getElementById('listaDocumentosTbody');
  const badgeTotal = document.getElementById('badgeTotalDocs');
  badgeTotal.textContent = `${currentPatientDocs.length} ${currentPatientDocs.length === 1 ? 'item' : 'itens'}`;

  if (currentPatientDocs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 24px;">Nenhum documento ou exame gravado para este paciente.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentPatientDocs.map((doc) => {
    let botaoVisualizar = '';

    if (doc.tipo === 'exame') {
      botaoVisualizar = `<button type="button" class="btn-action-doc" onclick="visualizarArquivo('${doc.id}')">Visualizar</button>`;
    } else {
      botaoVisualizar = `<button type="button" class="btn-action-doc" onclick="visualizarTexto('${doc.id}')">Ler Texto</button>`;
    }

    return `
      <tr>
        <td><small>${doc.data}</small></td>
        <td>
          <span class="badge-doc-tipo ${doc.tipo === 'exame' ? 'exame' : ''}">${doc.categoria}</span>
        </td>
        <td><strong>${doc.descricao}</strong></td>
        <td style="text-align: center;">
          ${botaoVisualizar}
          <button type="button" class="btn-action-doc danger" onclick="removerDocumento('${doc.id}')" title="Excluir">&times;</button>
        </td>
      </tr>
    `;
  }).join('');
}

function visualizarArquivo(id) {
  const doc = currentPatientDocs.find(d => d.id === id);
  if (!doc) return;

  if (doc.driveUrl) {
    window.open(doc.driveUrl, '_blank');
  } else if (doc.fileData) {
    const win = window.open();
    win.document.write(`<iframe src="${doc.fileData}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
  }
}

function visualizarTexto(id) {
  const doc = currentPatientDocs.find(d => d.id === id);
  if (!doc) return;
  alert(`[${doc.categoria} - ${doc.data}]\n\n${doc.conteudoCompleto}`);
}

function removerDocumento(id) {
  if (confirm('Deseja remover este documento do prontuário?')) {
    currentPatientDocs = currentPatientDocs.filter(d => d.id !== id);
    atualizarListaDocumentosUI();
    salvarDocsNoStorage();
  }
}

function salvarDocsNoStorage() {
  if (!currentPatientId) return;
  const patients = getAllPatients();
  if (patients[currentPatientId]) {
    patients[currentPatientId].documentos = currentPatientDocs;
    saveAllPatients(patients);
  }
}

// SINCRONIZAÇÃO INICIAL COM GOOGLE SHEETS (PACIENTES + MEDICAÇÕES + AGENDA)
async function sincronizarPacientesDaPlanilha() {
  if (!URL_APPS_SCRIPT) return;
  try {
    const resposta = await fetch(URL_APPS_SCRIPT);
    const resultado = await resposta.json();
    if (resultado.status === 'sucesso') {
      if (resultado.pacientes) {
        const locais = getAllPatients();
        const mesclados = { ...locais, ...resultado.pacientes };
        saveAllPatients(mesclados);
      }

      if (resultado.medicacoes && Array.isArray(resultado.medicacoes.comum) && Array.isArray(resultado.medicacoes.especial)) {
        bancoMedicacoes = resultado.medicacoes;
        localStorage.setItem(MEDS_STORAGE_KEY, JSON.stringify(bancoMedicacoes));
        popularSelectsMedicacoes();
      }

      if (Array.isArray(resultado.agenda)) {
        listaAgendamentos = resultado.agenda;
        localStorage.setItem(AGENDA_STORAGE_KEY, JSON.stringify(listaAgendamentos));
        renderizarCalendarioMensal();
      }
    }
  } catch (err) {
    console.warn('Google Sheets indisponível no momento. Utilizando banco local.', err);
  }
}

// ==========================================
// SISTEMA DE AUTENTICAÇÃO (COMPATÍVEL MOBILE)
// ==========================================
const AUTH_USER = "pedrosindeaux";
const AUTH_PASS_HASH = "82a69b30a88428c3e2b5e048686bebb36c5893979b5bcbbae825e4783e12cb2d";

async function gerarHashSHA256(texto) {
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(texto);
}

function sha256Fallback(ascii) {
  function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  var mathPow = Math.pow, maxWord = mathPow(2, 32), i, j, result = '';
  var words = [], asciiBitLength = ascii.length * 8;
  var hash = sha256Fallback.h = sha256Fallback.h || [];
  var k = sha256Fallback.k = sha256Fallback.k || [];
  var primeCounter = k.length, isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength);
  for (j = 0; j < words.length;) {
    var w = words.slice(j, j += 16), oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
        + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

function iniciarSistema() {
  document.getElementById('loginOverlay').style.display = 'none';
  popularSelectsMedicacoes();
  resetForm();
  mostrarTelaCalendario();
  sincronizarPacientesDaPlanilha();
}

async function tentarLogin(e) {
  if (e) e.preventDefault();
  const erroEl = document.getElementById('loginErro');
  try {
    const userDigitado = document.getElementById('loginUsuario').value.trim().toLowerCase();
    const passDigitada = document.getElementById('loginSenha').value;
    const hashDigitado = await gerarHashSHA256(passDigitada);

    if (userDigitado === AUTH_USER.trim().toLowerCase() && hashDigitado === AUTH_PASS_HASH.trim().toLowerCase()) {
      sessionStorage.setItem('sindeaux_auth', 'ok');
      erroEl.style.display = 'none';
      document.getElementById('loginSenha').value = '';
      iniciarSistema();
    } else {
      erroEl.textContent = 'Usuário ou senha incorretos.';
      erroEl.style.display = 'block';
    }
  } catch (err) {
    erroEl.textContent = 'Erro ao validar: ' + err.message;
    erroEl.style.display = 'block';
  }
}

document.getElementById('formLogin').addEventListener('submit', tentarLogin);

const btnBloquear = document.getElementById('btnBloquear');
if (btnBloquear) {
  btnBloquear.addEventListener('click', () => {
    sessionStorage.removeItem('sindeaux_auth');
    document.getElementById('loginOverlay').style.display = 'flex';
  });
}

// ==========================================
// MODAL: LISTAGEM DE TODOS OS PACIENTES
// ==========================================
function obterDataUltimoAtendimento(paciente) {
  let maisRecente = null;

  const registrarData = (valor) => {
    if (!valor) return;
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(valor)
      ? new Date(`${valor}T12:00:00`)
      : new Date(valor);
    if (!isNaN(dt.getTime()) && (!maisRecente || dt > maisRecente)) {
      maisRecente = dt;
    }
  };

  registrarData(paciente.updatedAt);

  if (Array.isArray(paciente.teeth)) {
    paciente.teeth.forEach(t => registrarData(t.date));
  }
  if (Array.isArray(paciente.extras)) {
    paciente.extras.forEach(ex => registrarData(ex.date));
  }
  if (Array.isArray(paciente.evolucoes)) {
    paciente.evolucoes.forEach(ev => registrarData(ev.data));
  }

  return maisRecente;
}

function renderizarTabelaPacientes(filtro = '') {
  const tbody = document.getElementById('tabelaPacientesTbody');
  const labelTotal = document.getElementById('totalPacientesLabel');
  const pacientes = Object.values(getAllPatients());
  const termo = filtro.toLowerCase().trim();

  const filtrados = pacientes
    .filter(p => {
      if (!termo) return true;
      return (
        (p.nome && p.nome.toLowerCase().includes(termo)) ||
        (p.cpf && p.cpf.toLowerCase().includes(termo)) ||
        (p.tel && p.tel.includes(termo))
      );
    })
    .map(p => ({
      ...p,
      _ultimaData: obterDataUltimoAtendimento(p)
    }))
    .sort((a, b) => {
      if (!a._ultimaData && !b._ultimaData) return (a.nome || '').localeCompare(b.nome || '');
      if (!a._ultimaData) return 1;
      if (!b._ultimaData) return -1;
      return b._ultimaData - a._ultimaData;
    });

  labelTotal.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'paciente cadastrado' : 'pacientes cadastrados'}`;

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding: 24px;">Nenhum paciente encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtrados.map(p => {
    const dataFormatada = p._ultimaData
      ? p._ultimaData.toLocaleDateString('pt-BR')
      : 'Sem registro';

    return `
      <tr>
        <td><strong>${p.nome || 'Sem nome'}</strong></td>
        <td>${p.cpf || '—'}</td>
        <td>${p.tel || '—'}</td>
        <td>${dataFormatada}</td>
        <td style="text-align: center;">
          <button type="button" class="btn btn-sm btn-outline-primary btn-abrir-paciente" data-id="${p.id}">
            Abrir Ficha
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-abrir-paciente').forEach(btn => {
    btn.addEventListener('click', () => {
      loadPatient(btn.dataset.id);
      document.getElementById('modalPacientes').style.display = 'none';
    });
  });
}

const modalPacientes = document.getElementById('modalPacientes');
const btnListarPacientes = document.getElementById('btnListarPacientes');
const btnFecharModalPacientes = document.getElementById('btnFecharModalPacientes');
const filtroModalPacientes = document.getElementById('filtroModalPacientes');

if (btnListarPacientes) {
  btnListarPacientes.addEventListener('click', () => {
    filtroModalPacientes.value = '';
    renderizarTabelaPacientes();
    modalPacientes.style.display = 'flex';
    filtroModalPacientes.focus();
  });
}

if (btnFecharModalPacientes) {
  btnFecharModalPacientes.addEventListener('click', () => {
    modalPacientes.style.display = 'none';
  });
}

if (modalPacientes) {
  modalPacientes.addEventListener('click', (e) => {
    if (e.target === modalPacientes) {
      modalPacientes.style.display = 'none';
    }
  });
}

if (filtroModalPacientes) {
  filtroModalPacientes.addEventListener('input', (e) => {
    renderizarTabelaPacientes(e.target.value);
  });
}

// INICIALIZAÇÃO PROTEGIDA
window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('sindeaux_auth') === 'ok') {
    iniciarSistema();
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
});