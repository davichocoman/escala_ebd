const API_BASE = 'https://api-escala.onrender.com/api';
let usuario = null;
let token = null;

// Cache global para evitar re-buscas desnecessárias, se desejar
let cacheMembros = [];
let cacheAgendaPastor = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Recupera sessão
    const userStr = sessionStorage.getItem('usuario_sistema');
    token = sessionStorage.getItem('token_sistema');

    if (!userStr) { 
        console.warn("Usuário não encontrado na sessão. Redirecionando...");
        sair(); 
        return; 
    }

    try {
        usuario = JSON.parse(userStr);
    } catch (e) {
        console.error("Erro ao processar dados do usuário:", e);
        sair();
        return;
    }

    // 2. Renderiza Header
    const nomeUser = (getVal(usuario, 'NOME') || 'Secretaria').split(' ')[0];
    const cargoUser = getVal(usuario, 'CARGO') || 'Admin';
    
    const userDisplay = document.getElementById('userDisplay');
    if(userDisplay) {
        userDisplay.innerHTML = `Olá, <strong>${nomeUser}</strong><br><span style="color:#3b82f6;">${cargoUser}</span>`;
    }

    // 3. Carrega Dashboard Inicial
    await carregarDashboard();
});

function sair() {
    sessionStorage.clear();
    window.location.href = '/login';
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('open');
}

// ========================================================
// FUNÇÃO MÁGICA: Resolve Maiúsculas/Minúsculas de forma segura
// ========================================================
function getVal(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    if (!key) return '';
    
    // Procura ignorando case (melhoria: usa Object.keys para achar match)
    const lowerKey = key.toLowerCase();
    for (const k in obj) {
        if (k.toLowerCase() === lowerKey) {
            return obj[k];
        }
    }
    return '';
}

// ========================================================
// FUNÇÃO DE DATA BLINDADA (Correção Principal)
// ========================================================
function parseDate(str) {
    // Se não for string ou for vazia, retorna data "zero" (seguro para ordenação)
    if (!str || typeof str !== 'string' || str.length < 6) return new Date(0);
    
    try {
        // Tenta formato BR: dd/mm/yyyy
        if (str.includes('/')) {
            const p = str.split('/');
            if (p.length === 3) return new Date(p[2], p[1]-1, p[0]);
        }
        // Tenta formato ISO: yyyy-mm-dd
        if (str.includes('-')) {
            const p = str.split('-');
            if (p.length === 3) return new Date(p[0], p[1]-1, p[2]);
        }
    } catch (e) {
        console.warn("Erro ao fazer parse da data:", str);
    }
    return new Date(0);
}

function dataParaInput(str) {
    if(!str || str.length !== 10) return '';
    const p = str.split('/');
    if(p.length !== 3) return '';
    return `${p[2]}-${p[1]}-${p[0]}`;
}

function dataDoInput(str) {
    if(!str) return '';
    const p = str.split('-');
    if(p.length !== 3) return '';
    return `${p[2]}/${p[1]}/${p[0]}`;
}

// ========================================================
// 1. DASHBOARD
// ========================================================
async function carregarDashboard() {
    try {
        console.log("Iniciando carregamento do Dashboard...");
        
        // Adiciona headers para evitar cache agressivo
        const headers = { 'Cache-Control': 'no-cache' };

        const [resPastor, resGeral] = await Promise.all([
            fetch(`${API_BASE}/agenda-pastor`, { headers }),
            fetch(`${API_BASE}/patrimonio/dados`, { headers })
        ]);

        if (!resPastor.ok || !resGeral.ok) {
            throw new Error(`Erro nas APIs: Pastor=${resPastor.status}, Geral=${resGeral.status}`);
        }

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

    } catch (e) { 
        console.error("Erro no Dashboard:", e); 
    }
}

function renderizarListaDash(elementId, lista, keyTitulo, keyData, filtroFn) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    
    if (!Array.isArray(lista)) {
        ul.innerHTML = '<li class="empty-msg">Erro nos dados.</li>';
        return;
    }

    try {
        const filtrados = lista.filter(item => filtroFn(getVal(item, keyData)));
        // Ordenação segura
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
        console.error(`Erro ao renderizar lista ${elementId}:`, e);
    }
}

// ========================================================
// 2. MEMBROS
// ========================================================
async function carregarMembros() {
    console.log("Chamando carregarMembros()...");
    const tbody = document.getElementById('tabela-membros');
    if (!tbody) {
        console.error("ERRO: Elemento 'tabela-membros' não encontrado no HTML.");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando dados...</td></tr>';

    try {
        // Headers para evitar cache
        const res = await fetch(`${API_BASE}/membros`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });

        console.log("Fetch membros status:", res.status);
        if(!res.ok) throw new Error(`Erro API: ${res.status}`);
        
        cacheMembros = await res.json();
        console.log("Membros carregados:", cacheMembros.length);
        
        renderizarTabelaMembros(cacheMembros);
    } catch (e) {
        console.error("Erro detalhado em Membros:", e);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center">Erro ao buscar dados: ${e.message}. Verifique a API ou rede.</td></tr>`;
        cacheMembros = []; // Limpa cache se falhar
    }
}

function renderizarTabelaMembros(lista) {
    const tbody = document.getElementById('tabela-membros');
    if (!lista || lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum registro encontrado.</td></tr>';
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

// Função de filtro (estava no HTML mas não implementada)
window.filtrarTabelaMembros = function() {
    const busca = document.getElementById('buscaMembro').value.toLowerCase();
    const filtrados = cacheMembros.filter(m => 
        getVal(m, 'NOME').toLowerCase().includes(busca) || getVal(m, 'CPF').toLowerCase().includes(busca)
    );
    renderizarTabelaMembros(filtrados);
};

// ========================================================
// 3. AGENDA PASTOR
// ========================================================
async function carregarAgendaPastor() {
    console.log("Chamando carregarAgendaPastor()...");
    const tbody = document.getElementById('tabela-agenda-pastor');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/agenda-pastor`, {
            headers: { 'Cache-Control': 'no-cache' }
        });

        if (!res.ok) throw new Error(`Erro API: ${res.status}`);

        cacheAgendaPastor = await res.json();
        
        if (!cacheAgendaPastor || cacheAgendaPastor.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Agenda vazia.</td></tr>';
            return;
        }
        
        // Ordena com segurança
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
        console.error("Erro ao carregar agenda:", e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red">Erro ao carregar agenda: ' + e.message + '</td></tr>';
        cacheAgendaPastor = []; // Limpa cache
    }
}

// ========================================================
// 4. MEUS DADOS
// ========================================================
function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    if (!div) return;
    if (!usuario) {
        div.innerHTML = '<p style="color:red">Erro: Dados do usuário não disponíveis. Tente relogar.</p>';
        return;
    }

    let html = '';
    const ignorar = ['ID', 'SENHA', 'id', 'senha', 'TOKEN', 'token'];
    
    for (const key in usuario) {
        if (ignorar.includes(key.toUpperCase())) continue;
        // Evita mostrar valores nulos/undefined
        const valor = usuario[key] === null || usuario[key] === undefined ? '' : usuario[key];
        
        html += `
            <div class="form-group">
                <label>${key.replace(/_/g, ' ').toUpperCase()}</label>
                <input class="form-input" value="${valor}" disabled style="background:#f1f5f9;">
            </div>
        `;
    }
    div.innerHTML = html || '<p style="color:red">Nenhum dado disponível.</p>'; // Fallback se vazio
}

// ========================================================
// 5. UTILITÁRIOS DE NAVEGAÇÃO
// ========================================================
window.mostrarTela = function(telaId, btn) {
    // Esconde todas as seções
    ['dashboard', 'membros', 'pastor', 'perfil'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if(el) el.classList.add('hidden');
    });
    
    // Remove classe active do menu
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    // Mostra a escolhida
    const alvo = document.getElementById('sec-' + telaId);
    if(alvo) alvo.classList.remove('hidden');
    
    // Ativa o botão clicado
    if (btn) btn.classList.add('active');
    
    // Fecha sidebar mobile
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) sidebar.classList.remove('open');

    // Carrega os dados específicos
    if (telaId === 'membros') carregarMembros();
    if (telaId === 'pastor') carregarAgendaPastor();
    if (telaId === 'perfil') renderizarMeusDados();
};

// ========================================================
// 6. MODAIS E EDIÇÃO (CRUD)
// ========================================================

// --- MEMBROS ---
window.abrirModalMembro = function(idEditar = null) {
    const form = document.getElementById('formMembro');
    if(form) form.reset();
    
    document.getElementById('m_id').value = '';
    const titulo = document.getElementById('tituloModalMembro');
    if(titulo) titulo.innerText = 'Novo Membro';

    if (idEditar && cacheMembros.length > 0) {
        const m = cacheMembros.find(x => getVal(x, 'ID') == idEditar);
        if (m) {
            if(titulo) titulo.innerText = 'Editar Membro';
            
            // Helper para preencher inputs com segurança
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if(el) el.value = val || '';
            };

            setVal('m_id', getVal(m, 'ID'));
            setVal('m_nome', getVal(m, 'NOME'));
            setVal('m_cpf', getVal(m, 'CPF'));
            setVal('m_nasc', dataParaInput(getVal(m, 'NASCIMENTO')));
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
            // Senha fica vazia por segurança
        }
    }
    document.getElementById('modalMembro').classList.remove('hidden');
};

window.fecharModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden'); 
};

window.editarMembro = window.abrirModalMembro;

window.salvarMembro = async function(e) {
    e.preventDefault();
    // Implementar a lógica de salvar/POST aqui se necessário, 
    // seguindo o padrão do salvarAgendaPastor
    alert("Funcionalidade de salvar membro precisa ser implementada igual à do Pastor.");
};

window.deletarMembro = async function(id) {
    if(!confirm("Tem certeza que deseja excluir este membro?")) return;
    try {
        await fetch(`${API_BASE}/membros/${id}`, { 
            method: 'DELETE', 
            headers: {'x-admin-token': 'admin_secret'} // Ajuste conforme seu backend
        });
        carregarMembros();
    } catch(e) {
        alert("Erro ao excluir: " + e);
    }
};

// --- AGENDA PASTOR ---
window.abrirModalEventoPastor = function(idEditar = null) {
    const form = document.getElementById('formPastor');
    if(form) form.reset();
    document.getElementById('p_id').value = '';
    
    if(idEditar && cacheAgendaPastor.length > 0) {
        const a = cacheAgendaPastor.find(x => getVal(x, 'ID') == idEditar);
        if(a) {
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
    
    try {
        await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json', 'x-admin-token': 'admin_secret'},
            body: JSON.stringify(payload)
        });
        
        document.getElementById('modalPastor').classList.add('hidden');
        carregarAgendaPastor();
        carregarDashboard();
    } catch(e) {
        alert("Erro ao salvar: " + e);
    }
};

window.deletarEventoPastor = async function(id) {
    if(!confirm("Excluir?")) return;
    try {
        await fetch(`${API_BASE}/agenda-pastor/${id}`, { method: 'DELETE', headers: {'x-admin-token': 'admin_secret'} });
        carregarAgendaPastor();
    } catch(e) { alert("Erro: " + e); }
};
