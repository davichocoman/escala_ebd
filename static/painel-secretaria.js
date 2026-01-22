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

    if (usuario.PERFIL !== 'SECRETARIA' && usuario.PERFIL !== 'ADMIN') {
        alert('Acesso negado.');
        window.location.href = '/login';
        return;
    }

    document.getElementById('userDisplay').innerHTML = `Olá, <strong>${usuario.NOME.split(' ')[0]}</strong>`;

    // Carrega o Dashboard inicialmente
    await carregarDashboard();
});

function sair() {
    sessionStorage.clear();
    window.location.href = '/login';
}

// ========================================================
// 1. DASHBOARD CORRIGIDO
// ========================================================
async function carregarDashboard() {
    try {
        const [resPastor, resGeral] = await Promise.all([
            fetch(`${API_BASE}/agenda-pastor`),
            fetch(`${API_BASE}/patrimonio/dados`)
        ]);

        const agendaPastor = await resPastor.json();
        const dadosGerais = await resGeral.json(); 

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje);
        limite.setDate(hoje.getDate() + 7); // Próximos 7 dias

        const filtroSemana = (dataStr) => {
            const d = parseDate(dataStr);
            return d >= hoje && d <= limite;
        };

        // CORREÇÃO: Mapeamento correto de Maiúsculas/Minúsculas
        renderizarListaDash('list-dash-igreja', dadosGerais.agenda, 'evento', 'data', filtroSemana);
        renderizarListaDash('list-dash-reservas', dadosGerais.reservas, 'evento', 'data', filtroSemana);
        renderizarListaDash('list-dash-pastor', agendaPastor, 'EVENTO', 'DATA', filtroSemana);

    } catch (e) {
        console.error("Erro dashboard:", e);
    }
}

function renderizarListaDash(elementId, lista, campoTitulo, campoData, filtroFn) {
    const ul = document.getElementById(elementId);
    if (!lista) return;

    const filtrados = lista.filter(item => filtroFn(item[campoData]));
    
    // Ordena
    filtrados.sort((a, b) => parseDate(a[campoData]) - parseDate(b[campoData]));

    if (filtrados.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada esta semana.</li>';
        return;
    }

    ul.innerHTML = filtrados.map(item => `
        <li>
            <strong>${item[campoTitulo]}</strong>
            <span>${item[campoData]}</span>
        </li>
    `).join('');
}

// ========================================================
// 2. GESTÃO DE MEMBROS (Botões e Tabela Corrigidos)
// ========================================================
async function carregarMembros() {
    const tbody = document.getElementById('tabela-membros');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/membros`);
        cacheMembros = await res.json();
        renderizarTabelaMembros(cacheMembros);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red">Erro ao buscar membros.</td></tr>';
    }
}

function renderizarTabelaMembros(lista) {
    const tbody = document.getElementById('tabela-membros');
    
    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum membro encontrado.</td></tr>';
        return;
    }

    // Garante que usamos as chaves em MAIÚSCULO que vêm do Python
    tbody.innerHTML = lista.map(m => `
        <tr>
            <td>${m.NOME || '-'}</td>
            <td>${m.CPF || '-'}</td>
            <td>${m.CARGO || '-'}</td>
            <td><span class="badge-perfil">${m.PERFIL || 'MEMBRO'}</span></td>
            <td>
                <button class="btn-icon edit" onclick="editarMembro('${m.ID}')">✏️</button>
                <button class="btn-icon delete" onclick="deletarMembro('${m.ID}')">🗑️</button>
            </td>
        </tr>
    `).join('');
}

// ========================================================
// 3. AGENDA PASTOR (Correção de Visualização)
// ========================================================
async function carregarAgendaPastor() {
    const tbody = document.getElementById('tabela-agenda-pastor');
    tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/agenda-pastor`);
        cacheAgendaPastor = await res.json();
        
        cacheAgendaPastor.sort((a,b) => parseDate(a.DATA) - parseDate(b.DATA));

        if (cacheAgendaPastor.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Nenhum compromisso.</td></tr>';
            return;
        }

        tbody.innerHTML = cacheAgendaPastor.map(a => `
            <tr>
                <td>${a.DATA}</td>
                <td>${a.HORARIO || '-'}</td>
                <td><strong>${a.EVENTO}</strong><br><small>${a.OBSERVACAO || ''}</small></td>
                <td>${a.LOCAL || '-'}</td>
                <td>
                    <button class="btn-icon edit" onclick="editarEventoPastor('${a.ID}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarEventoPastor('${a.ID}')">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5">Erro ao buscar agenda.</td></tr>';
    }
}

// ========================================================
// 4. MEUS DADOS (Preenchimento)
// ========================================================
function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    let html = '';
    const ignorar = ['ID', 'SENHA'];
    
    // Itera sobre o objeto usuario salvo na sessão
    for (const [key, value] of Object.entries(usuario)) {
        if (ignorar.includes(key)) continue;
        html += `
            <div class="form-group">
                <label>${key.replace(/_/g, ' ')}</label>
                <input class="form-input" value="${value || ''}" disabled style="background:#f1f5f9;">
            </div>
        `;
    }
    div.innerHTML = html;
}

// ========================================================
// 5. FUNÇÕES UTILITÁRIAS E MODAIS
// ========================================================

window.mostrarTela = function(telaId, btn) {
    ['dashboard', 'membros', 'pastor', 'perfil'].forEach(id => {
        document.getElementById('sec-' + id).classList.add('hidden');
    });
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    document.getElementById('sec-' + telaId).classList.remove('hidden');
    if (btn) btn.classList.add('active');

    if (telaId === 'membros') carregarMembros();
    if (telaId === 'pastor') carregarAgendaPastor();
    if (telaId === 'perfil') renderizarMeusDados();
};

window.abrirModalMembro = function(idEditar = null) {
    const form = document.getElementById('formMembro');
    const titulo = document.getElementById('tituloModalMembro');
    form.reset();
    document.getElementById('m_id').value = '';

    if (idEditar) {
        titulo.innerText = 'Editar Membro';
        const m = cacheMembros.find(x => x.ID === idEditar);
        if (m) {
            document.getElementById('m_id').value = m.ID;
            document.getElementById('m_nome').value = m.NOME;
            document.getElementById('m_cpf').value = m.CPF;
            document.getElementById('m_nasc').value = dataParaInput(m.NASCIMENTO);
            document.getElementById('m_cargo').value = m.CARGO || '';
            document.getElementById('m_perfil').value = m.PERFIL || 'MEMBRO';
            // Preencha os outros campos conforme necessário...
        }
    } else {
        titulo.innerText = 'Novo Membro';
    }
    document.getElementById('modalMembro').classList.remove('hidden');
};

window.editarMembro = window.abrirModalMembro;

window.salvarMembro = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = 'Salvando...';
    
    // Dados básicos para teste (adicione todos os campos aqui)
    const payload = {
        NOME: document.getElementById('m_nome').value.toUpperCase(),
        CPF: document.getElementById('m_cpf').value,
        NASCIMENTO: dataDoInput(document.getElementById('m_nasc').value),
        CARGO: document.getElementById('m_cargo').value,
        PERFIL: document.getElementById('m_perfil').value,
        SENHA: document.getElementById('m_senha').value
    };
    
    const id = document.getElementById('m_id').value;
    const url = id ? `${API_BASE}/membros/${id}` : `${API_BASE}/membros`;
    const method = id ? 'PUT' : 'POST';

    try {
        await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json', 'x-admin-token': 'admin_secret'},
            body: JSON.stringify(payload)
        });
        document.getElementById('modalMembro').classList.add('hidden');
        carregarMembros();
        alert('Salvo com sucesso!');
    } catch(err) {
        alert('Erro ao salvar');
    } finally {
        btn.innerText = 'Salvar Dados';
    }
};

window.deletarMembro = async function(id) {
    if(!confirm("Excluir?")) return;
    await fetch(`${API_BASE}/membros/${id}`, { method: 'DELETE', headers: {'x-admin-token': 'admin_secret'} });
    carregarMembros();
};

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
