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

    const nome = getVal(SISTEMA.usuario, 'NOME').split(' ')[0];
    const perfil = getVal(SISTEMA.usuario, 'PERFIL');
    const foto = recuperarFoto(SISTEMA.usuario); // Usa a função de colagem

    const imgHtml = foto.length > 100 
        ? `<img src="${foto}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #fff;">`
        : `<div style="width:40px; height:40px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:white;"><span class="material-icons">person</span></div>`;

    const display = document.getElementById('userDisplay');
    if (display) {
        // Layout: Foto em cima ou ao lado do nome
        display.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                ${imgHtml}
                <div>
                    Olá, <strong>${nome}</strong><br>
                    <small>${getVal(SISTEMA.usuario, 'PERFIL')}</small>
                </div>
            </div>`;
    }

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
function recuperarFoto(obj) {
    if (!obj) return '';
    let fotoFull = getVal(obj, 'FOTO');
    if (!fotoFull || fotoFull.length < 100) {
        const f1 = getVal(obj, 'FOTO_1');
        const f2 = getVal(obj, 'FOTO_2');
        const f3 = getVal(obj, 'FOTO_3');
        fotoFull = (f1 + f2 + f3).replace(/null/g, '').trim();
    }
    return fotoFull;
}

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
                    ${window.formatarDataComDia(getVal(ev, 'DATA'))} - ${getVal(ev, 'LOCAL')}
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
                    ${window.formatarDataComDia(getVal(res, 'DATA'))} | ${getVal(res, 'HORARIO_INICIO') || getVal(res, 'inicio')}
                </div>
                <div style="font-size:0.8rem; color:#888">${getVal(res, 'LOCAL')}</div>
            </div>
        `).join('');
    }
}

window.formatarDataComDia = function(dataInput) {
    if (!dataInput) return "";
    if (typeof dataInput !== 'string') return dataInput;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    try {
        // A MÁGICA AQUI: Pesca exatamente o padrão "XX/XX/XXXX" ignorando textos
        const match = dataInput.match(/(\d{2})\/(\d{2})\/(\d{4}|\d{2})/);
        if (!match) return dataInput;

        const dia = parseInt(match[1]);
        const mes = parseInt(match[2]);
        let ano = parseInt(match[3]);

        if (ano < 100) ano += 2000;

        const data = new Date(ano, mes - 1, dia);
        if (isNaN(data.getTime())) return dataInput;
        
        data.setHours(0,0,0,0);

        const diffDias = Math.round((data.getTime() - hoje.getTime()) / 86400000);
        const diasSemana = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

        if (diffDias === 0) return "🔴 Hoje";
        if (diffDias === 1) return "🟠 Amanhã";
        if (diffDias === 2) return `🟡 Em 2 dias  • ${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}`;
        if (diffDias === 3) return `🟡 Em 3 dias  • ${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}`;
        if (diffDias > 3 && diffDias <= 6) return `🔵 Esta semana • ${diasSemana[data.getDay()]} (${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')})`;

        if (data.getFullYear() === hoje.getFullYear()) {
            return `${diasSemana[data.getDay()]} • ${String(dia).padStart(2,'0')}/${String(mes).padStart(2,'0')}`;
        }
        return `${String(dia).padStart(2,'0')} ${meses[mes-1]} ${ano}`;
    } catch {
        return dataInput;
    }
};

// --- Meus Dados ---
async function renderizarMeusDados() {
    const div = document.getElementById('form-meus-dados');
    if (!div || !SISTEMA.usuario) return;

    // --- LÓGICA DA FOTO GRANDE (Usando a função de colagem de fatias) ---
    const foto = recuperarFoto(SISTEMA.usuario);
    const nome = getVal(SISTEMA.usuario, 'NOME');
    
    let htmlFoto = '';
    if (foto && foto.length > 100) {
        htmlFoto = `<img src="${foto}" style="width:120px; height:120px; border-radius:50%; object-fit:cover; border:4px solid #fff; box-shadow:0 4px 6px rgba(0,0,0,0.1); margin-bottom:15px;">`;
    } else {
        htmlFoto = `
        <div style="width:120px; height:120px; border-radius:50%; background:#cbd5e1; display:flex; align-items:center; justify-content:center; margin-bottom:15px; border:4px solid #fff; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
            <span class="material-icons" style="font-size:60px; color:#fff;">person</span>
        </div>`;
    }

    // Header do Perfil (Nome e Cargo)
    const headerPerfil = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #e2e8f0; grid-column: span 12;">
            ${htmlFoto}
            <h2 style="margin:0; color:#1e293b; text-align:center;">${nome}</h2>
            <span style="color:#64748b; font-size:0.9rem;">${getVal(SISTEMA.usuario, 'CARGO') || 'Membro'}</span>
        </div>
    `;

    // Verifica se o membro é líder de algum departamento para liberar o menu
    try {
        const resDepts = await fetch(`${API_BASE}/cooperador/meus-departamentos`, {
            headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token }
        });
        
        if (resDepts.ok) {
            const depts = await resDepts.json();
            // Se ele for líder de pelo menos 1 departamento, mostra a aba
            if (depts.length > 0) {
                document.getElementById('item-menu-cooperadores')?.classList.remove('hidden');
            }
        }
    } catch (e) {
        console.error('Erro ao verificar liderança:', e);
    }

    // --- DEFINIÇÃO DAS SEÇÕES ---
    const secoes = [
        {
            titulo: 'Informações Básicas',
            campos: [
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

    let htmlCampos = '';

    secoes.forEach(secao => {
        // Verifica se a seção tem algum dado preenchido antes de renderizar o título
        const temDados = secao.campos.some(c => getVal(SISTEMA.usuario, c.key));
        if (!temDados) return;

        htmlCampos += `<div class="section-title-bar" style="grid-column: span 12;">${secao.titulo}</div>`;

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

            // Ajuste responsivo do grid
            const spanStyle = window.innerWidth < 768 ? 'grid-column: span 12;' : `grid-column: span ${campo.span};`;

            htmlCampos += `
                <div class="form-group" style="${spanStyle}">
                    <label style="display:block; text-align:center;">${campo.label}</label>
                    <div class="valor-box" style="display:flex; justify-content:center;">${htmlConteudo}</div>
                </div>`;
        });
    });

    div.innerHTML = headerPerfil + htmlCampos;
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
                    <div><strong>Data:</strong> ${window.formatarDataComDia(getVal(ev, 'DATA'))}</div>
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
                    <div><strong>Data:</strong> ${window.formatarDataComDia(getVal(res, 'DATA'))}</div>
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
    // Esconde todas as seções (adicionei cooperadores na lista)
    const secoes = ['dashboard', 'meus-dados', 'agenda-geral', 'reservas', 'cooperadores'];
    secoes.forEach(id => {
        const el = document.getElementById('sec-' + id);
        if (el) el.classList.add('hidden');
    });

    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    const alvo = document.getElementById('sec-' + telaId);
    if (alvo) alvo.classList.remove('hidden');
    if (btn) btn.classList.add('active');

    // 👇 MUDANÇA AQUI: Fecha a sidebar no celular após clicar em uma aba
    if (window.innerWidth < 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            window.toggleSidebar();
        }
    }

    // Se ele clicar em cooperadores, carrega os dados
    if (telaId === 'cooperadores' && typeof carregarDadosIniciais === 'function') {
        carregarDadosIniciais();
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
    
    // Se o overlay existe, mas está sem estilo, aplicamos o estilo e o clique nele
    if (overlay && !overlay.style.position) {
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 990;
            display: none;
            transition: opacity 0.28s ease;
            opacity: 0;
        `;
        // O pulo do gato: quando clicar fora (no fundo escuro), fecha o menu
        overlay.addEventListener('click', window.toggleSidebar);
    }

    if (isOpen) {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    } else {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 280);
    }
};

// Fechar também ao apertar o botão 'Voltar' ou a tecla 'ESC'
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            window.toggleSidebar();
        }
    }
});

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

let deferredPrompt;
const installBanner = document.getElementById('pwa-install-banner');
const btnInstall = document.getElementById('btn-pwa-install');

window.addEventListener('beforeinstallprompt', (e) => {
    // Impede o Chrome de mostrar o prompt automático
    e.preventDefault();
    // Salva o evento para ser disparado depois
    deferredPrompt = e;
    // Mostra o nosso banner personalizado
    installBanner.classList.remove('hidden');
});

if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Mostra o prompt de instalação nativo
            deferredPrompt.prompt();
            // Espera pela resposta do usuário
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`Usuário escolheu: ${outcome}`);
            // Limpa o prompt
            deferredPrompt = null;
            // Esconde o banner
            installBanner.classList.add('hidden');
        }
    });
}

function dismissInstall() {
    installBanner.classList.add('hidden');
}

// Oculta o banner se o app já estiver instalado
window.addEventListener('appinstalled', () => {
    installBanner.classList.add('hidden');
    console.log('PWA: Aplicativo instalado com sucesso!');
});

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // No Android/PC, mostra o botão de instalar
    document.getElementById('item-instalar')?.classList.remove('hidden');
});

// Detecta se é iOS para mostrar o guia manual
const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isStandalone = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIos() && !isStandalone()) {
    document.getElementById('item-instalar')?.classList.remove('hidden');
}

window.iniciarInstalacao = async () => {
    if (isIos()) {
        // Guia para iPhone
        Swal.fire({
            title: 'Instale no seu iPhone',
            html: `1. Toque no ícone de <strong>Compartilhar</strong> <span class="material-icons">ios_share</span> na barra do Safari.<br>
                   2. Selecione <strong>Adicionar à Tela de Início</strong> <span class="material-icons">add_box</span>.`,
            icon: 'info',
            confirmButtonColor: '#3b82f6'
        });
    } else if (deferredPrompt) {
        // Prompt automático para Android/PC
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('item-instalar').classList.add('hidden');
        }
        deferredPrompt = null;
    }
};

window.fecharModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
};

// Função para enviar os dados para o Backend (Utilizada pelo Cooperador)
window.enviarDados = async function(urlBase, id, payload, formId = null) {
    const url = id ? `${urlBase}/${id}` : urlBase;
    const method = id ? 'PUT' : 'POST';

    let btnSubmit = null;
    let textoOriginal = 'Salvar';

    if (formId) {
        const form = document.getElementById(formId);
        if (form) btnSubmit = form.querySelector('button[type="submit"]');
    }

    if (btnSubmit) {
        textoOriginal = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Processando...';
    }

    try {
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-token': SISTEMA.token
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || 'Falha na API');
        }

        Swal.fire({ icon: 'success', title: 'Sucesso!', timer: 1500 });
        return true;

    } catch (e) {
        console.error(e);
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message });
        return false;
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = textoOriginal;
        }
    }
};
