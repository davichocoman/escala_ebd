const API_BASE = 'https://api-escala.onrender.com/api';

// ============================================================
// 1. ESTADO GLOBAL (Aqui ficam todos os seus dados)
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

// ============================================================
// 2. INICIALIZAÇÃO (Roda assim que a tela abre)
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica Login
    const userStr = sessionStorage.getItem('usuario_sistema');
    SISTEMA.token = sessionStorage.getItem('token_sistema');

    if (!userStr || !SISTEMA.token) {
        window.location.href = '/login'; // Chuta para fora se não tiver logado
        return;
    }
    SISTEMA.usuario = JSON.parse(userStr);

    // 2. Mostra nome no topo
    const nome = SISTEMA.usuario.NOME ? SISTEMA.usuario.NOME.split(' ')[0] : 'Admin';
    const display = document.getElementById('userDisplay');
    if(display) display.innerHTML = `Olá, <strong>${nome}</strong>`;

    // 3. Prepara os botões (Menu, Sair, Salvar)
    configurarBotoes();

    // 4. CARREGA TUDO DE UMA VEZ
    await carregarTudoDoBanco();
});

// ============================================================
// 3. FUNÇÃO CENTRAL DE CARREGAMENTO (A Mágica acontece aqui)
// ============================================================
async function carregarTudoDoBanco() {
    console.log("🔄 Baixando todos os dados da API...");
    
    // Mostra "Carregando" em todas as listas para dar feedback visual
    document.getElementById('list-dash-igreja').innerHTML = '<li>Carregando...</li>';
    document.getElementById('tabela-membros').innerHTML = '<tr><td colspan="5">Atualizando...</td></tr>';
    document.getElementById('tabela-agenda-pastor').innerHTML = '<tr><td colspan="5">Atualizando...</td></tr>';

    const headers = { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'x-admin-token': SISTEMA.token // Usa o token da sessão
    };

    try {
        // Faz as 3 chamadas em paralelo (muito mais rápido)
        const [resMembros, resPastor, resDash] = await Promise.all([
            fetch(`${API_BASE}/membros`, { headers }),
            fetch(`${API_BASE}/agenda-pastor`, { headers }),
            fetch(`${API_BASE}/patrimonio/dados`, { headers })
        ]);

        // Salva nas variáveis globais se deu certo
        if (resMembros.ok) SISTEMA.dados.membros = await resMembros.json();
        if (resPastor.ok) SISTEMA.dados.agendaPastor = await resPastor.json();
        if (resDash.ok)   SISTEMA.dados.dashboard = await resDash.json();

        console.log("✅ Dados carregados!", SISTEMA.dados);

        // Agora desenha tudo na tela
        renderizarMembros();
        renderizarAgendaPastor();
        renderizarDashboard();
        renderizarMeusDados();

    } catch (erro) {
        console.error("Erro fatal ao carregar:", erro);
        alert("Erro ao conectar com o servidor. Verifique sua internet.");
    }
}

// ============================================================
// 4. FUNÇÕES DE DESENHAR NA TELA (Render)
// Só leem a variável SISTEMA.dados. Não chamam API.
// ============================================================

function renderizarDashboard() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(); limite.setDate(hoje.getDate() + 7);

    // Filtro simples: data >= hoje e data <= semana que vem
    const filtroSemana = (item, chaveData) => {
        const d = dataParaObj(item[chaveData]);
        return d >= hoje && d <= limite;
    };

    // 1. Igreja
    const listaIgreja = SISTEMA.dados.dashboard.agenda || [];
    preencherListaDash('list-dash-igreja', listaIgreja, 'evento', 'data', filtroSemana);

    // 2. Pastor
    const listaPastor = SISTEMA.dados.agendaPastor || [];
    preencherListaDash('list-dash-pastor', listaPastor, 'EVENTO', 'DATA', filtroSemana);

    // 3. Reservas
    const listaReservas = SISTEMA.dados.dashboard.reservas || [];
    preencherListaDash('list-dash-reservas', listaReservas, 'evento', 'data', filtroSemana);
}

function preencherListaDash(idElemento, lista, chaveTitulo, chaveData, filtro) {
    const ul = document.getElementById(idElemento);
    const itensFiltrados = lista.filter(item => filtro(item, chaveData));
    
    // Ordena por data
    itensFiltrados.sort((a,b) => dataParaObj(a[chaveData]) - dataParaObj(b[chaveData]));

    if (itensFiltrados.length === 0) {
        ul.innerHTML = '<li class="empty-msg">Nada para esta semana.</li>';
        return;
    }

    ul.innerHTML = itensFiltrados.map(item => `
        <li>
            <strong>${item[chaveTitulo]}</strong>
            <span>${item[chaveData]}</span>
        </li>
    `).join('');
}

function renderizarMembros() {
    const busca = (document.getElementById('buscaMembro').value || '').toLowerCase();
    const tbody = document.getElementById('tabela-membros');
    
    // Filtra localmente (super rápido)
    const filtrados = SISTEMA.dados.membros.filter(m => 
        (m.NOME && m.NOME.toLowerCase().includes(busca)) || 
        (m.CPF && m.CPF.includes(busca))
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" align="center">Nenhum membro encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(m => `
        <tr>
            <td>${m.NOME}</td>
            <td>${m.CPF}</td>
            <td>${m.PERFIL || 'MEMBRO'}</td>
            <td>
                <button class="btn-icon" onclick="prepararEdicaoMembro('${m.ID}')">✏️</button>
                <button class="btn-icon" onclick="deletarItem('${m.ID}', 'membros')" style="color:red">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderizarAgendaPastor() {
    const tbody = document.getElementById('tabela-agenda-pastor');
    const lista = SISTEMA.dados.agendaPastor;
    
    // Ordena
    lista.sort((a,b) => dataParaObj(a.DATA) - dataParaObj(b.DATA));

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" align="center">Agenda vazia.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(a => `
        <tr>
            <td>${a.DATA}</td>
            <td>${a.HORARIO}</td>
            <td><strong>${a.EVENTO}</strong><br><small>${a.OBSERVACAO || ''}</small></td>
            <td>${a.LOCAL}</td>
            <td>
                <button class="btn-icon" onclick="prepararEdicaoPastor('${a.ID}')">✏️</button>
                <button class="btn-icon" onclick="deletarItem('${a.ID}', 'agenda-pastor')" style="color:red">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    if (!SISTEMA.usuario) return;
    
    let html = '';
    const ignorar = ['ID', 'SENHA', 'TOKEN'];
    
    for (const [key, val] of Object.entries(SISTEMA.usuario)) {
        if (ignorar.includes(key.toUpperCase())) continue;
        html += `<div class="form-group"><label>${key}</label><input class="form-input" value="${val || ''}" disabled style="background:#eee"></div>`;
    }
    div.innerHTML = html;
}

// ============================================================
// 5. INTERAÇÕES E BOTÕES
// ============================================================
function configurarBotoes() {
    // Busca Membros (Filtro instantâneo ao digitar)
    document.getElementById('buscaMembro').addEventListener('keyup', renderizarMembros);

    // Impede formulários de recarregar a página
    document.querySelectorAll('form').forEach(f => {
        f.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Identifica qual formulário é e chama a função certa
            if(f.id === 'formMembro') await salvarMembro();
            if(f.id === 'formPastor') await salvarPastor();
        });
    });
}

// Alternar Abas (Sem recarregar dados!)
window.mostrarTela = function(telaId, btn) {
    // Esconde tudo
    ['sec-dashboard', 'sec-membros', 'sec-pastor', 'sec-perfil'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    // Tira active dos menus
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    // Mostra o certo
    document.getElementById('sec-' + telaId).classList.remove('hidden');
    if(btn) btn.classList.add('active');

    // Se estiver no mobile, fecha menu
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) sidebar.classList.remove('open');
};

window.logout = function() {
    sessionStorage.clear();
    window.location.href = '/login';
};

window.toggleSidebar = function() {
    document.querySelector('.sidebar').classList.toggle('open');
};

// ============================================================
// 6. CRUD SIMPLIFICADO (Salvar e Deletar)
// ============================================================

// --- MEMBROS ---
window.abrirModalMembro = function() {
    document.getElementById('formMembro').reset();
    document.getElementById('m_id').value = '';
    document.getElementById('modalMembro').classList.remove('hidden');
};

window.prepararEdicaoMembro = function(id) {
    const m = SISTEMA.dados.membros.find(x => x.ID == id);
    if(!m) return;
    
    // Função auxiliar para preencher
    const set = (eid, val) => { const el = document.getElementById(eid); if(el) el.value = val || ''; };
    
    set('m_id', m.ID);
    set('m_nome', m.NOME);
    set('m_nasc', dataIso(m.NASCIMENTO)); // Converte dd/mm/yyyy para yyyy-mm-dd pro input date
    set('m_cpf', String(m.CPF));
    set('m_estadocivil', m.ESTADO_CIVIL);
    set('m_casamento', dataIso(m.DATA_CASAMENTO));
    set('m_conjuge', m.CONJUGE);
    set('m_filhos', m.FILHOS);
    set('m_pai', m.PAI);
    set('m_mae', m.MAE);
    set('m_profissao', m.PROFISSAO);
    set('m_situacaotrabalho', m.SITUACAO_TRABALHO);
    set('m_cargo', m.CARGO);
    set('m_departamento', m.DEPARTAMENTO);
    set('m_perfil', m.PERFIL);

    document.getElementById('modalMembro').classList.remove('hidden');
};

async function salvarMembro() {
    const id = document.getElementById('m_id').value;
    const dados = {
        NOME: document.getElementById('m_nome').value,
        NASCIMENTO: dataBr(document.getElementById('m_nasc').value), // Converte volta para dd/mm/yyyy
        CPF: String(document.getElementById('m_cpf').value),
        ESTADO_CIVIL: document.getElementById('m_estadocivil').value,
        DATA_CASAMENTO: document.getElementById('m_casamento').value,
        CONJUGE: document.getElementById('m_conjuge').value,
        FILHOS: document.getElementById('m_filhos').value,
        PAI: document.getElementById('m_pai').value,
        MAE: document.getElementById('m_mae').value,
        PROFISSAO: document.getElementById('m_profissao').value,
        SITUACAO_TRABALHO: document.getElementById('m_situacaotrabalho').value,
        CARGO: document.getElementById('m_cargo').value,
        DEPARTAMENTO: document.getElementById('m_departamento').value,
        PERFIL: document.getElementById('m_perfil').value,

    };

    await enviarDados(`${API_BASE}/membros`, id, dados);
    document.getElementById('modalMembro').classList.add('hidden');
}

// --- PASTOR ---
window.abrirModalEventoPastor = function() {
    document.getElementById('formPastor').reset();
    document.getElementById('p_id').value = '';
    document.getElementById('modalPastor').classList.remove('hidden');
};

window.prepararEdicaoPastor = function(id) {
    const a = SISTEMA.dados.agendaPastor.find(x => x.ID == id);
    if(!a) return;
    
    document.getElementById('p_id').value = a.ID;
    document.getElementById('p_evento').value = a.EVENTO;
    document.getElementById('p_data').value = dataIso(a.DATA);
    document.getElementById('p_hora').value = a.HORARIO;
    document.getElementById('p_local').value = a.LOCAL;
    document.getElementById('p_obs').value = a.OBSERVACAO;

    document.getElementById('modalPastor').classList.remove('hidden');
};

async function salvarPastor() {
    const id = document.getElementById('p_id').value;
    const dados = {
        EVENTO: document.getElementById('p_evento').value,
        DATA: dataBr(document.getElementById('p_data').value),
        HORARIO: document.getElementById('p_hora').value,
        LOCAL: document.getElementById('p_local').value,
        OBSERVACAO: document.getElementById('p_obs').value
    };

    await enviarDados(`${API_BASE}/agenda-pastor`, id, dados);
    document.getElementById('modalPastor').classList.add('hidden');
}

// Genérico para deletar qualquer coisa
window.deletarItem = async function(id, endpoint) {
    if(!confirm('Tem certeza?')) return;
    
    try {
        await fetch(`${API_BASE}/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'x-admin-token': SISTEMA.token }
        });
        // Recarrega tudo para atualizar as listas
        await carregarTudoDoBanco();
    } catch(e) {
        alert('Erro ao excluir.');
    }
};

window.fecharModal = function(id) {
    document.getElementById(id).classList.add('hidden');
};

// ============================================================
// 7. UTILITÁRIOS (Datas e Fetch Helper)
// ============================================================

async function enviarDados(urlBase, id, payload) {
    const url = id ? `${urlBase}/${id}` : urlBase;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const res = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': SISTEMA.token 
            },
            body: JSON.stringify(payload)
        });
        if(!res.ok) throw new Error();
        
        // RECARREGA TUDO APÓS SALVAR
        await carregarTudoDoBanco();
        alert('Salvo com sucesso!');
    } catch(e) {
        alert('Erro ao salvar. Verifique se você é Admin.');
    }
}

// Converte string 'dd/mm/yyyy' em Objeto Date (para ordenar)
function dataParaObj(str) {
    if(!str) return new Date(0);
    const p = str.split('/'); // Ex: 25/12/2023
    return p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date(0);
}

// Converte Objeto Date ou string 'dd/mm/yyyy' para 'yyyy-mm-dd' (input date)
function dataIso(str) {
    if(!str) return '';
    const p = str.split('/');
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
}

// Converte 'yyyy-mm-dd' (input date) para 'dd/mm/yyyy' (banco/visual)
function dataBr(str) {
    if(!str) return '';
    const p = str.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
}

window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const isOpen = sidebar.classList.toggle('open');

    // Gerencia overlay
    let overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 990;           // fica atrás da sidebar (que é 1000)
            display: none;
            transition: opacity 0.28s ease;
            opacity: 0;
        `;
        document.body.appendChild(overlay);

        // Fecha ao clicar no overlay
        overlay.addEventListener('click', () => {
            toggleSidebar();
        });
    }

    // Controla visibilidade e animação do overlay
    if (isOpen) {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 280);
    }
};

// Fecha sidebar ao clicar em item do menu no mobile
document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Se for clique em menu-item E sidebar aberta E tela pequena
    if (e.target.closest('.menu-item') && 
        sidebar.classList.contains('open') && 
        window.innerWidth < 768) {
        toggleSidebar();
    }
});

// Opcional: fecha ao apertar ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
});
