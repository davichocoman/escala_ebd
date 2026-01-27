// Inclui SweetAlert2 via CDN (adicione isso no <head> do HTML se preferir)
const swalScript = document.createElement('script');
swalScript.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
document.head.appendChild(swalScript);
// Aguarda o SweetAlert carregar (opcional, mas garante que Swal esteja disponível)
swalScript.onload = () => {
    console.log('SweetAlert2 carregado com sucesso');
};
const API_BASE = 'https://api-escala.onrender.com/api';
// ============================================================
// 1. ESTADO GLOBAL
// ============================================================
const SISTEMA = {
    usuario: null,
    token: null,
    dados: {
        membros: [],
        agendaPastor: [],
        dashboard: { agenda: [], reservas: [] }
    }
};
// Função auxiliar para acessar chaves ignorando case
function getVal(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    const upperKey = key.toUpperCase();
    for (const k in obj) {
        if (k.toUpperCase() === upperKey) {
            return obj[k] || '';
        }
    }
    return '';
}
//função única para decidir se um item deve aparecer
function eventoValido(item, chaveEvento, chaveData) {
    const nome = getVal(item, chaveEvento)?.trim();
    // Aceita vazio ou null como nome → mostra mesmo assim (para depuração)
    // if (!nome || nome.toLowerCase() === 'null') return false;

    const dataStr = getVal(item, chaveData)?.trim();
    if (!dataStr) return false;

    const data = dataParaObj(dataStr);
    if (isNaN(data.getTime())) {
        console.warn("Data inválida:", dataStr, item);
        return false;
    }

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    return data >= hoje;
}
// ============================================================
// 2. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica Login
    const userStr = sessionStorage.getItem('usuario_sistema');
    SISTEMA.token = sessionStorage.getItem('token_sistema');
    if (!userStr || !SISTEMA.token) {
        Swal.fire({
            icon: 'warning',
            title: 'Sessão expirada',
            text: 'Por favor, faça login novamente.',
            timer: 3000,
            showConfirmButton: false
        }).then(() => {
            window.location.href = '/login';
        });
        return;
    }
    SISTEMA.usuario = JSON.parse(userStr);
    // 2. Mostra nome no topo
    const nome = getVal(SISTEMA.usuario, 'NOME') ? getVal(SISTEMA.usuario, 'NOME').split(' ')[0] : 'Admin';
    const display = document.getElementById('userDisplay');
    if (display) display.innerHTML = `Olá, <strong>${nome}</strong>`;
    // 3. Configura botões e eventos
    configurarBotoes();
    // 4. Carrega todos os dados
    await carregarTudoDoBanco();
});
// ============================================================
// 3. CARREGAMENTO CENTRAL
// ============================================================
async function carregarTudoDoBanco() {
    console.log("🔄 Baixando todos os dados da API...");
    // Feedback visual
    const igrejaEl = document.getElementById('list-dash-igreja');
    const membrosEl = document.getElementById('lista-membros'); // atualizado para card-list
    const pastorEl = document.getElementById('lista-agenda-pastor');
    if (igrejaEl) igrejaEl.innerHTML = '<li>Carregando...</li>';
    if (membrosEl) membrosEl.innerHTML = '<div class="empty-msg">Atualizando...</div>';
    if (pastorEl) pastorEl.innerHTML = '<div class="empty-msg">Atualizando...</div>';
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-admin-token': SISTEMA.token
    };
    try {
        const [resMembros, resPastor, resDash] = await Promise.all([
            fetch(`${API_BASE}/membros`, { headers }),
            fetch(`${API_BASE}/agenda-pastor`, { headers }),
            fetch(`${API_BASE}/patrimonio/dados`, { headers })
        ]);
        if (resMembros.ok) SISTEMA.dados.membros = await resMembros.json();
        if (resPastor.ok) SISTEMA.dados.agendaPastor = await resPastor.json();
        if (resDash.ok) SISTEMA.dados.dashboard = await resDash.json();
        console.log("✅ Dados carregados!", SISTEMA.dados);
        renderizarMembros();
        renderizarAgendaPastor();
        renderizarDashboard();
        renderizarMeusDados();
    } catch (erro) {
        console.error("Erro fatal ao carregar:", erro);
        Swal.fire({
            icon: 'error',
            title: 'Falha na conexão',
            text: 'Não foi possível carregar os dados. Verifique sua internet ou credenciais.',
            confirmButtonText: 'Tentar novamente',
            confirmButtonColor: '#3b82f6'
        }).then((result) => {
            if (result.isConfirmed) {
                carregarTudoDoBanco();
            }
        });
    }
}
// ============================================================
// 4. RENDERIZAÇÃO (mantidas como cards)
// ============================================================
function renderizarDashboard() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    // --- NOVA LÓGICA DE ESTATÍSTICAS ---
    const membros = SISTEMA.dados.membros || [];
   
    // Contagem usando reduce para performance
    const stats = membros.reduce((acc, m) => {
        const p = getVal(m, 'PERFIL').toUpperCase();
        if (p === 'CONGREGADO') acc.congregados++;
        else if (p === 'MEMBRO') acc.membros++;
        else if (p === 'PASTOR') acc.pastores++;
        else if (p === 'ADMIN') acc.admins++;
        return acc;
    }, { congregados: 0, membros: 0, pastores: 0, admins: 0 });
    // Atualiza os números na tela
    document.getElementById('count-congregados').innerText = stats.congregados;
    document.getElementById('count-membros').innerText = stats.membros;
    document.getElementById('count-pastores').innerText = stats.pastores;
    document.getElementById('count-admins').innerText = stats.admins;
    // Agenda do Pastor com Início e Fim
    const listaPastor = SISTEMA.dados.agendaPastor || [];
    preencherListaDash('list-dash-pastor', listaPastor, 'EVENTO', 'DATA', (item, chaveData) => eventoValido(item, 'EVENTO', chaveData), 'HORARIO', 'HORARIO_FIM');
    // Reservas (Já costumam ter início/fim no seu backend)
    const listaReservas = SISTEMA.dados.dashboard.reservas || [];
    preencherListaDash(
      'list-dash-reservas',
      listaReservas,
      'EVENTO',
      'DATA',
      (item, chaveData) => eventoValido(item, 'ATIVIDADE', chaveData),
      'HORARIO_INICIO',
      'HORARIO_FIM'
    );
    // Igreja (Geralmente tem apenas um horário fixo)
    const listaIgreja = SISTEMA.dados.dashboard.agenda || [];
    preencherListaDash(
      'list-dash-igreja',
      listaIgreja,
      'EVENTO',
      'DATA',
      (item, chaveData) => eventoValido(item, 'EVENTO', chaveData),
      'HORARIO'
    );
}
function preencherListaDash(idElemento, lista, chaveTitulo, chaveData, filtro, chaveHoraIni = '', chaveHoraFim = '') {
    const ul = document.getElementById(idElemento);
    if (!ul) return;
    const itensFiltrados = lista.filter(item => filtro(item, chaveData));
    itensFiltrados.sort((a,b) => dataParaObj(getVal(a, chaveData)) - dataParaObj(getVal(b, chaveData)));
    if (itensFiltrados.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada agendado.</li>';
        return;
    }
    ul.innerHTML = itensFiltrados.map(item => {
        const hIni = chaveHoraIni ? getVal(item, chaveHoraIni) : '';
        const hFim = chaveHoraFim ? getVal(item, chaveHoraFim) : '';
       
        // Formata: "26/01 | 19:00 - 21:00" ou apenas "26/01 | 19:00"
        const tempo = hIni ? ` | ${hIni}${hFim ? ' - ' + hFim : ''}` : '';
        return `
            <li>
                <strong>${getVal(item, chaveTitulo)}</strong>
                <span>${getVal(item, chaveData)}${tempo}</span>
            </li>
        `;
    }).join('');
}
function renderizarMembros() {
    const busca = (document.getElementById('buscaMembro')?.value || '').toLowerCase();
    const container = document.getElementById('lista-membros');
    if (!container) return;
    const filtrados = SISTEMA.dados.membros.filter(m =>
        getVal(m, 'NOME').toLowerCase().includes(busca) ||
        getVal(m, 'CPF').includes(busca)
    );
    if (filtrados.length === 0) {
        container.innerHTML = '<div class="empty-msg">Nenhum membro encontrado.</div>';
        return;
    }
    container.innerHTML = filtrados.map(m => `
        <div class="member-card">
            <div class="card-header">
                <strong>${getVal(m, 'NOME')}</strong>
            </div>
            <div class="card-body">
                <div><strong>PERFIL:</strong> <span class="badge-perfil">${getVal(m, 'PERFIL') || 'MEMBRO'}</span></div>
                <div><strong>CPF:</strong> ${getVal(m, 'CPF')}</div>
            </div>
            <div class="card-actions">
                <button class="btn-icon edit" onclick="prepararEdicaoMembro('${getVal(m, 'ID')}')">✏️</button>
                <button class="btn-icon delete" onclick="deletarItem('${getVal(m, 'ID')}', 'membros')">🗑️</button>
            </div>
        </div>
    `).join('');
}
function renderizarAgendaPastor() {
    const container = document.getElementById('lista-agenda-pastor');
    if (!container) return;
    const lista = SISTEMA.dados.agendaPastor || [];
    const filtered = lista.filter(a => eventoValido(a, 'EVENTO', 'DATA'));
    filtered.sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-msg">Agenda vazia.</div>';
        return;
    }
    let html = "";
    // Adicionei cabeçalho de mês igual na agenda geral/reservas para ficar bonito
    let mesAtual = -1;
    filtered.forEach(a => {
        const d = dataParaObj(getVal(a, 'DATA'));
        const m = d.getMonth() + 1;
       
        if (m !== mesAtual) {
            mesAtual = m;
            html += `<div class="month-header">${NOMES_MESES[m]}</div>`;
        }
        // MUDANÇA AQUI: Usando 'member-card' e estrutura igual a de Reservas
        // Cor azul (#3b82f6) para diferenciar do verde das reservas
        html += `
        <div class="member-card" style="border-left: 5px solid #3b82f6;">
            <div class="card-header">
                <strong>${getVal(a, 'EVENTO')}</strong>
            </div>
            <div class="card-body">
                <div><strong>Data:</strong> ${getVal(a, 'DATA')}</div>
                <div><strong>Horário:</strong> ${getVal(a, 'HORARIO')} ${getVal(a, 'HORARIO_FIM') ? '- ' + getVal(a, 'HORARIO_FIM') : ''}</div>
                <div><strong>Local:</strong> ${getVal(a, 'LOCAL')}</div>
                ${getVal(a, 'OBSERVACAO') ? `<div><strong>Obs:</strong> ${getVal(a, 'OBSERVACAO')}</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn-icon edit" onclick="prepararEdicaoPastor('${getVal(a, 'ID')}')">✏️</button>
                <button class="btn-icon delete" onclick="deletarItem('${getVal(a, 'ID')}', 'agenda-pastor')">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}
// --- Funções Auxiliares de Formatação para o Perfil ---
const formatarCPF = (valor) => {
    const cpf = valor.toString().replace(/\D/g, '').padStart(11, '0');
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};
const formatarData = (valor) => {
    if (!valor) return '';
    if (valor.includes('/') && valor.split('/').length === 3) return valor;
    const data = new Date(valor);
    return isNaN(data) ? valor : data.toLocaleDateString('pt-BR');
};
function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    if (!div || !SISTEMA.usuario) return;
    // 1. Definição das Seções para manter o padrão visual
    const secoes = [
        {
            titulo: 'Informações Básicas',
            campos: [
                { key: 'NOME', label: 'Nome Completo', span: 12 },
                { key: 'NASCIMENTO', label: 'Data de Nascimento', span: 6, isDate: true },
                { key: 'CPF', label: 'CPF', span: 6, isCPF: true },
                { key: 'ESTADO_CIVIL', label: 'Estado Civil', span: 6 },
                { key: 'CONTATO', label: 'WhatsApp/Telefone', span: 6 }
            ]
        },
        {
            titulo: 'Família e Filiação',
            campos: [
                { key: 'PAI', label: 'Nome do Pai', span: 6 },
                { key: 'MAE', label: 'Nome da Mãe', span: 6 },
                { key: 'CONJUGE', label: 'Cônjuge', span: 6 },
                { key: 'FILHOS', label: 'Filhos', span: 6, isList: true }
            ]
        },
        {
            titulo: 'Endereço e Profissão',
            campos: [
                { key: 'ENDERECO', label: 'Endereço Residencial', span: 12 },
                { key: 'PROFISSAO', label: 'Profissão', span: 6 },
                { key: 'SITUACAO_TRABALHO', label: 'Situação Atual', span: 6 }
            ]
        },
        {
            titulo: 'Dados Eclesiásticos',
            campos: [
                { key: 'CARGO', label: 'Cargo Atual', span: 6 },
                { key: 'DEPARTAMENTO', label: 'Departamento', span: 6 }
            ]
        }
    ];
    div.innerHTML = '';
    secoes.forEach(secao => {
        const temDados = secao.campos.some(c => getVal(SISTEMA.usuario, c.key));
        if (!temDados) return;
        // Título da Seção
        div.innerHTML += `<div class="section-title-bar">${secao.titulo}</div>`;
        secao.campos.forEach(campo => {
            let valor = getVal(SISTEMA.usuario, campo.key);
            if (!valor) return;
            let htmlConteudo = '';
            // Aplicação das mesmas lógicas de pílulas e máscaras
            if (campo.isCPF) {
                htmlConteudo = `<span class="data-pill">${formatarCPF(valor)}</span>`;
            }
            else if (campo.isDate) {
                htmlConteudo = `<span class="data-pill">${formatarData(valor)}</span>`;
            }
            else if (campo.isList && valor.toString().includes(',')) {
                htmlConteudo = valor.split(',')
                    .map(item => `<span class="data-pill">${item.trim()}</span>`)
                    .join('');
            }
            else {
                htmlConteudo = `<span class="data-pill">${valor}</span>`;
            }
            div.innerHTML += `
                <div class="form-group" style="grid-column: span ${campo.span}">
                    <label>${campo.label}</label>
                    <div class="valor-box">
                        ${htmlConteudo}
                    </div>
                </div>
            `;
        });
    });
    if (div.innerHTML === '') {
        div.innerHTML = '<p class="empty-msg">Nenhum dado disponível para exibição.</p>';
    }
}
// ============================================================
// 5. INTERAÇÕES E BOTÕES
// ============================================================
function configurarBotoes() {
    const buscaEl = document.getElementById('buscaMembro');
   
    if (buscaEl) {
        // Criamos uma versão "debounced" da renderização
        const buscarComDebounce = debounce(() => {
            console.log("🔍 Filtrando membros...");
            renderizarMembros();
        }, 400); // 400ms é o "doce balanço" entre velocidade e economia de CPU
        // Trocamos o renderizarMembros direto pela versão com debounce
        buscaEl.addEventListener('input', buscarComDebounce);
    }
    // Restante dos seus formulários...
    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (f.id === 'formMembro') await salvarMembro();
            if (f.id === 'formPastor') await salvarPastor();
        });
    });
}
window.mostrarTela = function(telaId, btn) {
    ['dashboard', 'membros', 'pastor', 'perfil', 'agenda-geral', 'reservas'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const alvo = document.getElementById('sec-' + telaId);
    if (alvo) alvo.classList.remove('hidden');
    if (btn) btn.classList.add('active');
    // Gatilhos de renderização
    if (telaId === 'dashboard') renderizarDashboard();
    if (telaId === 'membros') renderizarMembros();
    if (telaId === 'agenda-geral') renderizarAgendaGeralCards(); // Nova
    if (telaId === 'reservas') renderizarReservasCards(); // Nova
};
window.logout = function() {
    Swal.fire({
        icon: 'question',
        title: 'Deseja sair?',
        text: "Você será redirecionado para a tela de login.",
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#dc2626',
        confirmButtonText: 'Sim, sair',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.clear();
            window.location.href = '/login';
        }
    });
};
// ============================================================
// 6. CRUD
// ============================================================
window.abrirModalMembro = function() {
    document.getElementById('formMembro')?.reset();
    document.getElementById('m_id').value = '';
    document.getElementById('modalMembro')?.classList.remove('hidden');
};
window.prepararEdicaoMembro = function(id) {
    const m = SISTEMA.dados.membros.find(x => getVal(x, 'ID') == id);
    if (!m) {
        Swal.fire({
            icon: 'error',
            title: 'Membro não encontrado',
            text: 'O membro selecionado não está mais na lista.'
        });
        return;
    }
    const set = (eid, val) => {
        const el = document.getElementById(eid);
        if (el) el.value = val || '';
    };
    set('m_id', getVal(m, 'ID'));
    set('m_nome', getVal(m, 'NOME'));
    set('m_nasc', dataIso(getVal(m, 'NASCIMENTO')));
    set('m_cpf', getVal(m, 'CPF'));
    set('m_estado', getVal(m, 'ESTADO_CIVIL'));
    set('m_data_casamento', dataIso(getVal(m, 'DATA_CASAMENTO')));
    set('m_conjuge', getVal(m, 'CONJUGE'));
    set('m_filhos', getVal(m, 'FILHOS'));
    set('m_pai', getVal(m, 'PAI'));
    set('m_endereco', getVal(m, 'ENDERECO'));
    set('m_contato', getVal(m, 'CONTATO'));
    set('m_mae', getVal(m, 'MAE'));
    set('m_profissao', getVal(m, 'PROFISSAO'));
    set('m_situacao', getVal(m, 'SITUACAO_TRABALHO'));
    set('m_cargo', getVal(m, 'CARGO'));
    set('m_departamento', getVal(m, 'DEPARTAMENTO'));
    set('m_perfil', getVal(m, 'PERFIL'));
    document.getElementById('modalMembro')?.classList.remove('hidden');
};
async function salvarMembro() {
    const id = document.getElementById('m_id')?.value;
    const dados = {
        NOME: document.getElementById('m_nome')?.value.trim() || '',
        NASCIMENTO: dataBr(document.getElementById('m_nasc')?.value),
        CPF: document.getElementById('m_cpf')?.value.trim() || '',
        ESTADO_CIVIL: document.getElementById('m_estado')?.value || '',
        DATA_CASAMENTO: dataBr(document.getElementById('m_data_casamento')?.value),
        CONJUGE: document.getElementById('m_conjuge')?.value.trim() || '',
        FILHOS: document.getElementById('m_filhos')?.value.trim() || '',
        PAI: document.getElementById('m_pai')?.value.trim() || '',
        MAE: document.getElementById('m_mae')?.value.trim() || '',
        ENDERECO: document.getElementById('m_endereco')?.value.trim() || '',
        CONTATO: document.getElementById('m_contato')?.value.trim() || '',
        PROFISSAO: document.getElementById('m_profissao')?.value.trim() || '',
        SITUACAO_TRABALHO: document.getElementById('m_situacao')?.value || '',
        CARGO: document.getElementById('m_cargo')?.value.trim() || '',
        DEPARTAMENTO: document.getElementById('m_departamento')?.value.trim() || '',
        PERFIL: document.getElementById('m_perfil')?.value || ''
    };
    // Validação básica no front
    if (!dados.NOME || !dados.CPF || !dados.NASCIMENTO || !dados.ENDERECO || !dados.CONTATO) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos obrigatórios',
            text: 'Nome, CPF, Data de Nascimento, Endereço e Contato são obrigatórios!'
        });
        return;
    }
    await enviarDados(`${API_BASE}/membros`, id, dados);
    document.getElementById('modalMembro')?.classList.add('hidden');
}
window.abrirModalEventoPastor = function() {
    document.getElementById('formPastor')?.reset();
    document.getElementById('p_id').value = '';
    document.getElementById('modalPastor')?.classList.remove('hidden');
};
window.prepararEdicaoPastor = function(id) {
    const a = SISTEMA.dados.agendaPastor.find(x => getVal(x, 'ID') == id);
    if (!a) {
        Swal.fire({
            icon: 'error',
            title: 'Compromisso não encontrado',
            text: 'O item selecionado não está mais na agenda.'
        });
        return;
    }
    document.getElementById('p_id').value = getVal(a, 'ID');
    document.getElementById('p_evento').value = getVal(a, 'EVENTO');
    document.getElementById('p_data').value = dataIso(getVal(a, 'DATA'));
    document.getElementById('p_hora').value = getVal(a, 'HORARIO');
    document.getElementById('p_local').value = getVal(a, 'LOCAL');
    document.getElementById('p_obs').value = getVal(a, 'OBSERVACAO');
    document.getElementById('modalPastor')?.classList.remove('hidden');
};
async function salvarPastor() {
    const id = document.getElementById('p_id')?.value;
    const dados = {
        EVENTO: document.getElementById('p_evento')?.value.trim() || '',
        DATA: dataBr(document.getElementById('p_data')?.value),
        HORARIO: document.getElementById('p_hora')?.value || '',
        HORARIO_FIM: document.getElementById('p_hora_fim')?.value || '', // CAPTURA O FIM
        LOCAL: document.getElementById('p_local')?.value.trim() || '',
        OBSERVACAO: document.getElementById('p_obs')?.value.trim() || ''
    };
    if (!dados.EVENTO || !dados.DATA || !dados.HORARIO || !dados.HORARIO_FIM ) {
        Swal.fire({ icon: 'warning', title: 'Campos obrigatórios', text: 'Evento, Data, Horário e Horário de Término são obrigatórios!' });
        return;
    }
    await enviarDados(`${API_BASE}/agenda-pastor`, id, dados);
    fecharModal('modalPastor');
}
window.deletarItem = async function(id, endpoint) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Esta ação não pode ser desfeita!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await fetch(`${API_BASE}/${endpoint}/${id}`, {
                    method: 'DELETE',
                    headers: { 'x-admin-token': SISTEMA.token }
                });
                await carregarTudoDoBanco();
                Swal.fire({
                    icon: 'success',
                    title: 'Excluído!',
                    text: 'O item foi removido com sucesso.',
                    timer: 2000,
                    showConfirmButton: false
                });
            } catch (e) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao excluir',
                    text: 'Não foi possível remover o item. Tente novamente.'
                });
            }
        }
    });
};
window.fecharModal = function(id) {
    document.getElementById(id)?.classList.add('hidden');
};
// ============================================================
// 7. UTILITÁRIOS
// ============================================================
async function enviarDados(urlBase, id, payload) {
    const url = id ? `${urlBase}/${id}` : urlBase;
    const method = id ? 'PUT' : 'POST';
    // Seleciona o botão de submit do formulário ativo para desabilitá-lo
    const btnSubmit = document.querySelector('form:not(.hidden) button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Processando...';
    }
    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': SISTEMA.token
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
            // Se o backend retornou erro de CPF já existente (400)
            throw new Error(data.detail || 'Falha na API');
        }
        await carregarTudoDoBanco();
        Swal.fire({
            icon: 'success',
            title: 'Salvo com sucesso!',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao salvar',
            text: e.message
        });
    } finally {
        // REABILITA o botão após terminar o processo (sucesso ou erro)
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Salvar';
        }
    }
}
function dataParaObj(str) {
    if (!str || typeof str !== 'string') return new Date(0);
    const p = str.split('/');
    return p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date(0);
}
function dataIso(str) {
    if (!str) return '';
    const p = str.split('/');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
}
function dataBr(str) {
    if (!str) return '';
    const p = str.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
}
// --- Utilitário de Debounce ---
// Retorna uma função que, enquanto continuar sendo invocada, não será executada.
// A função só será executada após 'wait' milissegundos de inatividade.
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}
// ============================================================
// 8. SIDEBAR
// ============================================================
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 990;
            display: none;
            transition: opacity 0.28s ease;
            opacity: 0;
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', toggleSidebar);
    }
    if (isOpen) {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 280);
    }
};
document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    if (e.target.closest('.menu-item') &&
        sidebar.classList.contains('open') &&
        window.innerWidth < 768) {
        toggleSidebar();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
});
const NOMES_MESES = ["", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
function renderizarAgendaGeralCards() {
    const container = document.getElementById('lista-agenda-geral-cards');
    const dados = SISTEMA.dados.dashboard.agenda || [];
    dados.sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));
    let html = "";
    let mesAtual = -1;
    dados
      .filter(ev => eventoValido(ev, 'EVENTO', 'DATA'))
      .sort((a,b) => dataParaObj(getVal(a,'DATA')) - dataParaObj(getVal(b,'DATA')))
      .forEach(ev => {
          const d = dataParaObj(getVal(ev, 'DATA'));
          const m = d.getMonth() + 1;
   
          if (m !== mesAtual) {
              mesAtual = m;
              html += `<div class="month-header">${NOMES_MESES[m]}</div>`;
          }
        html += `
            <div class="member-card">
                <div class="card-header"><strong>${getVal(ev, 'EVENTO')}</strong></div>
                <div class="card-body">
                    <div><strong>Data:</strong> ${getVal(ev, 'DATA')}</div>
                    <div><strong>Local:</strong> ${getVal(ev, 'LOCAL')}</div>
                    <div><strong>Responsável:</strong> ${getVal(ev, 'RESPONSAVEL')}</div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon edit" onclick="prepararEdicaoGeral('${getVal(ev, 'ID')}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarItem('${getVal(ev, 'ID')}', 'agenda-geral')">🗑️</button>
                </div>
            </div>`;
       
    });
    container.innerHTML = html || '<p class="empty-msg">Nenhum evento cadastrado.</p>';
}
// 3. Função para renderizar Reservas
function renderizarReservasCards() {
    const container = document.getElementById('lista-reservas-cards');
    const dados = SISTEMA.dados.dashboard.reservas || [];
   
    dados.sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));
    let html = "";
    let mesAtual = -1;
    dados
      .filter(res => eventoValido(res, 'ATIVIDADE', 'DATA'))
      .sort((a,b) => dataParaObj(getVal(a,'DATA')) - dataParaObj(getVal(b,'DATA')))
      .forEach(res => {
          const d = dataParaObj(getVal(res, 'DATA'));
          const m = d.getMonth() + 1;
   
          if (m !== mesAtual) {
              mesAtual = m;
              html += `<div class="month-header">${NOMES_MESES[m]}</div>`;
          }
        // Note o uso de getVal(res, 'id') minúsculo para bater com o backend
        html += `
            <div class="member-card" style="border-left: 5px solid var(--green);">
                <div class="card-header"><strong>${getVal(res, 'EVENTO')}</strong></div>
                <div class="card-body">
                    <div><strong>Data:</strong> ${getVal(res, 'DATA')}</div>
                    <div>
                      <strong>Horário:</strong>
                      ${getVal(res, 'HORARIO_INICIO') || getVal(res, 'inicio')}
                      -
                      ${getVal(res, 'HORARIO_FIM') || getVal(res, 'fim')}
                    </div>
                    <div><strong>Local:</strong> ${getVal(res, 'LOCAL')}</div>
                    <div><strong>Responsável:</strong> ${getVal(res, 'RESPONSAVEL')}</div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon edit" onclick="prepararEdicaoReserva('${getVal(res, 'id')}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarItem('${getVal(res, 'id')}', 'reservas')">🗑️</button>
                </div>
            </div>`;
    });
    container.innerHTML = html || '<p class="empty-msg">Nenhuma reserva encontrada.</p>';
}
// Funções para Abrir os Modais
window.abrirModalAgendaGeral = () => {
    document.getElementById('formAgendaGeral').reset();
    document.getElementById('ag_id').value = ''; // GARANTE QUE ESTÁ VAZIO
    document.getElementById('modalAgendaGeral').classList.remove('hidden');
};
window.abrirModalReserva = () => {
    document.getElementById('formReserva').reset();
    document.getElementById('res_id').value = ''; // GARANTE QUE ESTÁ VAZIO
    document.getElementById('modalReserva').classList.remove('hidden');
};
// Salvar Agenda Geral (Pode ter vários no mesmo dia)
async function salvarAgendaGeral(e) {
    e.preventDefault();
    const id = document.getElementById('ag_id').value;
    const dados = {
        DATA: dataBr(document.getElementById('ag_data').value),
        EVENTO: document.getElementById('ag_evento').value,
        LOCAL: document.getElementById('ag_local').value,
        RESPONSAVEL: document.getElementById('ag_resp').value,
        OBSERVACAO: "" // Se você quiser adicionar um campo de obs no HTML da agenda geral futuramente
    };
    await enviarDados(`${API_BASE}/agenda-geral`, id, dados);
    fecharModal('modalAgendaGeral');
}
async function salvarReserva(e) {
    e.preventDefault();
    const id = document.getElementById('res_id').value; // PEGA O ID SE FOR EDIÇÃO
    const dados = {
        DATA: dataBr(document.getElementById('res_data').value),
        LOCAL: document.getElementById('res_local').value,
        HORARIO_INICIO: document.getElementById('res_ini').value,
        HORARIO_FIM: document.getElementById('res_fim').value,
        ATIVIDADE: document.getElementById('res_ativ').value,
        RESPONSAVEL: document.getElementById('res_resp').value
    };
    await enviarDados(`${API_BASE}/reservas`, id, dados);
    fecharModal('modalReserva');
}
// --- Edição Agenda Geral ---
window.prepararEdicaoGeral = function(id) {
    const ev = SISTEMA.dados.dashboard.agenda.find(x => getVal(x, 'ID') == id);
    if (!ev) return;
    document.getElementById('ag_id').value = getVal(ev, 'ID');
    document.getElementById('ag_data').value = dataIso(getVal(ev, 'DATA'));
    document.getElementById('ag_evento').value = getVal(ev, 'EVENTO');
    document.getElementById('ag_local').value = getVal(ev, 'LOCAL');
    document.getElementById('ag_resp').value = getVal(ev, 'RESPONSAVEL');
    document.getElementById('modalAgendaGeral').classList.remove('hidden');
};
// --- Edição Reservas ---
window.prepararEdicaoReserva = function(id) {
    const res = SISTEMA.dados.dashboard.reservas.find(x => getVal(x, 'ID') == id);
    if (!res) return;
    document.getElementById('res_id').value = getVal(res, 'ID');
    document.getElementById('res_data').value = dataIso(getVal(res, 'DATA'));
    document.getElementById('res_local').value = getVal(res, 'LOCAL');
    document.getElementById('res_ini').value = getVal(res, 'HORARIO_INICIO') || getVal(res, 'inicio');
    document.getElementById('res_fim').value = getVal(res, 'HORARIO_FIM') || getVal(res, 'fim');
    document.getElementById('res_ativ').value = getVal(res, 'ATIVIDADE') || getVal(res, 'evento');
    document.getElementById('res_resp').value = getVal(res, 'RESPONSAVEL');
    document.getElementById('modalReserva').classList.remove('hidden');
};
