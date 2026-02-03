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
// Função auxiliar para ordenar por Data e depois por Horário
function ordenarPorDataEHora(lista, chaveData, chaveHoraIni, chaveHoraFim = '') {
    lista.sort((a, b) => {
        const d1 = dataParaObj(getVal(a, chaveData));
        const d2 = dataParaObj(getVal(b, chaveData));
        if (d1 - d2 !== 0) return d1 - d2;

        const h1 = timeParaMinutos(
            getVal(a, chaveHoraIni) || getVal(a, chaveHoraFim)
        );
        const h2 = timeParaMinutos(
            getVal(b, chaveHoraIni) || getVal(b, chaveHoraFim)
        );
        return h1 - h2;
    });
}

function recuperarFoto(obj) {
    if (!obj) return '';
    
    let fotoFull = getVal(obj, 'FOTO');
    
    // Se o campo FOTO estiver vazio ou for pequeno demais, monta as fatias
    if (!fotoFull || fotoFull.length < 100) {
        const f1 = getVal(obj, 'FOTO_1');
        const f2 = getVal(obj, 'FOTO_2');
        const f3 = getVal(obj, 'FOTO_3');
        
        // Só junta se houver conteúdo real
        fotoFull = (f1 + f2 + f3).replace(/null/g, '').trim();
    }
    
    return fotoFull;
}

function timeParaMinutos(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 9999;
    const partes = timeStr.split(':');
    if (partes.length < 2) return 9999;
    return (parseInt(partes[0]) * 60) + parseInt(partes[1]);
}
//função única para decidir se um item deve aparecer
// Substitua a função eventoValido inteira por esta:
function eventoValido(item, chaveEvento, chaveData) {
    // 1. Validação de Nome (Impede cards vazios/fantasmas)
    // O getVal retorna '' se for null. O String() garante que seja texto.
    const nome = String(getVal(item, chaveEvento) || '').trim();
    
    // Se não tiver nome, ou for a string "null", retorna falso (não mostra)
    if (!nome || nome.toLowerCase() === 'null') return false;

    // 2. Validação de Data
    const dataStr = getVal(item, chaveData)?.trim();
    if (!dataStr) return false;

    const data = dataParaObj(dataStr);
    if (isNaN(data.getTime())) {
        return false;
    }

    // Filtra apenas eventos futuros ou de hoje (remove passados)
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
    
    // Chama a atualização visual inicial
    atualizarSidebar();
    
    configurarBotoes();
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
        
        // --- LOGICA DE SINCRONIZAÇÃO DA FOTO ---
        // Procuramos você na lista que acabou de vir do banco (ela já vem com a FOTO montada)
        const meuCpf = getVal(SISTEMA.usuario, 'CPF');
        const euAtualizado = SISTEMA.dados.membros.find(m => getVal(m, 'CPF') === meuCpf);
        
        if (euAtualizado) {
            // Atualiza o objeto global com a foto completa vinda da API
            SISTEMA.usuario = euAtualizado; 
            atualizarSidebar(); // Redesenha o topo com a foto nova
        }
        // ---------------------------------------

        if (resPastor.ok) SISTEMA.dados.agendaPastor = await resPastor.json();
        if (resDash.ok) SISTEMA.dados.dashboard = await resDash.json();

        renderizarCheckboxesPastores();
        renderizarMembros();
        renderizarAgendaPastor();
        renderizarDashboard();
        renderizarAgendaGeralCards(); 
        renderizarReservasCards();
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

function atualizarSidebar() {
    const nome = getVal(SISTEMA.usuario, 'NOME') ? getVal(SISTEMA.usuario, 'NOME').split(' ')[0] : 'Admin';
    const perfil = getVal(SISTEMA.usuario, 'PERFIL') || 'Admin';
    
    // Recupera a foto (tenta o campo FOTO ou junta as fatias FOTO_1, 2, 3)
    const foto = recuperarFoto(SISTEMA.usuario);
    
    let imgHtml = '';
    if (foto && foto.length > 100) {
        imgHtml = `<img src="${foto}" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border:2px solid var(--accent);">`;
    } else {
        imgHtml = `<div style="width:45px; height:45px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:white;"><span class="material-icons">person</span></div>`;
    }

    const display = document.getElementById('userDisplay');
    if (display) {
        display.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                ${imgHtml}
                <div>
                    Olá, <strong>${nome}</strong><br>
                    <small style="opacity:0.7; font-size:0.75rem;">${perfil}</small>
                </div>
            </div>`;
    }
}

function renderizarReservas() {
    const lista = SISTEMA.dados.dashboard.reservas || [];

    const validas = lista.filter(r =>
        eventoValido(r, 'ATIVIDADE', 'data')
    );

    renderizarListaCompleta(
        'lista-reservas',
        validas,
        'ATIVIDADE',
        'data',
        '#22c55e',
        true
    );
}

// ============================================================
// 4. RENDERIZAÇÃO (mantidas como cards)
// ============================================================
// 2. Renderizador do Dashboard sincronizado com o Backend
function renderizarDashboard() {
    // 1. Estatísticas
    const membros = SISTEMA.dados.membros || [];
    const stats = membros.reduce((acc, m) => {
        const p = getVal(m, 'PERFIL').toUpperCase();
        if (p === 'CONGREGADO') acc.congregados++;
        else if (p === 'MEMBRO') acc.membros++;
        else if (['ADMIN', 'SECRETARIA'].includes(p)) acc.admins++;
        else if (p == 'PASTOR') acc.pastores++;
        acc.total++; // Incrementa o total
        return acc;
    }, { total: 0, congregados: 0, membros: 0, admins: 0, pastores: 0});

    // Atualiza os elementos (Garanta que o ID 'count-total' exista no seu HTML)
    if(document.getElementById('count-total')) document.getElementById('count-total').innerText = stats.total;
    document.getElementById('count-pastores').innerText = stats.pastores;
    document.getElementById('count-membros').innerText = stats.membros;
    document.getElementById('count-congregados').innerText = stats.congregados;
    document.getElementById('count-admins').innerText = stats.admins;

    // 2. Configuração de Datas (Hoje até +7 dias)
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(); limite.setDate(hoje.getDate() + 7); limite.setHours(23,59,59);

    // --- FILTRO INTELIGENTE (O seu Escudo) ---
    const filtrarItem = (item, keyTitulo, keyData) => {
        const titulo = getVal(item, keyTitulo).trim();
        const dataStr = getVal(item, keyData).trim();
        
        // Se não tiver título ou data, ignora o card
        if (!titulo || titulo.toLowerCase() === 'null' || !dataStr) return false;

        const d = dataParaObj(dataStr);
        // Retorna apenas se estiver entre hoje e o limite de 7 dias
        return d >= hoje && d <= limite;
    };

    // --- PREENCHIMENTO DAS LISTAS (Usando o nome correto da função agora) ---

    // 1. Agenda do Pastor (Chaves MAIÚSCULAS)
    const listaPastor = (SISTEMA.dados.agendaPastor || [])
        .filter(i => filtrarItem(i, 'EVENTO', 'DATA')); // <--- CORRIGIDO
    ordenarPorDataEHora(listaPastor, 'DATA', 'HORARIO');
    preencherListaDashSimples('list-dash-pastor', listaPastor, 'EVENTO', 'DATA', '#3b82f6', 'HORARIO');

    // 2. Reservas (Chaves minúsculas do seu Backend)
    const listaRes = (SISTEMA.dados.dashboard.reservas || [])
        .filter(i => filtrarItem(i, 'evento', 'data')); // <--- CORRIGIDO
    ordenarPorDataEHora(listaRes, 'data', 'inicio');
    preencherListaDashSimples('list-dash-reservas', listaRes, 'evento', 'data', '#22c55e', 'inicio');

    // 3. Agenda Geral (Chaves minúsculas do seu Backend)
    const listaGeral = (SISTEMA.dados.dashboard.agenda || [])
        .filter(i => filtrarItem(i, 'evento', 'data')); // <--- CORRIGIDO
    ordenarPorDataEHora(listaGeral, 'data', ''); 
    preencherListaDashSimples('list-dash-igreja', listaGeral, 'evento', 'data', '#ef4444');

    // 5. Aniversariantes da Semana
    const aniversariantes = getAniversariantesProximos(SISTEMA.dados.membros);
    const elNiver = document.getElementById('dash-lista-niver');
    
    if (elNiver) {
        if (aniversariantes.length === 0) {
            elNiver.innerHTML = '<p class="empty-msg">Nenhum aniversariante nesta semana.</p>';
        } else {
            elNiver.innerHTML = aniversariantes.map(m => `
                <div class="member-card" style="padding: 10px; border-left: 4px solid #e11d48; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; color:#1e293b">${getVal(m, 'NOME')}</div>
                        <div style="font-size:0.85rem; color:#64748b">Dia ${m.diaAniversario}</div>
                    </div>
                    <span class="material-icons" style="color:#e11d48; font-size:1.2rem;">celebration</span>
                </div>
            `).join('');
        }
    }
}

// Helper para o Dashboard (Estilo que você gostou)
function preencherListaDashSimples(elementId, lista, keyTitulo, keyData, color, keyHora = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (lista.length === 0) {
        el.innerHTML = '<li class="empty-msg">Nada para os próximos dias.</li>';
        return;
    }

    el.innerHTML = lista.map(item => {
        const hora = keyHora ? getVal(item, keyHora) : '';
        return `
            <li style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 8px; list-style: none;">
                <strong style="display:block; color:#1e293b;">${getVal(item, keyTitulo)}</strong>
                <span style="font-size:0.85rem; color:#64748b;">
                    ${getVal(item, keyData)} ${hora ? '| ' + hora : ''}
                </span>
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
    container.innerHTML = filtrados.map(m => {
        const foto = getVal(m, 'FOTO');
        const avatarHtml = foto && foto.length > 20 
            ? `<img src="${foto}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.1);">`
            : `<div style="width:50px; height:50px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b;"><span class="material-icons">person</span></div>`;

        return`
        <div class="member-card">
            <div class="card-header" style="display:flex; align-items:center; gap:15px;">
                ${avatarHtml}
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
        </div>
    `}).join('');
}
function renderizarAgendaPastor() {
    const container = document.getElementById('lista-agenda-pastor');
    if (!container) return;
    
    const lista = SISTEMA.dados.agendaPastor || [];
    const filtered = lista.filter(a => eventoValido(a, 'EVENTO', 'DATA'));
    
    // USAR A NOVA ORDENAÇÃO
    ordenarPorDataEHora(filtered, 'DATA', 'HORARIO');
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
        const nomePastor = getVal(a, 'PASTOR'); // Pega o nome

        html += `
        <div class="member-card" style="border-left: 5px solid #3b82f6;">
            <div class="card-header">
                <strong>${getVal(a, 'EVENTO')}</strong>
            </div>
            <div class="card-body">
                <div><strong>Data:</strong> ${getVal(a, 'DATA')}</div>
                <div><strong>Horário:</strong> ${getVal(a, 'HORARIO')} ${getVal(a, 'HORARIO_FIM') ? '- ' + getVal(a, 'HORARIO_FIM') : ''}</div>
                
                ${nomePastor ? `<div><strong>Pastor:</strong> ${nomePastor}</div>` : ''}
                
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
function renderizarAgendaGeralCards() {
    const container = document.getElementById('lista-agenda-geral-cards');
    // Filtra apenas o que tem evento e data (minúsculos no Python)
    const dados = (SISTEMA.dados.dashboard.agenda || []).filter(ev => getVal(ev, 'evento') && getVal(ev, 'data'));
    
    ordenarPorDataEHora(dados, 'data', '');

    let html = "";
    let mesAtual = -1;

    dados.forEach(ev => {
        const d = dataParaObj(getVal(ev, 'data'));
        const m = d.getMonth() + 1;
        if (m !== mesAtual) { mesAtual = m; html += `<div class="month-header">${NOMES_MESES[m]}</div>`; }

        html += `
            <div class="member-card">
                <div class="card-header"><strong>${getVal(ev, 'evento')}</strong></div>
                <div class="card-body">
                    <div><strong>Data:</strong> ${getVal(ev, 'data')}</div>
                    <div><strong>Local:</strong> ${getVal(ev, 'local')}</div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon edit" onclick="prepararEdicaoGeral('${getVal(ev, 'id')}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarItem('${getVal(ev, 'id')}', 'agenda-geral')">🗑️</button>
                </div>
            </div>`;
    });
    container.innerHTML = html || '<p class="empty-msg">Nenhum evento cadastrado.</p>';
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
// Limpa foto
    document.getElementById('previewFoto').src = '';
    document.getElementById('previewFoto').style.display = 'none';
    document.getElementById('iconFoto').style.display = 'block';
    document.getElementById('m_foto_base64').value = '';

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
    set('m_batismo', dataIso(getVal(m, 'BATISMO')));
    set('m_perfil', getVal(m, 'PERFIL'));
    // Lógica da Foto
    const fotoBase64 = getVal(m, 'FOTO');
    const imgPreview = document.getElementById('previewFoto');
    const icon = document.getElementById('iconFoto');
    const inputHidden = document.getElementById('m_foto_base64');

    if (fotoBase64 && fotoBase64.length > 20) {
        imgPreview.src = fotoBase64;
        imgPreview.style.display = 'block';
        icon.style.display = 'none';
        inputHidden.value = fotoBase64;
    } else {
        imgPreview.src = '';
        imgPreview.style.display = 'none';
        icon.style.display = 'block';
        inputHidden.value = '';
    }
    document.getElementById('modalMembro')?.classList.remove('hidden');
};
async function salvarMembro() {
    const id = document.getElementById('m_id')?.value;
    
    // Pega a string gigante da foto
    const fotoFull = document.getElementById('m_foto_base64')?.value || '';
    
    // Define o tamanho do pedaço
    const CHUNK_SIZE = 45000;
    
    // Inicializa as variáveis
    let foto1 = "", foto2 = "", foto3 = "";

    // Só fatia se tiver conteúdo
    if (fotoFull.length > 0) {
        if (fotoFull.length > (CHUNK_SIZE * 3)) {
            Swal.fire({ icon: 'error', title: 'Foto muito grande', text: 'A foto escolhida é muito pesada mesmo após compressão. Tente outra.' });
            return;
        }
        foto1 = fotoFull.substring(0, CHUNK_SIZE);
        foto2 = fotoFull.substring(CHUNK_SIZE, CHUNK_SIZE * 2);
        foto3 = fotoFull.substring(CHUNK_SIZE * 2, CHUNK_SIZE * 3);
    }

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
        BATISMO: dataBr(document.getElementById('m_batismo')?.value.trim() || ''),
        DEPARTAMENTO: document.getElementById('m_departamento')?.value.trim() || '',
        PERFIL: document.getElementById('m_perfil')?.value || '',
        
        // Envia as fatias (vazias ou com dados)
        FOTO_1: foto1,
        FOTO_2: foto2,
        FOTO_3: foto3
    };
    // Validação básica no front
    if (!dados.NOME || !dados.CPF || !dados.NASCIMENTO || !dados.ENDERECO || !dados.CONTATO || !dados.ESTADO_CIVIL || !dados.PROFISSAO || !dados.SITUACAO_TRABALHO || !dados.DEPARTAMENTO || !dados.PERFIL ) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos obrigatórios',
            text: 'Nome, CPF, Data de Nascimento, Endereço, Contato, Estado Civil, Profissão, Situação de Trabalho, Departamento e Perfil são obrigatórios!'
        });
        return;
    }

    // Se a foto for maior que a capacidade das 3 células (aprox 135k chars)
    if (fotoFull.length > (CHUNK_SIZE * 3)) {
        Swal.fire({ icon: 'error', title: 'Foto muito grande', text: 'A foto escolhida é muito pesada mesmo após compressão. Tente outra.' });
        return;
    }
    const sucesso = await enviarDados(`${API_BASE}/membros`, id, dados, 'formMembro');
    
    if (sucesso) {
        document.getElementById('modalMembro')?.classList.add('hidden');
    }
}

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
    document.getElementById('p_hora_fim').value = getVal(a, 'HORARIO_FIM');
    document.getElementById('p_local').value = getVal(a, 'LOCAL');
    document.getElementById('p_obs').value = getVal(a, 'OBSERVACAO');
    
    // 1. Limpa todos primeiro
    const checkboxes = document.querySelectorAll('input[name="pastor_checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    // 2. Pega a string salva (ex: "Pr. João, Pr. Marcos")
    const pastoresSalvos = getVal(a, 'PASTOR'); 

    if (pastoresSalvos) {
        // 3. Marca os que estiverem na string
        checkboxes.forEach(cb => {
            // Verifica se o nome do checkbox está contido na string salva
            if (pastoresSalvos.includes(cb.value)) {
                cb.checked = true;
            }
        });
    }

    document.getElementById('modalPastor')?.classList.remove('hidden');
};
async function salvarPastor() {
    const id = document.getElementById('p_id')?.value;
    
    // 1. Coleta todos os checkboxes marcados
    const checkboxes = document.querySelectorAll('input[name="pastor_checkbox"]:checked');
    
    // 2. Transforma em um array de nomes e junta com vírgula
    // Ex: ["Pr. João", "Pr. Marcos"] vira "Pr. João, Pr. Marcos"
    const listaPastores = Array.from(checkboxes).map(cb => cb.value).join(', ');

    const dados = {
        EVENTO: document.getElementById('p_evento')?.value.trim() || '',
        DATA: dataBr(document.getElementById('p_data')?.value),
        HORARIO: document.getElementById('p_hora')?.value || '',
        HORARIO_FIM: document.getElementById('p_hora_fim')?.value || '',
        LOCAL: document.getElementById('p_local')?.value.trim() || '',
        PASTOR: listaPastores, // Manda a string combinada
        OBSERVACAO: document.getElementById('p_obs')?.value.trim() || ''
    };

    if (!dados.EVENTO || !dados.DATA || !dados.HORARIO || !dados.PASTOR) {
        Swal.fire({ 
            icon: 'warning', 
            title: 'Campos obrigatórios', 
            text: 'Selecione pelo menos um Pastor, além de Evento, Data e Horário.' 
        });
        return;
    }

    const sucesso = await enviarDados(`${API_BASE}/agenda-pastor`, id, dados, 'formPastor');
    if (sucesso) fecharModal('modalPastor');
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
// Substitua a função enviarDados inteira por esta:
async function enviarDados(urlBase, id, payload, formId = null) {
    const url = id ? `${urlBase}/${id}` : urlBase;
    const method = id ? 'PUT' : 'POST';

    // 1. Tenta achar o botão de submit específico do formulário
    let btnSubmit = null;
    let textoOriginal = 'Salvar';

    if (formId) {
        // Busca o botão dentro do formulário específico
        const form = document.getElementById(formId);
        if (form) btnSubmit = form.querySelector('button[type="submit"]');
    } else {
        // Fallback: Busca o botão do formulário visível (lógica antiga)
        btnSubmit = document.querySelector('form:not(.hidden) button[type="submit"]');
    }

    // 2. Se achou o botão, bloqueia ele
    if (btnSubmit) {
        textoOriginal = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        // Adiciona um efeito visual simples
        btnSubmit.innerHTML = '<span class="material-icons spin" style="font-size:16px; vertical-align:middle; margin-right:5px;">sync</span> Processando...';
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
            throw new Error(data.detail || 'Falha na API');
        }

        await carregarTudoDoBanco(); // Atualiza a tela

        // Sucesso
        Swal.fire({
            icon: 'success',
            title: 'Salvo com sucesso!',
            timer: 1500,
            showConfirmButton: false
        });

        return true; // Retorna true para indicar sucesso

    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: 'error',
            title: 'Erro ao salvar',
            text: e.message
        });
        return false; // Retorna false em caso de erro

    } finally {
        // 3. SEMPRE Reabilita o botão no final (seja sucesso ou erro)
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = textoOriginal;
        }
    }
}
function dataParaObj(str) {
    if (!str || typeof str !== 'string') return new Date(0);
    const p = str.split('/');
    return p.length === 3 ? new Date(p[2], p[1]-1, p[0]) : new Date(NaN);
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
// 3. Função para renderizar Reservas
function renderizarReservasCards() {
    const container = document.getElementById('lista-reservas-cards');
    const dados = SISTEMA.dados.dashboard.reservas || [];
    
    // 1. Filtra
    // O backend envia "evento" (minúsculo) na rota /patrimonio/dados
    // A função eventoValido e getVal lidam com maiúsculas/minúsculas, então 'EVENTO' funciona
    const validos = dados.filter(res => eventoValido(res, 'EVENTO', 'DATA'));
    
    // 2. Descobre qual o nome do campo de hora ('inicio' ou 'HORARIO_INICIO')
    let keyHora = 'HORARIO_INICIO';
    if(validos.length > 0) {
        if(validos[0].hasOwnProperty('inicio')) keyHora = 'inicio';
        else if(validos[0].hasOwnProperty('INICIO')) keyHora = 'INICIO';
    }

    // 3. Ordena
    ordenarPorDataEHora(validos, 'DATA', keyHora);

    if (validos.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma reserva encontrada.</p>';
        return;
    }

    let html = "";
    let mesAtual = -1;

    // 4. Loop na lista CORRETA (validos)
    validos.forEach(res => {
        const d = dataParaObj(getVal(res, 'DATA'));
        const m = d.getMonth() + 1;

        if (m !== mesAtual) {
            mesAtual = m;
            html += `<div class="month-header">${NOMES_MESES[m]}</div>`;
        }

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
                    <button class="btn-icon edit" onclick="prepararEdicaoReserva('${getVal(res, 'ID')}')">✏️</button>
                    <button class="btn-icon delete" onclick="deletarItem('${getVal(res, 'ID')}', 'reservas')">🗑️</button>
                </div>
            </div>`;
    });
    
    container.innerHTML = html;
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
    if(e) e.preventDefault(); // Garante que não recarregue a página
    
    const id = document.getElementById('ag_id').value;
    const dados = {
        DATA: dataBr(document.getElementById('ag_data').value),
        EVENTO: document.getElementById('ag_evento').value,
        LOCAL: document.getElementById('ag_local').value,
        RESPONSAVEL: document.getElementById('ag_resp').value,
        OBSERVACAO: "" 
    };

    if (!dados.DATA || !dados.EVENTO) {
        Swal.fire({ icon: 'warning', title: 'Campos obrigatórios', text: 'Data e Evento são obrigatórios.' });
        return;
    }

    // AQUI: Passamos 'formAgendaGeral'
    const sucesso = await enviarDados(`${API_BASE}/agenda-geral`, id, dados, 'formAgendaGeral');
    
    if (sucesso) {
        fecharModal('modalAgendaGeral');
    }
}
async function salvarReserva(e) {
    if(e) e.preventDefault();

    const id = document.getElementById('res_id').value;
    const dados = {
        DATA: dataBr(document.getElementById('res_data').value),
        LOCAL: document.getElementById('res_local').value,
        HORARIO_INICIO: document.getElementById('res_ini').value,
        HORARIO_FIM: document.getElementById('res_fim').value,
        ATIVIDADE: document.getElementById('res_ativ').value,
        RESPONSAVEL: document.getElementById('res_resp').value
    };

    if (!dados.DATA || !dados.HORARIO_INICIO || !dados.HORARIO_FIM || !dados.ATIVIDADE) {
        Swal.fire({ icon: 'warning', title: 'Campos obrigatórios', text: 'Preencha Data, Horários e Atividade.' });
        return;
    }

    // AQUI: Passamos 'formReserva'
    const sucesso = await enviarDados(`${API_BASE}/reservas`, id, dados, 'formReserva');
    
    if (sucesso) {
        fecharModal('modalReserva');
    }
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

function renderizarCheckboxesPastores() {
    const container = document.getElementById('container-pastores');
    if (!container) return;

    container.innerHTML = ''; // Limpa

    // 1. Filtra quem é Pastor
    const pastores = SISTEMA.dados.membros.filter(m => {
        const cargo = getVal(m, 'CARGO').toUpperCase();
        const perfil = getVal(m, 'PERFIL').toUpperCase();
        const nome = getVal(m, 'NOME').toUpperCase();
        
        return cargo.includes('PASTOR') || perfil === 'PASTOR' || nome.startsWith('PR.');
    });

    // 2. Ordena
    pastores.sort((a, b) => getVal(a, 'NOME').localeCompare(getVal(b, 'NOME')));

    if (pastores.length === 0) {
        container.innerHTML = '<span style="font-size:0.8rem; color:red;">Nenhum pastor cadastrado.</span>';
        return;
    }

    // 3. Cria os Checkboxes
    pastores.forEach(p => {
        const nome = getVal(p, 'NOME');
        
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'pastor_checkbox'; // Para facilitar a seleção depois
        checkbox.value = nome;
        
        const texto = document.createTextNode(nome);
        
        label.appendChild(checkbox);
        label.appendChild(texto);
        container.appendChild(label);
    });
}

function getAniversariantesProximos(listaMembros) {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    const limite = new Date();
    limite.setDate(hoje.getDate() + 7); // Próximos 7 dias
    
    return listaMembros.filter(m => {
        const nascRaw = getVal(m, 'NASCIMENTO');
        if (!nascRaw) return false;
        
        // Assume formato YYYY-MM-DD ou converte
        // Se seu banco salva DD/MM/YYYY, precisa tratar:
        let dia, mes;
        if (nascRaw.includes('/')) {
            [dia, mes] = nascRaw.split('/');
        } else if (nascRaw.includes('-')) {
            const parts = nascRaw.split('-');
            dia = parts[2];
            mes = parts[1];
        } else {
            return false;
        }

        // Cria data de aniversário neste ano
        const niverEsteAno = new Date(hoje.getFullYear(), parseInt(mes)-1, parseInt(dia));
        
        // Se já passou este ano, tenta ano que vem (para casos de fim de dezembro/começo de janeiro)
        if (niverEsteAno < hoje) {
            niverEsteAno.setFullYear(hoje.getFullYear() + 1);
        }

        // Verifica se está dentro do intervalo
        const estaNaSemana = niverEsteAno >= hoje && niverEsteAno <= limite;
        
        if (estaNaSemana) {
            m.diaAniversario = `${dia}/${mes}`; // Guarda pra exibir fácil
        }
        
        return estaNaSemana;
    }).sort((a,b) => {
        // Ordena por dia
        const da = a.diaAniversario.split('/').reverse().join('');
        const db = b.diaAniversario.split('/').reverse().join('');
        return da.localeCompare(db);
    });
}

// Processa a foto: Lê, Redimensiona agressivamente e Mostra Preview
function processarFoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Limite de upload inicial 5MB
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire('Arquivo muito grande', 'Escolha uma imagem menor que 5MB.', 'warning');
            input.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Podemos aumentar um pouco agora: 200px largura
                const MAX_WIDTH = 200; 
                const scale = MAX_WIDTH / img.width;
                const width = MAX_WIDTH;
                const height = img.height * scale;

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);

                // Qualidade 0.6 (60%) é um bom balanço
                let dataUrl = canvas.toDataURL('image/jpeg', 0.6);

                console.log("Tamanho Base64:", dataUrl.length);

                // Atualiza tela
                const preview = document.getElementById('previewFoto');
                const icon = document.getElementById('iconFoto');
                const hiddenInput = document.getElementById('m_foto_base64');

                if(preview) {
                    preview.src = dataUrl;
                    preview.style.display = 'block';
                }
                if(icon) icon.style.display = 'none';
                if(hiddenInput) hiddenInput.value = dataUrl;
            }
        }
        reader.readAsDataURL(file);
    }
}

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
