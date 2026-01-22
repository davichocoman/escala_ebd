/**
 * painel-secretaria.js
 * Lógica de gestão para a Secretaria da AD Rodovia A
 */

const API_BASE = 'https://api-escala.onrender.com/api';
let usuario = null;
let token = null;

// Caches locais para evitar requisições desnecessárias na edição
let cacheMembros = [];
let cacheAgendaPastor = [];
let cacheAgendaGeral = []; // Eventos e Reservas

// ========================================================
// 1. INICIALIZAÇÃO E SEGURANÇA
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('usuario_sistema');
    token = sessionStorage.getItem('token_sistema');

    // Verifica Login
    if (!userStr || !token) {
        sair();
        return;
    }

    usuario = JSON.parse(userStr);

    // Verifica Permissão (Apenas Secretaria ou Admin)
    if (usuario.PERFIL !== 'SECRETARIA' && usuario.PERFIL !== 'ADMIN') {
        alert('Acesso negado. Área restrita à Secretaria.');
        window.location.href = '/login';
        return;
    }

    // Preenche cabeçalho
    document.getElementById('userDisplay').innerHTML = `
        Olá, <strong>${usuario.NOME.split(' ')[0]}</strong><br>
        <span style="color:#3b82f6;">${usuario.CARGO || 'Secretaria'}</span>
    `;

    // Carrega dados iniciais do Dashboard
    await carregarDashboard();
});

function sair() {
    sessionStorage.clear();
    window.location.href = '/login';
}

// ========================================================
// 2. DASHBOARD (VISÃO SEMANAL)
// ========================================================
async function carregarDashboard() {
    try {
        // Busca dados em paralelo para ser rápido
        const [resPastor, resGeral] = await Promise.all([
            fetch(`${API_BASE}/agenda-pastor`),
            fetch(`${API_BASE}/patrimonio/dados`)
        ]);

        const agendaPastor = await resPastor.json();
        const dadosGerais = await resGeral.json(); // { agenda: [], reservas: [] }

        // Filtra para a semana atual
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        // Calcula data limite (daqui a 7 dias)
        const limite = new Date(hoje);
        limite.setDate(hoje.getDate() + 7);

        // Função auxiliar de filtro
        const ehDaSemana = (dataStr) => {
            const d = parseDate(dataStr);
            return d >= hoje && d <= limite;
        };

        // Renderiza Listas
        renderizarListaDash('list-dash-igreja', dadosGerais.agenda, 'evento', 'data', ehDaSemana);
        renderizarListaDash('list-dash-pastor', agendaPastor, 'EVENTO', 'DATA', ehDaSemana);
        renderizarListaDash('list-dash-reservas', dadosGerais.reservas, 'evento', 'data', ehDaSemana);

    } catch (e) {
        console.error("Erro ao carregar dashboard:", e);
    }
}

function renderizarListaDash(elementId, lista, campoTitulo, campoData, filtroFn) {
    const ul = document.getElementById(elementId);
    if (!lista) return;

    // Filtra e Ordena
    const filtrados = lista.filter(item => filtroFn(item[campoData] || item.DATA));
    filtrados.sort((a, b) => parseDate(a[campoData] || a.DATA) - parseDate(b[campoData] || b.DATA));

    if (filtrados.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada agendado para os próximos 7 dias.</li>';
        return;
    }

    ul.innerHTML = filtrados.map(item => `
        <li>
            <strong>${item[campoTitulo] || item.EVENTO}</strong>
            <span>${item[campoData] || item.DATA}</span>
        </li>
    `).join('');
}

// ========================================================
// 3. GESTÃO DE MEMBROS
// ========================================================

// Chamado ao clicar no menu "Gerenciar Membros"
async function carregarMembros() {
    const tbody = document.getElementById('tabela-membros');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/membros`);
        cacheMembros = await res.json();
        renderizarTabelaMembros(cacheMembros);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erro ao buscar membros.</td></tr>';
    }
}

function renderizarTabelaMembros(lista) {
    const tbody = document.getElementById('tabela-membros');
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum membro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(m => `
        <tr>
            <td>${m.NOME}</td>
            <td>${m.CPF}</td>
            <td>${m.CARGO || '-'}</td>
            <td><span class="badge-perfil">${m.PERFIL || 'MEMBRO'}</span></td>
            <td>
                <button class="btn-icon edit" onclick="editarMembro('${m.ID}')" title="Editar">✏️</button>
                <button class="btn-icon delete" onclick="deletarMembro('${m.ID}')" title="Excluir">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function filtrarTabelaMembros() {
    const termo = document.getElementById('buscaMembro').value.toLowerCase();
    const filtrados = cacheMembros.filter(m => 
        m.NOME.toLowerCase().includes(termo) || 
        m.CPF.includes(termo)
    );
    renderizarTabelaMembros(filtrados);
}

// Abrir Modal (Novo ou Edição)
function abrirModalMembro(idEditar = null) {
    const form = document.getElementById('formMembro');
    const titulo = document.getElementById('tituloModalMembro');
    
    form.reset(); // Limpa o formulário
    document.getElementById('m_id').value = '';

    if (idEditar) {
        titulo.innerText = 'Editar Membro';
        const m = cacheMembros.find(x => x.ID === idEditar);
        if (m) {
            document.getElementById('m_id').value = m.ID;
            document.getElementById('m_nome').value = m.NOME;
            document.getElementById('m_cpf').value = m.CPF;
            document.getElementById('m_nasc').value = dataParaInput(m.NASCIMENTO);
            
            // Campos Opcionais
            if(m.ESTADO_CIVIL) document.getElementById('m_estado').value = m.ESTADO_CIVIL;
            document.getElementById('m_conjuge').value = m.CONJUGE || '';
            document.getElementById('m_data_casamento').value = dataParaInput(m.DATA_CASAMENTO);
            document.getElementById('m_filhos').value = m.FILHOS || '';
            document.getElementById('m_pai').value = m.PAI || '';
            document.getElementById('m_mae').value = m.MAE || '';
            document.getElementById('m_profissao').value = m.PROFISSAO || '';
            if(m.SITUACAO_TRABALHO) document.getElementById('m_situacao').value = m.SITUACAO_TRABALHO;
            document.getElementById('m_cargo').value = m.CARGO || 'Membro';
            document.getElementById('m_departamento').value = m.DEPARTAMENTO || '';
            if(m.PERFIL) document.getElementById('m_perfil').value = m.PERFIL;
            document.getElementById('m_senha').value = m.SENHA || '';
        }
    } else {
        titulo.innerText = 'Novo Membro';
    }

    document.getElementById('modalMembro').classList.remove('hidden');
}

window.editarMembro = abrirModalMembro; // Expor para o HTML

// Salvar Membro (POST ou PUT)
window.salvarMembro = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...';
    btn.disabled = true;

    const id = document.getElementById('m_id').value;
    
    const payload = {
        NOME: document.getElementById('m_nome').value.toUpperCase(),
        CPF: document.getElementById('m_cpf').value,
        NASCIMENTO: dataDoInput(document.getElementById('m_nasc').value),
        ESTADO_CIVIL: document.getElementById('m_estado').value,
        CONJUGE: document.getElementById('m_conjuge').value.toUpperCase(),
        DATA_CASAMENTO: dataDoInput(document.getElementById('m_data_casamento').value),
        FILHOS: document.getElementById('m_filhos').value,
        PAI: document.getElementById('m_pai').value.toUpperCase(),
        MAE: document.getElementById('m_mae').value.toUpperCase(),
        PROFISSAO: document.getElementById('m_profissao').value.toUpperCase(),
        SITUACAO_TRABALHO: document.getElementById('m_situacao').value,
        CARGO: document.getElementById('m_cargo').value,
        DEPARTAMENTO: document.getElementById('m_departamento').value.toUpperCase(),
        PERFIL: document.getElementById('m_perfil').value,
        SENHA: document.getElementById('m_senha').value
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/membros/${id}` : `${API_BASE}/membros`;

        const res = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': 'admin_secret' // Ou use token se o backend suportar
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Falha ao salvar');

        alert('Salvo com sucesso!');
        fecharModal('modalMembro');
        carregarMembros(); // Atualiza a tabela

    } catch (err) {
        alert('Erro ao salvar: ' + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.deletarMembro = async function(id) {
    if(!confirm('Tem certeza que deseja excluir este membro? Essa ação não pode ser desfeita.')) return;

    try {
        await fetch(`${API_BASE}/membros/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': 'admin_secret' }
        });
        carregarMembros();
    } catch (e) {
        alert('Erro ao excluir.');
    }
};

// ========================================================
// 4. GESTÃO DA AGENDA DO PASTOR
// ========================================================

async function carregarAgendaPastor() {
    const tbody = document.getElementById('tabela-agenda-pastor');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/agenda-pastor`);
        cacheAgendaPastor = await res.json();
        
        // Ordena por data (mais recente primeiro ou futuro primeiro)
        cacheAgendaPastor.sort((a,b) => parseDate(a.DATA) - parseDate(b.DATA));

        if (cacheAgendaPastor.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum compromisso agendado.</td></tr>';
            return;
        }

        tbody.innerHTML = cacheAgendaPastor.map(a => `
            <tr>
                <td>${a.DATA}</td>
                <td>${a.HORARIO || '-'}</td>
                <td><strong>${a.EVENTO}</strong><br><span style="font-size:0.85rem; color:#666;">${a.OBSERVACAO || ''}</span></td>
                <td>${a.LOCAL || '-'}</td>
                <td>
                    <button class="btn-icon edit" onclick="editarEventoPastor('${a.ID}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarEventoPastor('${a.ID}')">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erro ao buscar agenda.</td></tr>';
    }
}

// Modal Agenda
window.abrirModalEventoPastor = function(idEditar = null) {
    const form = document.getElementById('formPastor');
    const titulo = document.getElementById('tituloModalPastor');
    
    form.reset();
    document.getElementById('p_id').value = '';

    if (idEditar) {
        titulo.innerText = 'Editar Compromisso';
        const a = cacheAgendaPastor.find(x => x.ID === idEditar);
        if (a) {
            document.getElementById('p_id').value = a.ID;
            document.getElementById('p_data').value = dataParaInput(a.DATA);
            document.getElementById('p_hora').value = a.HORARIO || '';
            document.getElementById('p_evento').value = a.EVENTO;
            document.getElementById('p_local').value = a.LOCAL || '';
            document.getElementById('p_obs').value = a.OBSERVACAO || '';
        }
    } else {
        titulo.innerText = 'Novo Compromisso';
    }
    
    document.getElementById('modalPastor').classList.remove('hidden');
};

window.editarEventoPastor = window.abrirModalEventoPastor;

window.salvarAgendaPastor = async function(e) {
    e.preventDefault();
    const id = document.getElementById('p_id').value;
    
    const payload = {
        DATA: dataDoInput(document.getElementById('p_data').value),
        HORARIO: document.getElementById('p_hora').value,
        EVENTO: document.getElementById('p_evento').value.toUpperCase(),
        LOCAL: document.getElementById('p_local').value.toUpperCase(),
        OBSERVACAO: document.getElementById('p_obs').value
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/agenda-pastor/${id}` : `${API_BASE}/agenda-pastor`;

        await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': 'admin_secret' 
            },
            body: JSON.stringify(payload)
        });

        alert('Compromisso salvo!');
        fecharModal('modalPastor');
        carregarAgendaPastor(); // Recarrega tabela
        carregarDashboard(); // Atualiza dashboard também

    } catch (err) {
        alert('Erro ao salvar agenda.');
    }
};

window.deletarEventoPastor = async function(id) {
    if(!confirm('Excluir este compromisso?')) return;
    try {
        await fetch(`${API_BASE}/agenda-pastor/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': 'admin_secret' }
        });
        carregarAgendaPastor();
        carregarDashboard();
    } catch (e) { alert('Erro ao excluir.'); }
};

// ========================================================
// 5. MEUS DADOS
// ========================================================
function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    let html = '';
    // Mostra apenas campos relevantes para leitura
    const camposIgnorar = ['ID', 'SENHA'];
    
    for (const [key, value] of Object.entries(usuario)) {
        if (camposIgnorar.includes(key)) continue;
        html += `
            <div class="form-group">
                <label>${key.replace('_', ' ')}</label>
                <input class="form-input" value="${value || '-'}" disabled style="background:#f1f5f9;">
            </div>
        `;
    }
    div.innerHTML = html;
}

// ========================================================
// 6. UTILITÁRIOS (Datas, Modais, Telas)
// ========================================================

// Alterna entre as telas principais
window.mostrarTela = function(telaId, btn) {
    // Esconde tudo
    ['dashboard', 'membros', 'pastor', 'perfil'].forEach(id => {
        document.getElementById('sec-' + id).classList.add('hidden');
    });
    // Remove active
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    // Mostra atual
    document.getElementById('sec-' + telaId).classList.remove('hidden');
    if (btn) btn.classList.add('active');

    // Carrega dados específicos se necessário
    if (telaId === 'membros') carregarMembros();
    if (telaId === 'pastor') carregarAgendaPastor();
    if (telaId === 'perfil') renderizarMeusDados();
};

window.fecharModal = function(id) {
    document.getElementById(id).classList.add('hidden');
};

// Converte "2026-01-25" (Input Date) -> "25/01/2026" (Google Sheets/Visual)
function dataDoInput(dataIso) {
    if (!dataIso) return '';
    const partes = dataIso.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Converte "25/01/2026" (Google Sheets) -> "2026-01-25" (Input Date)
function dataParaInput(dataBr) {
    if (!dataBr || dataBr.length !== 10) return '';
    const partes = dataBr.split('/');
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

// Parser de data para ordenação e comparação
function parseDate(dataStr) {
    if (!dataStr) return new Date(0);
    const partes = dataStr.split('/');
    return new Date(partes[2], partes[1] - 1, partes[0]);
}
