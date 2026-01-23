const API_BASE = 'https://api-escala.onrender.com/api';
let usuario = null;
let token = null;

// Cache e Controle de Estado
let cacheMembros = [];
let cacheAgendaPastor = [];
let isLoading = false; // Trava para evitar cliques múltiplos

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupera sessão
    const userStr = sessionStorage.getItem('usuario_sistema');
    token = sessionStorage.getItem('token_sistema'); // Token gerado no login

    if (!userStr) { 
        console.warn("Usuário não encontrado. Redirecionando...");
        logout(); 
        return; 
    }

    try {
        usuario = JSON.parse(userStr);
    } catch (e) {
        console.error("Erro no JSON do usuário:", e);
        logout();
        return;
    }

    // 2. Renderiza Header (Sidebar)
    const nomeUser = (getVal(usuario, 'NOME') || 'Secretaria').split(' ')[0];
    const cargoUser = getVal(usuario, 'CARGO') || 'Admin';
    
    const userDisplay = document.getElementById('userDisplay');
    if(userDisplay) {
        userDisplay.innerHTML = `Olá, <strong>${nomeUser}</strong><br><span style="color:#3b82f6;">${cargoUser}</span>`;
    }

    // 3. Carrega Dashboard Inicial
    await carregarDashboard();
});

// ========================================================
// 0. FUNÇÕES GERAIS E UTILITÁRIOS
// ========================================================

// Função global de Logout (vinculada ao HTML onclick="logout()")
window.logout = function() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/login'; // Ajuste para sua rota de login real
};

function getVal(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    if (!key) return '';
    // Busca case-insensitive
    const lowerKey = key.toLowerCase();
    for (const k in obj) {
        if (k.toLowerCase() === lowerKey) return obj[k];
    }
    return '';
}

function parseDate(str) {
    if (!str || typeof str !== 'string' || str.length < 6) return new Date(0);
    try {
        // Formato BR: dd/mm/yyyy
        if (str.includes('/')) {
            const p = str.split('/');
            if (p.length === 3) return new Date(p[2], p[1]-1, p[0]);
        }
        // Formato ISO: yyyy-mm-dd
        if (str.includes('-')) {
            const p = str.split('-');
            if (p.length === 3) return new Date(p[0], p[1]-1, p[2]);
        }
    } catch (e) { return new Date(0); }
    return new Date(0);
}

function dataParaInput(str) {
    if(!str) return '';
    if(str.includes('-') && str.length === 10) return str; // Já é ISO
    if(str.includes('/') && str.length === 10) {
        const p = str.split('/');
        return `${p[2]}-${p[1]}-${p[0]}`;
    }
    return '';
}

function dataDoInput(str) {
    if(!str) return '';
    const p = str.split('-');
    if(p.length !== 3) return '';
    return `${p[2]}/${p[1]}/${p[0]}`;
}

// Cabeçalhos padrão para requisições (Incluindo o Token Admin se necessário)
function getHeaders() {
    // OBS: Sua API Python pede 'x-admin-token'. 
    // Se o token de sessão não for o admin token, você deve ajustar isso.
    // Estou enviando o token da sessão ou um fallback.
    return {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-admin-token': token || 'admin_secret' 
    };
}

// ========================================================
// 1. DASHBOARD (Visão Semanal)
// ========================================================
async function carregarDashboard() {
    console.log("Atualizando Dashboard...");
    
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje); limite.setDate(hoje.getDate() + 7);

    const filtroSemana = (dataStr) => {
        const d = parseDate(dataStr);
        return d >= hoje && d <= limite;
    };

    // 1. Carrega Dados da Igreja (Patrimônio)
    try {
        const resGeral = await fetch(`${API_BASE}/patrimonio/dados`, { headers: { 'Cache-Control': 'no-cache' } });
        if(resGeral.ok) {
            const dados = await resGeral.json();
            renderizarListaDash('list-dash-igreja', dados.agenda || [], 'evento', 'data', filtroSemana);
            renderizarListaDash('list-dash-reservas', dados.reservas || [], 'evento', 'data', filtroSemana);
        }
    } catch (e) {
        console.error("Erro Dash Igreja:", e);
        document.getElementById('list-dash-igreja').innerHTML = '<li class="empty-msg" style="color:red">Erro ao carregar.</li>';
    }

    // 2. Carrega Dados do Pastor (Separado para não travar o resto)
    try {
        const resPastor = await fetch(`${API_BASE}/agenda-pastor`, { headers: { 'Cache-Control': 'no-cache' } });
        if(resPastor.ok) {
            const agenda = await resPastor.json();
            renderizarListaDash('list-dash-pastor', agenda || [], 'EVENTO', 'DATA', filtroSemana);
        }
    } catch (e) {
        console.error("Erro Dash Pastor:", e);
        document.getElementById('list-dash-pastor').innerHTML = '<li class="empty-msg">Indisponível.</li>';
    }
}

function renderizarListaDash(elementId, lista, keyTitulo, keyData, filtroFn) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    
    if (!Array.isArray(lista) || lista.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada agendado.</li>';
        return;
    }

    try {
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
    } catch (e) {
        console.error(`Erro render lista ${elementId}:`, e);
    }
}

// ========================================================
// 2. MEMBROS
// ========================================================
async function carregarMembros() {
    if(isLoading) return; // Evita loop de cliques
    
    const tbody = document.getElementById('tabela-membros');
    if (!tbody) return;

    if(cacheMembros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando dados...</td></tr>';
    } else {
        renderizarTabelaMembros(cacheMembros); // Mostra cache enquanto atualiza
    }

    isLoading = true;
    try {
        const res = await fetch(`${API_BASE}/membros`, { headers: { 'Cache-Control': 'no-cache' } });
        if(!res.ok) throw new Error(res.status);
        
        cacheMembros = await res.json();
        renderizarTabelaMembros(cacheMembros);
    } catch (e) {
        console.error("Erro Membros:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center">Erro de conexão.</td></tr>';
    } finally {
        isLoading = false;
    }
}

function renderizarTabelaMembros(lista) {
    const tbody = document.getElementById('tabela-membros');
    if(!tbody) return;

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
                <button type="button" class="btn-icon" onclick="editarMembro('${getVal(m, 'ID')}')" style="cursor:pointer">✏️</button>
                <button type="button" class="btn-icon" onclick="deletarMembro('${getVal(m, 'ID')}')" style="color:red; cursor:pointer; margin-left:10px;">🗑️</button>
            </td>
        </tr>
    `).join('');
}

window.filtrarTabelaMembros = function() {
    const busca = document.getElementById('buscaMembro').value.toLowerCase();
    const filtrados = cacheMembros.filter(m => 
        getVal(m, 'NOME').toLowerCase().includes(busca) || getVal(m, 'CPF').toLowerCase().includes(busca)
    );
    renderizarTabelaMembros(filtrados);
};

// CRUD MEMBROS
window.abrirModalMembro = function(idEditar = null) {
    const form = document.getElementById('formMembro');
    if(form) form.reset();
    document.getElementById('m_id').value = '';
    document.getElementById('tituloModalMembro').innerText = 'Novo Membro';

    if (idEditar && cacheMembros.length > 0) {
        const m = cacheMembros.find(x => getVal(x, 'ID') == idEditar);
        if (m) {
            document.getElementById('tituloModalMembro').innerText = 'Editar Membro';
            document.getElementById('m_id').value = getVal(m, 'ID');
            document.getElementById('m_nome').value = getVal(m, 'NOME');
            document.getElementById('m_cpf').value = getVal(m, 'CPF');
            document.getElementById('m_nasc').value = dataParaInput(getVal(m, 'NASCIMENTO'));
            
            // Preencher outros campos conforme existam no HTML
            const setVal = (eid, val) => { const el = document.getElementById(eid); if(el) el.value = val || ''; };
            setVal('m_estado', getVal(m, 'ESTADO_CIVIL'));
            setVal('m_conjuge', getVal(m, 'CONJUGE'));
            setVal('m_data_casamento', dataParaInput(getVal(m, 'DATA_CASAMENTO')));
            setVal('m_filhos', getVal(m, 'FILHOS'));
            setVal('m_pai', getVal(m, 'PAI'));
            setVal('m_mae', getVal(m, 'MAE'));
            setVal('m_profissao', getVal(m, 'PROFISSAO'));
            setVal('m_situacao', getVal(m, 'SITUACAO_TRABALHO'));
            setVal('m_cargo', getVal(m, 'CARGO'));
            setVal('m_departamento', getVal(m, 'DEPARTAMENTO'));
            setVal('m_perfil', getVal(m, 'PERFIL'));
        }
    }
    document.getElementById('modalMembro').classList.remove('hidden');
};
window.editarMembro = window.abrirModalMembro;

window.salvarMembro = async function(e) {
    e.preventDefault(); // IMPORTANTE: Previne reload da página
    const btn = e.target.querySelector('button[type="submit"]');
    if(btn) { btn.disabled = true; btn.innerText = "Salvando..."; }

    const id = document.getElementById('m_id').value;
    
    // Objeto Payload deve bater com o esperado no Python
    const payload = {
        NOME: document.getElementById('m_nome').value.toUpperCase(),
        CPF: document.getElementById('m_cpf').value,
        NASCIMENTO: dataDoInput(document.getElementById('m_nasc').value),
        ESTADO_CIVIL: document.getElementById('m_estado').value,
        CONJUGE: document.getElementById('m_conjuge').value.toUpperCase(),
        DATA_CASAMENTO: dataDoInput(document.getElementById('m_data_casamento').value),
        FILHOS: document.getElementById('m_filhos').value.toUpperCase(),
        PAI: document.getElementById('m_pai').value.toUpperCase(),
        MAE: document.getElementById('m_mae').value.toUpperCase(),
        PROFISSAO: document.getElementById('m_profissao').value.toUpperCase(),
        SITUACAO_TRABALHO: document.getElementById('m_situacao').value,
        CARGO: document.getElementById('m_cargo').value,
        DEPARTAMENTO: document.getElementById('m_departamento').value.toUpperCase(),
        PERFIL: document.getElementById('m_perfil').value,
        SENHA: document.getElementById('m_senha').value
    };

    const url = id ? `${API_BASE}/membros/${id}` : `${API_BASE}/membros`;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });

        if(!res.ok) throw new Error("Erro na API");
        
        document.getElementById('modalMembro').classList.add('hidden');
        await carregarMembros(); // Recarrega lista
        alert("Membro salvo com sucesso!");
    } catch(err) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        if(btn) { btn.disabled = false; btn.innerText = "Salvar Dados"; }
    }
};

window.deletarMembro = async function(id) {
    if(!confirm("Tem certeza que deseja excluir este membro?")) return;
    try {
        const res = await fetch(`${API_BASE}/membros/${id}`, { 
            method: 'DELETE',
            headers: getHeaders()
        });
        if(!res.ok) throw new Error("Falha na exclusão");
        carregarMembros();
    } catch(e) { 
        alert("Erro ao excluir: " + e.message); 
    }
};

// ========================================================
// 3. AGENDA PASTOR
// ========================================================
async function carregarAgendaPastor() {
    const tbody = document.getElementById('tabela-agenda-pastor');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando agenda...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/agenda-pastor`, { headers: { 'Cache-Control': 'no-cache' } });
        if (!res.ok) throw new Error(`Status: ${res.status}`);

        cacheAgendaPastor = await res.json();
        
        // Ordena por data
        cacheAgendaPastor.sort((a,b) => parseDate(getVal(a, 'DATA')) - parseDate(getVal(b, 'DATA')));

        if (cacheAgendaPastor.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Agenda vazia.</td></tr>';
            return;
        }

        tbody.innerHTML = cacheAgendaPastor.map(a => `
            <tr>
                <td>${getVal(a, 'DATA')}</td>
                <td>${getVal(a, 'HORARIO')}</td>
                <td><strong>${getVal(a, 'EVENTO')}</strong><br><small style="color:#666">${getVal(a, 'OBSERVACAO')}</small></td>
                <td>${getVal(a, 'LOCAL')}</td>
                <td>
                    <button type="button" class="btn-icon" onclick="editarEventoPastor('${getVal(a, 'ID')}')" style="cursor:pointer">✏️</button>
                    <button type="button" class="btn-icon" onclick="deletarEventoPastor('${getVal(a, 'ID')}')" style="color:red; cursor:pointer; margin-left:10px;">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        console.error("Erro Agenda Pastor:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Erro ao carregar dados.</td></tr>';
    }
}

// CRUD AGENDA PASTOR
window.abrirModalEventoPastor = function(idEditar = null) {
    const form = document.getElementById('formPastor');
    if(form) form.reset();
    document.getElementById('p_id').value = '';
    document.getElementById('tituloModalPastor').innerText = "Novo Compromisso";

    if(idEditar && cacheAgendaPastor.length > 0) {
        const a = cacheAgendaPastor.find(x => getVal(x, 'ID') == idEditar);
        if(a) {
            document.getElementById('tituloModalPastor').innerText = "Editar Compromisso";
            document.getElementById('p_id').value = getVal(a, 'ID');
            document.getElementById('p_data').value = dataParaInput(getVal(a, 'DATA'));
            document.getElementById('p_evento').value = getVal(a, 'EVENTO');
            document.getElementById('p_hora').value = getVal(a, 'HORARIO');
            document.getElementById('p_local').value = getVal(a, 'LOCAL');
            document.getElementById('p_obs').value = getVal(a, 'OBSERVACAO');
        }
    }
    document.getElementById('modalPastor').classList.remove('hidden');
};
window.editarEventoPastor = window.abrirModalEventoPastor;

window.salvarAgendaPastor = async function(e) {
    e.preventDefault(); // Previne reload
    
    const btnSalvar = e.target.querySelector('button[type="submit"]');
    if(btnSalvar) { btnSalvar.innerText = "Salvando..."; btnSalvar.disabled = true; }

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

    try {
        const res = await fetch(url, {
            method: method,
            headers: getHeaders(), // Envia o token
            body: JSON.stringify(payload)
        });
        
        if(!res.ok) throw new Error("Falha ao salvar");

        document.getElementById('modalPastor').classList.add('hidden');
        await carregarAgendaPastor(); // Recarrega a tabela
        carregarDashboard(); // Atualiza dashboard em background
    } catch(err) {
        alert("Erro ao salvar: " + err.message);
    } finally {
        if(btnSalvar) { btnSalvar.innerText = "Salvar na Agenda"; btnSalvar.disabled = false; }
    }
};

window.deletarEventoPastor = async function(id) {
    if(!confirm("Excluir este compromisso?")) return;
    try {
        const res = await fetch(`${API_BASE}/agenda-pastor/${id}`, { 
            method: 'DELETE',
            headers: getHeaders()
        });
        if(!res.ok) throw new Error("Falha");
        carregarAgendaPastor();
        carregarDashboard();
    } catch(e) { alert("Erro ao excluir."); }
};

// ========================================================
// 4. MEUS DADOS
// ========================================================
function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    if (!div) return;
    
    if (!usuario) {
        try { usuario = JSON.parse(sessionStorage.getItem('usuario_sistema')); } catch(e){}
    }

    if (!usuario) {
        div.innerHTML = '<p style="color:red; text-align:center;">Não foi possível carregar seus dados.</p>';
        return;
    }

    let html = '';
    const ignorar = ['ID', 'SENHA', 'TOKEN', 'CRIADO_EM'];
    
    for (const key in usuario) {
        // Filtra chaves técnicas
        if (ignorar.some(ig => key.toUpperCase().includes(ig))) continue;
        
        const label = key.replace(/_/g, ' ').toUpperCase();
        const valor = usuario[key] === null ? '' : usuario[key];

        html += `
            <div class="form-group" style="margin-bottom:10px;">
                <label style="font-size:12px; color:#666;">${label}</label>
                <input class="form-input" value="${valor}" disabled style="background:#f1f5f9; width:100%;">
            </div>
        `;
    }
    div.innerHTML = html || '<p>Sem dados visíveis.</p>';
}

// ========================================================
// 5. NAVEGAÇÃO
// ========================================================
// Esta função é chamada pelo onclick do HTML que você mandou
window.mostrarTela = function(telaId, btn) {
    // 1. Oculta todas as seções
    ['sec-dashboard', 'sec-membros', 'sec-pastor', 'sec-perfil'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    // 2. Remove 'active' de todos os botões do menu
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    // 3. Mostra a seção desejada e ativa o botão
    const alvo = document.getElementById('sec-' + telaId);
    if(alvo) alvo.classList.remove('hidden');
    if (btn) btn.classList.add('active');

    // 4. Carrega os dados específicos da tela
    if (telaId === 'membros') carregarMembros();
    else if (telaId === 'pastor') carregarAgendaPastor();
    else if (telaId === 'perfil') renderizarMeusDados();
    else if (telaId === 'dashboard') carregarDashboard();

    // 5. Fecha sidebar em mobile
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) sidebar.classList.remove('open');
};
