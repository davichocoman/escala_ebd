const API_BASE = 'https://api-escala.onrender.com/api';
const NOMES_MESES = ["", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

// Estado global unificado
const SISTEMA = {
    usuario: null,
    token: null,
    dados: {
        dashboard: { agenda: [], reservas: [] } // Para guardar os dados baixados
    }
};

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica Login
    const userStr = sessionStorage.getItem('usuario_sistema');
    SISTEMA.token = sessionStorage.getItem('token_sistema');

    if (!userStr) {
        Swal.fire({
            icon: 'warning',
            title: 'Sessão expirada',
            text: 'Por favor, faça login novamente.',
            timer: 3000,
            showConfirmButton: false
        }).then(() => window.location.href = '/login');
        return;
    }

    SISTEMA.usuario = JSON.parse(userStr);

    // 2. Sidebar e Inicialização
    const nome = getVal(SISTEMA.usuario, 'NOME') ? getVal(SISTEMA.usuario, 'NOME').split(' ')[0] : 'Membro';
    const perfil = getVal(SISTEMA.usuario, 'PERFIL') ? getVal(SISTEMA.usuario, 'PERFIL').split(' ')[0] : 'Membro';
    const display = document.getElementById('userDisplay');
    if (display) display.innerHTML = `Olá, <strong>${nome}</strong><br><small>${perfil}</small>`;

    // CONFIGURAR A PESQUISA (NOVO)
    const inputBusca = document.getElementById('buscaAgenda');
    if (inputBusca) {
        inputBusca.addEventListener('input', debounce(() => {
            renderizarAgendaGeralCards();
        }, 300));
    }

    // 3. Renderiza Meus Dados
    renderizarMeusDados();

    // 4. Busca dados da Agenda/Reservas em background
    await carregarDadosGerais();
});

// ============================================================
// 2. CARREGAMENTO DE DADOS (Agenda e Reservas)
// ============================================================
async function carregarDadosGerais() {
    console.log("🔄 Baixando agenda e reservas...");
    
    // Feedback visual simples
    document.getElementById('lista-agenda-geral-cards').innerHTML = '<p style="padding:10px">Carregando agenda...</p>';
    document.getElementById('lista-reservas-cards').innerHTML = '<p style="padding:10px">Carregando reservas...</p>';

    try {
        const res = await fetch(`${API_BASE}/patrimonio/dados`, {
            headers: { 
                'Content-Type': 'application/json',
                // Alguns endpoints podem pedir token, mesmo que não validem permissão de admin estrita
                'x-admin-token': SISTEMA.token 
            }
        });

        if (res.ok) {
            SISTEMA.dados.dashboard = await res.json();
            
            console.log("✅ Dados carregados!", SISTEMA.dados.dashboard);
            renderizarDashboard();
            renderizarAgendaGeralCards();
            renderizarReservasCards();
        }
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        document.getElementById('lista-agenda-geral-cards').innerHTML = '<p class="empty-msg">Erro ao carregar agenda.</p>';
        document.getElementById('lista-reservas-cards').innerHTML = '<p class="empty-msg">Erro ao carregar reservas.</p>';
    }
}

// ============================================================
// 3. RENDERIZAÇÃO (Somente Leitura)
// ============================================================

// 1. DASHBOARD (Visão 7 Dias)
function renderizarDashboard() {
    const containerAgenda = document.getElementById('dash-lista-agenda');
    const containerReservas = document.getElementById('dash-lista-reservas');
    
    if (!containerAgenda || !containerReservas) return;

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(); limite.setDate(hoje.getDate() + 7); limite.setHours(23,59,59,999);

    // Filtro auxiliar
    const filtroSemana = (item, chaveEvento, chaveData) => {
        if (!eventoValido(item, chaveEvento, chaveData)) return false;
        const d = dataParaObj(getVal(item, chaveData));
        return d >= hoje && d <= limite;
    };

    // --- Agenda Geral (Próximos 7 dias) ---
    const agendaSemana = (SISTEMA.dados.dashboard.agenda || [])
        .filter(ev => filtroSemana(ev, 'EVENTO', 'DATA'))
        .sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));

    document.getElementById('count-eventos-semana').innerText = agendaSemana.length;

    if (agendaSemana.length === 0) {
        containerAgenda.innerHTML = '<p class="empty-msg">Nenhum evento esta semana.</p>';
    } else {
        containerAgenda.innerHTML = agendaSemana.map(ev => `
            <div class="member-card" style="padding: 10px; border-left: 4px solid #ef4444;">
                <div style="font-weight:bold; color:#b91c1c">${getVal(ev, 'EVENTO')}</div>
                <div style="font-size:0.85rem; color:#666">
                    ${getVal(ev, 'DATA')} - ${getVal(ev, 'LOCAL')}
                </div>
            </div>
        `).join('');
    }

    // --- Reservas (Próximos 7 dias) ---
    const reservasSemana = (SISTEMA.dados.dashboard.reservas || [])
        .filter(res => filtroSemana(res, 'EVENTO', 'DATA'))
        .sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));

    document.getElementById('count-reservas-semana').innerText = reservasSemana.length;

    if (reservasSemana.length === 0) {
        containerReservas.innerHTML = '<p class="empty-msg">Nenhuma reserva esta semana.</p>';
    } else {
        containerReservas.innerHTML = reservasSemana.map(res => `
            <div class="member-card" style="padding: 10px; border-left: 4px solid #22c55e;">
                <div style="font-weight:bold; color:#15803d">${getVal(res, 'EVENTO')}</div>
                <div style="font-size:0.85rem; color:#666">
                    ${getVal(res, 'DATA')} | ${getVal(res, 'HORARIO_INICIO') || getVal(res, 'inicio')}
                </div>
                <div style="font-size:0.8rem; color:#888">${getVal(res, 'LOCAL')}</div>
            </div>
        `).join('');
    }
}

// --- Meus Dados ---
function renderizarMeusDados() {
    const container = document.getElementById('form-meus-dados');
    if (!container || !SISTEMA.usuario) return;

    // --- LÓGICA DA FOTO GRANDE ---
    const foto = getVal(SISTEMA.usuario, 'FOTO');
    const nome = getVal(SISTEMA.usuario, 'NOME');
    
    let htmlFoto = '';
    if (foto && foto.length > 20) {
        htmlFoto = `<img src="${foto}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:4px solid #fff; box-shadow:0 4px 6px rgba(0,0,0,0.1); margin-bottom:15px;">`;
    } else {
        htmlFoto = `<div style="width:120px; height:120px; border-radius:50%; background:#cbd5e1; display:flex; align-items:center; justify-content:center; margin-bottom:15px; border:4px solid #fff; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <span class="material-icons" style="font-size:60px; color:#fff;">person</span>
        </div>`;
    }

    // Header do Perfil (Injetado antes das seções)
    const headerPerfil = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #e2e8f0;">
            ${htmlFoto}
            <h2 style="margin:0; color:#1e293b;">${nome}</h2>
            <span style="color:#64748b; font-size:0.9rem;">${getVal(SISTEMA.usuario, 'CARGO') || 'Membro'}</span>
        </div>
    `;
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
                { key: 'BATISMO', label: 'Data de Batismo', span: 6, isDate: true },
                { key: 'CARGO', label: 'Cargo Atual', span: 6, isList: true },
                { key: 'DEPARTAMENTO', label: 'Departamento', span: 6 }
            ]
        }
    ];

    container.innerHTML = '';

    secoes.forEach(secao => {
        const temDados = secao.campos.some(c => getVal(SISTEMA.usuario, c.key));
        if (!temDados) return;

        container.innerHTML += `<div class="section-title-bar">${secao.titulo}</div>`;

        secao.campos.forEach(campo => {
            let valor = getVal(SISTEMA.usuario, campo.key);
            if (!valor) return;

            let htmlConteudo = '';
            if (campo.isCPF) htmlConteudo = `<span class="data-pill">${formatarCPF(valor)}</span>`;
            else if (campo.isDate) htmlConteudo = `<span class="data-pill">${formatarData(valor)}</span>`;
            else if (campo.isList && valor.toString().includes(',')) {
                htmlConteudo = valor.split(',').map(item => `<span class="data-pill">${item.trim()}</span>`).join('');
            } else {
                htmlConteudo = `<span class="data-pill">${valor}</span>`;
            }

            container.innerHTML += `
                <div class="form-group" style="grid-column: span ${campo.span}">
                    <label>${campo.label}</label>
                    <div class="valor-box">${htmlConteudo}</div>
                </div>`;
        });
    });
}

// --- Agenda Geral (Visualização) ---
function renderizarAgendaGeralCards() {
    const container = document.getElementById('lista-agenda-geral-cards');
    const dados = SISTEMA.dados.dashboard.agenda || [];
    
    // Captura termo de busca
    const termo = (document.getElementById('buscaAgenda')?.value || '').toLowerCase();

    // Filtra (Data Valida + Termo de Busca)
    const validos = dados.filter(ev => {
        const isValido = eventoValido(ev, 'EVENTO', 'DATA');
        if (!isValido) return false;

        // Lógica da Pesquisa: Nome do Evento OU Responsável OU Local
        const nome = getVal(ev, 'EVENTO').toLowerCase();
        const resp = getVal(ev, 'RESPONSAVEL').toLowerCase();
        const local = getVal(ev, 'LOCAL').toLowerCase();
        
        return nome.includes(termo) || resp.includes(termo) || local.includes(termo);
    });

    // Ordena
    validos.sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));

    if (validos.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum evento encontrado.</p>';
        return;
    }

    let html = "";
    let mesAtual = -1;

    validos.forEach(ev => {
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
            </div>`;
    });
    container.innerHTML = html;
}

// --- Reservas (Visualização) ---
function renderizarReservasCards() {
    const container = document.getElementById('lista-reservas-cards');
    const dados = SISTEMA.dados.dashboard.reservas || [];
    
    const validos = dados
        .filter(res => eventoValido(res, 'EVENTO', 'DATA')) // Usa 'EVENTO' conforme corrigimos antes
        .sort((a,b) => dataParaObj(getVal(a, 'DATA')) - dataParaObj(getVal(b, 'DATA')));

    if (validos.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma reserva encontrada.</p>';
        return;
    }

    let html = "";
    let mesAtual = -1;

    validos.forEach(res => {
        const d = dataParaObj(getVal(res, 'DATA'));
        const m = d.getMonth() + 1;

        if (m !== mesAtual) {
            mesAtual = m;
            html += `<div class="month-header">${NOMES_MESES[m]}</div>`;
        }

        html += `
            <div class="member-card" style="border-left: 5px solid var(--green, #22c55e);">
                <div class="card-header"><strong>${getVal(res, 'EVENTO')}</strong></div>
                <div class="card-body">
                    <div><strong>Data:</strong> ${getVal(res, 'DATA')}</div>
                    <div>
                        <strong>Horário:</strong> 
                        ${getVal(res, 'HORARIO_INICIO') || getVal(res, 'inicio')} - 
                        ${getVal(res, 'HORARIO_FIM') || getVal(res, 'fim')}
                    </div>
                    <div><strong>Local:</strong> ${getVal(res, 'LOCAL')}</div>
                    <div><strong>Responsável:</strong> ${getVal(res, 'RESPONSAVEL')}</div>
                </div>
                </div>`;
    });
    container.innerHTML = html;
}

// ============================================================
// 4. UTILITÁRIOS E NAVEGAÇÃO
// ============================================================

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Atualizar função mostrarTela para incluir o dashboard
window.mostrarTela = function(telaId, btn) {
    ['dashboard', 'meus-dados', 'agenda-geral', 'reservas'].forEach(id => {
        const el = document.getElementById('sec-' + id);
        if (el) el.classList.add('hidden');
    });

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const alvo = document.getElementById('sec-' + telaId);
    if (alvo) alvo.classList.remove('hidden');

    // Se for mobile, fecha sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('open');
        document.getElementById('sidebar-overlay').style.display = 'none';
    }
};

// Validação de evento (igual ao painel-secretaria)
function eventoValido(item, chaveEvento, chaveData) {
    const nome = String(getVal(item, chaveEvento) || '').trim();
    if (!nome || nome.toLowerCase() === 'null') return false;

    const dataStr = getVal(item, chaveData)?.trim();
    if (!dataStr) return false;

    const data = dataParaObj(dataStr);
    if (isNaN(data.getTime())) return false;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    return data >= hoje;
}

// Helpers
function getVal(obj, key) {
    if (!obj || typeof obj !== 'object') return '';
    const upperKey = key.toUpperCase();
    for (const k in obj) {
        if (k.toUpperCase() === upperKey) return obj[k] || '';
    }
    return '';
}

function dataParaObj(str) {
    if (!str || typeof str !== 'string') return new Date(0);
    const p = str.split('/');
    return p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date(0);
}

// Formatação
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

// Sidebar Toggle
window.toggleSidebar = function() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    let overlay = document.getElementById('sidebar-overlay');
    if (isOpen) {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 280);
    }
};

window.logout = function() {
    Swal.fire({
        title: 'Deseja sair?',
        text: "Você será redirecionado para a tela de login.",
        icon: 'question',
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
