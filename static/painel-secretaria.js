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

// ============================================================
// 2. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica Login
    const userStr = sessionStorage.getItem('usuario_sistema');
    SISTEMA.token = sessionStorage.getItem('token_sistema');
    if (!userStr || !SISTEMA.token) {
        window.location.href = '/login';
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
    const membrosEl = document.getElementById('tabela-membros');
    const pastorEl = document.getElementById('tabela-agenda-pastor');

    if (igrejaEl) igrejaEl.innerHTML = '<li>Carregando...</li>';
    if (membrosEl) membrosEl.innerHTML = '<tr><td colspan="4">Atualizando...</td></tr>';
    if (pastorEl) pastorEl.innerHTML = '<tr><td colspan="5">Atualizando...</td></tr>';

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
        alert("Erro ao conectar com o servidor. Verifique sua internet ou credenciais.");
    }
}

// ============================================================
// 4. RENDERIZAÇÃO
// ============================================================
function renderizarDashboard() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(); limite.setDate(hoje.getDate() + 7);

    const filtroSemana = (item, chaveData) => {
        const d = dataParaObj(getVal(item, chaveData));
        return d >= hoje && d <= limite;
    };

    const listaIgreja = SISTEMA.dados.dashboard.agenda || [];
    preencherListaDash('list-dash-igreja', listaIgreja, 'EVENTO', 'DATA', filtroSemana);

    const listaPastor = SISTEMA.dados.agendaPastor || [];
    preencherListaDash('list-dash-pastor', listaPastor, 'EVENTO', 'DATA', filtroSemana);

    const listaReservas = SISTEMA.dados.dashboard.reservas || [];
    preencherListaDash('list-dash-reservas', listaReservas, 'EVENTO', 'DATA', filtroSemana);
}

function preencherListaDash(idElemento, lista, chaveTitulo, chaveData, filtro) {
    const ul = document.getElementById(idElemento);
    if (!ul) return;

    const itensFiltrados = lista.filter(item => filtro(item, chaveData));
    itensFiltrados.sort((a,b) => dataParaObj(getVal(a, chaveData)) - dataParaObj(getVal(b, chaveData)));

    if (itensFiltrados.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada para esta semana.</li>';
        return;
    }

    ul.innerHTML = itensFiltrados.map(item => `
        <li>
            <strong>${getVal(item, chaveTitulo)}</strong>
            <span>${getVal(item, chaveData)}</span>
        </li>
    `).join('');
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
                <strong>PERFIL:</strong><span class="badge-perfil">${getVal(m, 'PERFIL') || 'MEMBRO'}</span>
            </div>
            <div class="card-body">
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
    lista.sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));

    if (lista.length === 0) {
        container.innerHTML = '<div class="empty-msg">Agenda vazia.</div>';
        return;
    }

    container.innerHTML = lista.map(a => `
        <div class="agenda-card">
            <div class="card-header">
                <strong>${getVal(a, 'EVENTO')}</strong>
                <span>${getVal(a, 'DATA')}</span>
            </div>
            <div class="card-body">
                <div><strong>Hora:</strong> ${getVal(a, 'HORARIO')}</div>
                <div><strong>Local:</strong> ${getVal(a, 'LOCAL')}</div>
                ${getVal(a, 'OBSERVACAO') ? `<div><strong>Obs:</strong> ${getVal(a, 'OBSERVACAO')}</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn-icon edit" onclick="prepararEdicaoPastor('${getVal(a, 'ID')}')">✏️</button>
                <button class="btn-icon delete" onclick="deletarItem('${getVal(a, 'ID')}', 'agenda-pastor')">🗑️</button>
            </div>
        </div>
    `).join('');
}

function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    if (!div || !SISTEMA.usuario) return;

    let html = '';
    const ignorar = ['ID', 'SENHA', 'TOKEN'];

    for (const [key, val] of Object.entries(SISTEMA.usuario)) {
        if (ignorar.includes(key.toUpperCase())) continue;
        html += `
            <div class="form-group">
                <label>${key.replace(/_/g, ' ')}</label>
                <input class="form-input" value="${val || ''}" disabled style="background:#f1f5f9;">
            </div>
        `;
    }
    div.innerHTML = html || '<p>Nenhum dado disponível.</p>';
}

// ============================================================
// 5. INTERAÇÕES E BOTÕES
// ============================================================
function configurarBotoes() {
    const buscaEl = document.getElementById('buscaMembro');
    if (buscaEl) buscaEl.addEventListener('keyup', renderizarMembros);

    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (f.id === 'formMembro') await salvarMembro();
            if (f.id === 'formPastor') await salvarPastor();
        });
    });
}

window.mostrarTela = function(telaId, btn) {
    // Esconde todas as seções
    ['dashboard', 'membros', 'pastor', 'perfil'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if (el) el.classList.add('hidden');
    });

    // Remove active de todos os itens do menu
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    // Mostra a aba escolhida
    const alvo = document.getElementById('sec-' + telaId);
    if (alvo) alvo.classList.remove('hidden');

    // Ativa o botão clicado
    if (btn) btn.classList.add('active');

    // Fecha sidebar no mobile
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('open');
    }

    // Força re-renderização das listas ao abrir a aba
    if (telaId === 'membros') {
        console.log("Forçando render de membros");
        renderizarMembros();
    }
    if (telaId === 'pastor') {
        console.log("Forçando render de agenda pastor");
        renderizarAgendaPastor();
    }
    if (telaId === 'perfil') {
        renderizarMeusDados();
    }
};

window.logout = function() {
    sessionStorage.clear();
    window.location.href = '/login';
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
    if (!m) return;

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
        NOME: document.getElementById('m_nome')?.value || '',
        NASCIMENTO: dataBr(document.getElementById('m_nasc')?.value),
        CPF: document.getElementById('m_cpf')?.value || '',
        ESTADO_CIVIL: document.getElementById('m_estado')?.value || '',
        DATA_CASAMENTO: dataBr(document.getElementById('m_data_casamento')?.value),
        CONJUGE: document.getElementById('m_conjuge')?.value || '',
        FILHOS: document.getElementById('m_filhos')?.value || '',
        PAI: document.getElementById('m_pai')?.value || '',
        MAE: document.getElementById('m_mae')?.value || '',
        PROFISSAO: document.getElementById('m_profissao')?.value || '',
        SITUACAO_TRABALHO: document.getElementById('m_situacao')?.value || '',
        CARGO: document.getElementById('m_cargo')?.value || '',
        DEPARTAMENTO: document.getElementById('m_departamento')?.value || '',
        PERFIL: document.getElementById('m_perfil')?.value || ''
    };

    await enviarDados(`${API_BASE}/membros`, id, dados);
    document.getElementById('modalMembro')?.classList.add('hidden');
}

// Funções semelhantes para Pastor (já estavam boas, mantive)
window.abrirModalEventoPastor = function() {
    document.getElementById('formPastor')?.reset();
    document.getElementById('p_id').value = '';
    document.getElementById('modalPastor')?.classList.remove('hidden');
};

window.prepararEdicaoPastor = function(id) {
    const a = SISTEMA.dados.agendaPastor.find(x => getVal(x, 'ID') == id);
    if (!a) return;

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
        EVENTO: document.getElementById('p_evento')?.value || '',
        DATA: dataBr(document.getElementById('p_data')?.value),
        HORARIO: document.getElementById('p_hora')?.value || '',
        LOCAL: document.getElementById('p_local')?.value || '',
        OBSERVACAO: document.getElementById('p_obs')?.value || ''
    };

    await enviarDados(`${API_BASE}/agenda-pastor`, id, dados);
    document.getElementById('modalPastor')?.classList.add('hidden');
}

window.deletarItem = async function(id, endpoint) {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    try {
        await fetch(`${API_BASE}/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': SISTEMA.token }
        });
        await carregarTudoDoBanco();
    } catch (e) {
        alert('Erro ao excluir.');
    }
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

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': SISTEMA.token
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha na API');
        await carregarTudoDoBanco();
        alert('Salvo com sucesso!');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar.');
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

// ============================================================
// 8. SIDEBAR (já estava bom, mantive)
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
