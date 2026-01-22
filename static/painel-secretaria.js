const API_BASE = 'https://api-escala.onrender.com/api';
let usuario = null;
let token = null;

let cacheMembros = [];
let cacheAgendaPastor = [];

document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('usuario_sistema');
    token = sessionStorage.getItem('token_sistema');

    if (!userStr) { sair(); return; }
    usuario = JSON.parse(userStr);

    // Header com tratamento de erro se NOME for undefined
    const nomeUser = (usuario.NOME || usuario.nome || 'Secretaria').split(' ')[0];
    const cargoUser = usuario.CARGO || usuario.cargo || 'Admin';
    
    const userDisplay = document.getElementById('userDisplay');
    if(userDisplay) {
        userDisplay.innerHTML = `Olá, <strong>${nomeUser}</strong><br><span style="color:#3b82f6;">${cargoUser}</span>`;
    }

    await carregarDashboard();
});

function sair() {
    sessionStorage.clear();
    window.location.href = '/login';
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// ========================================================
// FUNÇÃO MÁGICA: Resolve Maiúsculas/Minúsculas
// ========================================================
function getVal(obj, key) {
    if (!obj) return '';
    // Tenta Maiúsculo, Minúsculo e Título
    return obj[key.toUpperCase()] || obj[key.toLowerCase()] || obj[key] || '';
}

// ========================================================
// 1. DASHBOARD
// ========================================================
async function carregarDashboard() {
    try {
        const [resPastor, resGeral] = await Promise.all([
            fetch(`${API_BASE}/agenda-pastor`),
            fetch(`${API_BASE}/patrimonio/dados`)
        ]);

        const agendaPastor = await resPastor.json();
        const dadosGerais = await resGeral.json(); 

        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje); limite.setDate(hoje.getDate() + 7);

        const filtroSemana = (dataStr) => {
            const d = parseDate(dataStr);
            return d >= hoje && d <= limite;
        };

        renderizarListaDash('list-dash-igreja', dadosGerais.agenda || [], 'evento', 'data', filtroSemana);
        renderizarListaDash('list-dash-reservas', dadosGerais.reservas || [], 'evento', 'data', filtroSemana);
        renderizarListaDash('list-dash-pastor', agendaPastor || [], 'EVENTO', 'DATA', filtroSemana);

    } catch (e) { console.error(e); }
}

function renderizarListaDash(elementId, lista, keyTitulo, keyData, filtroFn) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    
    // Filtra usando a função auxiliar getVal
    const filtrados = lista.filter(item => filtroFn(getVal(item, keyData)));
    filtrados.sort((a, b) => parseDate(getVal(a, keyData)) - parseDate(getVal(b, keyData)));

    if (filtrados.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada esta semana.</li>';
        return;
    }

    ul.innerHTML = filtrados.map(item => `
        <li>
            <strong>${getVal(item, keyTitulo)}</strong>
            <span>${getVal(item, keyData)}</span>
        </li>
    `).join('');
}

// ========================================================
// 2. MEMBROS (Correção de Dados)
// ========================================================
async function carregarMembros() {
    const tbody = document.getElementById('tabela-membros');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/membros`);
        if(!res.ok) throw new Error("Erro API");
        
        cacheMembros = await res.json();
        renderizarTabelaMembros(cacheMembros);
    } catch (e) {
        console.error("Erro detalhado:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erro ao buscar dados. Verifique se a rota /api/membros existe no main.py</td></tr>';
    }
}

function renderizarTabelaMembros(lista) {
    const tbody = document.getElementById('tabela-membros');
    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum registro.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(m => `
        <tr>
            <td>${getVal(m, 'NOME')}</td>
            <td>${getVal(m, 'CPF')}</td>
            <td>${getVal(m, 'CARGO')}</td>
            <td><span class="badge-perfil">${getVal(m, 'PERFIL') || 'MEMBRO'}</span></td>
            <td>
                <button class="btn-icon edit" onclick="editarMembro('${getVal(m, 'ID')}')">✏️</button>
                <button class="btn-icon delete" onclick="deletarMembro('${getVal(m, 'ID')}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ========================================================
// 3. AGENDA PASTOR (Correção de Dados)
// ========================================================
async function carregarAgendaPastor() {
    const tbody = document.getElementById('tabela-agenda-pastor');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/agenda-pastor`);
        cacheAgendaPastor = await res.json();
        
        if (!cacheAgendaPastor || cacheAgendaPastor.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Agenda vazia.</td></tr>';
            return;
        }
        
        // Ordena
        cacheAgendaPastor.sort((a,b) => parseDate(getVal(a, 'DATA')) - parseDate(getVal(b, 'DATA')));

        tbody.innerHTML = cacheAgendaPastor.map(a => `
            <tr>
                <td>${getVal(a, 'DATA')}</td>
                <td>${getVal(a, 'HORARIO')}</td>
                <td><strong>${getVal(a, 'EVENTO')}</strong><br><small>${getVal(a, 'OBSERVACAO')}</small></td>
                <td>${getVal(a, 'LOCAL')}</td>
                <td>
                    <button class="btn-icon edit" onclick="editarEventoPastor('${getVal(a, 'ID')}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarEventoPastor('${getVal(a, 'ID')}')">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Erro ao carregar agenda.</td></tr>';
    }
}

// ========================================================
// 4. MEUS DADOS
// ========================================================
function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    let html = '';
    const ignorar = ['ID', 'SENHA', 'id', 'senha'];
    
    // Itera chaves do objeto usuário
    for (const key in usuario) {
        if (ignorar.includes(key)) continue;
        html += `
            <div class="form-group">
                <label>${key.replace(/_/g, ' ').toUpperCase()}</label>
                <input class="form-input" value="${usuario[key] || ''}" disabled style="background:#f1f5f9;">
            </div>
        `;
    }
    div.innerHTML = html;
}

// ========================================================
// 5. UTILITÁRIOS E MODAIS (Mantidos iguais, só ajustando getVal)
// ========================================================
window.mostrarTela = function(telaId, btn) {
    ['dashboard', 'membros', 'pastor', 'perfil'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if(el) el.classList.add('hidden');
    });
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    const alvo = document.getElementById('sec-' + telaId);
    if(alvo) alvo.classList.remove('hidden');
    if (btn) btn.classList.add('active');
    
    // Fecha menu no mobile ao clicar
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) sidebar.classList.remove('open');

    if (telaId === 'membros') carregarMembros();
    if (telaId === 'pastor') carregarAgendaPastor();
    if (telaId === 'perfil') renderizarMeusDados();
};

window.abrirModalMembro = function(idEditar = null) {
    document.getElementById('formMembro').reset();
    document.getElementById('m_id').value = '';
    document.getElementById('tituloModalMembro').innerText = 'Novo Membro';

    if (idEditar) {
        // Usa getVal para garantir que achamos o ID independente da caixa
        const m = cacheMembros.find(x => getVal(x, 'ID') == idEditar);
        if (m) {
            document.getElementById('tituloModalMembro').innerText = 'Editar Membro';
            document.getElementById('m_id').value = getVal(m, 'ID');
            document.getElementById('m_nome').value = getVal(m, 'NOME');
            document.getElementById('m_cpf').value = getVal(m, 'CPF');
            document.getElementById('m_nasc').value = dataParaInput(getVal(m, 'NASCIMENTO'));
            // ... preencher os outros campos aqui usando getVal(m, 'CAMPO') ...
        }
    }
    document.getElementById('modalMembro').classList.remove('hidden');
};
window.fecharModal = function(id) { document.getElementById(id).classList.add('hidden'); };
window.editarMembro = window.abrirModalMembro;

// Funções de Data
function parseDate(str) {
    if(!str) return new Date(0);
    const p = str.split('/');
    return new Date(p[2], p[1]-1, p[0]);
}
function dataParaInput(str) {
    if(!str || str.length !== 10) return '';
    const p = str.split('/');
    return `${p[2]}-${p[1]}-${p[0]}`;
}
function dataDoInput(str) {
    if(!str) return '';
    const p = str.split('-');
    return `${p[2]}/${p[1]}/${p[0]}`;
}

window.fecharModal = function(id) { document.getElementById(id).classList.add('hidden'); };

// Funções da Agenda do Pastor (Modais)
window.abrirModalEventoPastor = function(idEditar = null) {
    const form = document.getElementById('formPastor');
    form.reset();
    document.getElementById('p_id').value = '';
    
    if(idEditar) {
        const a = cacheAgendaPastor.find(x => x.ID === idEditar);
        if(a) {
            document.getElementById('p_id').value = a.ID;
            document.getElementById('p_data').value = dataParaInput(a.DATA);
            document.getElementById('p_evento').value = a.EVENTO;
            document.getElementById('p_hora').value = a.HORARIO || '';
            document.getElementById('p_local').value = a.LOCAL || '';
        }
    }
    document.getElementById('modalPastor').classList.remove('hidden');
};
window.editarEventoPastor = window.abrirModalEventoPastor;

window.salvarAgendaPastor = async function(e) {
    e.preventDefault();
    const id = document.getElementById('p_id').value;
    const payload = {
        DATA: dataDoInput(document.getElementById('p_data').value),
        EVENTO: document.getElementById('p_evento').value.toUpperCase(),
        HORARIO: document.getElementById('p_hora').value,
        LOCAL: document.getElementById('p_local').value,
        OBSERVACAO: document.getElementById('p_obs').value
    };
    
    const url = id ? `${API_BASE}/agenda-pastor/${id}` : `${API_BASE}/agenda-pastor`;
    const method = id ? 'PUT' : 'POST';
    
    await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json', 'x-admin-token': 'admin_secret'},
        body: JSON.stringify(payload)
    });
    
    document.getElementById('modalPastor').classList.add('hidden');
    carregarAgendaPastor();
    carregarDashboard();
};

window.deletarEventoPastor = async function(id) {
    if(!confirm("Excluir?")) return;
    await fetch(`${API_BASE}/agenda-pastor/${id}`, { method: 'DELETE', headers: {'x-admin-token': 'admin_secret'} });
    carregarAgendaPastor();
};
