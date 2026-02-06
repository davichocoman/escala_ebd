const API_BASE = 'https://api-escala.onrender.com/api';
const NOMES_MESES = ["", "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

// Estado Global
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
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('usuario_sistema');
    SISTEMA.token = sessionStorage.getItem('token_sistema');

    if (!userStr || !SISTEMA.token) {
        Swal.fire({ icon: 'warning', title: 'Sessão expirada', showConfirmButton: false, timer: 2000 })
            .then(() => window.location.href = '/login');
        return;
    }

    SISTEMA.usuario = JSON.parse(userStr);

    // CHAMADA INICIAL: Mostra a foto (mesmo fatiada) logo que abre
    atualizarHeaderPastor(); 

    configurarBuscas();
    await carregarTudo();
    renderizarMeusDados();
    renderizarDashboard();
});

function recuperarFoto(obj) {
    if (!obj) return '';
    let fotoFull = getVal(obj, 'FOTO');
    // Se a foto estiver vazia ou for só um pedaço, tenta colar as fatias
    if (!fotoFull || fotoFull.length < 100) {
        const f1 = String(getVal(obj, 'FOTO_1') || '').replace('null', '');
        const f2 = String(getVal(obj, 'FOTO_2') || '').replace('null', '');
        const f3 = String(getVal(obj, 'FOTO_3') || '').replace('null', '');
        fotoFull = (f1 + f2 + f3).trim();
    }
    return fotoFull;
}

// ============================================================
// 2. FETCH DE DADOS (Busca Tudo igual Secretaria)
// ============================================================
async function carregarTudo() {
    console.log("🔄 Atualizando dados pastorais...");
    
    // Feedback visual
    ['dash-lista-pastor', 'dash-lista-geral'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '<p style="padding:10px; color:#666">Carregando...</p>';
    });

    const headers = { 
        'Content-Type': 'application/json', 
        'x-admin-token': SISTEMA.token 
    };

    try {
        const [resMembros, resPastor, resGeral] = await Promise.all([
            fetch(`${API_BASE}/membros`, { headers }),
            fetch(`${API_BASE}/agenda-pastor`, { headers }),
            fetch(`${API_BASE}/patrimonio/dados`, { headers })
        ]);

        if (resMembros.ok) {
            SISTEMA.dados.membros = await resMembros.json();
            
            // --- "UPGRADE" DO USUÁRIO PASTOR ---
            const meuCpf = getVal(SISTEMA.usuario, 'CPF');
            const euAtualizado = SISTEMA.dados.membros.find(m => getVal(m, 'CPF') === meuCpf);
            if (euAtualizado) {
                SISTEMA.usuario = euAtualizado; // Agora você tem a foto inteira da API
                atualizarHeaderPastor(); // Atualiza a sidebar com a foto perfeita
                renderizarMeusDados();   // Atualiza a aba Meus Dados com a foto perfeita
            }
        }

        if (resPastor.ok) SISTEMA.dados.agendaPastor = await resPastor.json();
        if (resGeral.ok) SISTEMA.dados.dashboard = await resGeral.json();

        console.log("✅ Dados Pastorais Carregados");
        
        // Atualiza as telas
        renderizarDashboard();
        renderizarMinhaAgenda();
        renderizarAgendaGeral();
        renderizarReservas();
        renderizarMembros();

    } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Falha ao carregar dados do servidor.', 'error');
    }
}

function atualizarHeaderPastor() {
    const nome = getVal(SISTEMA.usuario, 'NOME').split(' ')[0];
    const foto = recuperarFoto(SISTEMA.usuario);
    const imgHtml = foto.length > 100 
        ? `<img src="${foto}" style="width:45px; height:45px; border-radius:50%; object-fit:cover; border:2px solid #fff;">`
        : `<div style="width:45px; height:45px; border-radius:50%; background:#334155; display:flex; align-items:center; justify-content:center; color:white;"><span class="material-icons">person</span></div>`;

    document.getElementById('userDisplay').innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            ${imgHtml}
            <div>Olá, Pr. <strong>${nome}</strong></div>
        </div>`;
}

// Remove tudo que não é número para criar o link
function gerarLinkZap(numero) {
    if (!numero) return '';
    // Remove ( ) - e espaços
    const limpo = numero.toString().replace(/\D/g, '');
    
    // Adiciona o código do país (55) se não tiver
    // Verifica se tem DDD (assumindo números com 10 ou 11 dígitos)
    const numeroFinal = limpo.length <= 11 ? `55${limpo}` : limpo;
    
    return `https://wa.me/${numeroFinal}`;
}
// ============================================================
// 3. RENDERIZAÇÃO
// ============================================================

function renderizarDashboard() {
    // 1. Estatísticas de Membros
    const stats = SISTEMA.dados.membros.reduce((acc, m) => {
        const p = getVal(m, 'PERFIL').toUpperCase();
        if (p === 'CONGREGADO') acc.congregados++;
        else if (p === 'MEMBRO') acc.membros++;
        else if (['ADMIN', 'SECRETARIA', 'PASTOR'].includes(p)) acc.admins++;
        return acc;
    }, { congregados: 0, membros: 0, admins: 0 });

    document.getElementById('count-membros').innerText = stats.membros;
    document.getElementById('count-congregados').innerText = stats.congregados;
    document.getElementById('count-admins').innerText = stats.admins;

    // 2. Filtro de 7 Dias
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const limite = new Date(); limite.setDate(hoje.getDate() + 7); limite.setHours(23,59,59);

    const filtroSemana = (item, chaveData) => {
        if (!eventoValido(item, 'ignore', chaveData)) return false; 
        const d = dataParaObj(getVal(item, chaveData));
        return d >= hoje && d <= limite;
    };

    const nomeLogado = getVal(SISTEMA.usuario, 'NOME');

    // 3. Minha Agenda (Resumida + Filtrada + Ordenada)
    const minhaLista = SISTEMA.dados.agendaPastor || [];
    const minhaSemana = minhaLista
        .filter(i => {
            const naSemana = filtroSemana(i, 'DATA');
            const souEu = getVal(i, 'PASTOR').includes(nomeLogado); 
            return naSemana && souEu;
        });
    
    ordenarPorDataEHora(minhaSemana, 'DATA', 'HORARIO');
    renderizarListaSimples('dash-lista-pastor', minhaSemana, 'EVENTO', 'DATA', '#3b82f6', 'HORARIO');

    // 4. Agenda Geral (Resumida + Ordenada)
    const geralLista = SISTEMA.dados.dashboard.agenda || [];
    const geralSemana = geralLista
        .filter(i => filtroSemana(i, 'DATA') && getVal(i, 'EVENTO'));

    ordenarPorDataEHora(geralSemana, 'DATA', 'HORARIO'); 
    renderizarListaSimples('dash-lista-geral', geralSemana, 'EVENTO', 'DATA', '#b91c1c');

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
// Helper para listas do dashboard
function renderizarListaSimples(elementId, lista, keyTitulo, keyData, color, keyHora = '') {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (lista.length === 0) {
        el.innerHTML = '<p class="empty-msg">Nada agendado para os próximos dias.</p>';
        return;
    }

    el.innerHTML = lista.map(item => `
        <div class="member-card" style="padding: 10px; border-left: 4px solid ${color}; margin-bottom: 10px;">
            <div style="font-weight:bold; color:#1e293b">${getVal(item, keyTitulo)}</div>
            <div style="font-size:0.85rem; color:#64748b">
                ${getVal(item, keyData)} ${keyHora ? '| ' + getVal(item, keyHora) : ''}
            </div>
            ${getVal(item, 'LOCAL') ? `<div style="font-size:0.8rem; color:#94a3b8">${getVal(item, 'LOCAL')}</div>` : ''}
        </div>
    `).join('');
}

// --- Telas Completas ---

function renderizarMinhaAgenda() {
    const nomeLogado = getVal(SISTEMA.usuario, 'NOME');
    const listaCompleta = SISTEMA.dados.agendaPastor || [];
    
    // Data de corte (Hoje 00:00:00)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Filtra: (Sou o pastor) E (Data é Hoje ou Futuro)
    const meusEventos = listaCompleta.filter(i => {
        const souEu = getVal(i, 'PASTOR').includes(nomeLogado);
        
        // Verifica se é data válida e futura
        const dataStr = getVal(i, 'DATA');
        if (!dataStr) return false;
        const dataEvento = dataParaObj(dataStr);
        
        return souEu && (dataEvento >= hoje);
    });

    // Usa a nova ordenação (Dia + Hora)
    ordenarPorDataEHora(meusEventos, 'DATA', 'HORARIO');

    renderizarListaCompleta('lista-minha-agenda', meusEventos, 'EVENTO', 'DATA', '#3b82f6', true);
}

function renderizarAgendaGeral() {
    const termo = document.getElementById('buscaAgendaGeral')?.value.toLowerCase() || '';
    const lista = (SISTEMA.dados.dashboard.agenda || []).filter(ev => {
        if(!eventoValido(ev, 'EVENTO', 'DATA')) return false;
        return getVal(ev, 'EVENTO').toLowerCase().includes(termo) || 
               getVal(ev, 'LOCAL').toLowerCase().includes(termo);
    });
    renderizarListaCompleta('lista-agenda-geral', lista, 'EVENTO', 'DATA', '#ef4444', false);
}

function renderizarReservas() {
    const lista = SISTEMA.dados.dashboard.reservas || [];
    // Filtro para garantir que tem evento e data
    const validas = lista.filter(r => eventoValido(r, 'EVENTO', 'DATA')); 
    renderizarListaCompleta('lista-reservas', validas, 'EVENTO', 'DATA', '#22c55e', true);
}

// Função genérica para renderizar cards largos com mês (igual secretaria/membro)
function renderizarListaCompleta(elementId, dados, keyTitulo, keyData, corBorda, mostrarHora) {
    const container = document.getElementById(elementId);
    if (!container) return;

    let keyHora = 'HORARIO'; 
    if (dados.length > 0 && (dados[0].hasOwnProperty('inicio') || dados[0].hasOwnProperty('HORARIO_INICIO'))) {
        keyHora = dados[0].hasOwnProperty('inicio') ? 'inicio' : 'HORARIO_INICIO';
    }

    ordenarPorDataEHora(dados, keyData, keyHora);

    if (dados.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum registro encontrado.</p>';
        return;
    }

    let html = "";
    let mesAtual = -1;

    dados.forEach(item => {
        const d = dataParaObj(getVal(item, keyData));
        const m = d.getMonth() + 1;

        if (m !== mesAtual) {
            mesAtual = m;
            html += `<div class="month-header">${NOMES_MESES[m]}</div>`;
        }

        let horarioHtml = '';
        if (mostrarHora) {
            const ini = getVal(item, 'HORARIO') || getVal(item, 'HORARIO_INICIO') || getVal(item, 'inicio');
            const fim = getVal(item, 'HORARIO_FIM') || getVal(item, 'fim');
            if (ini) horarioHtml = `<div><strong>Horário:</strong> ${ini} ${fim ? '- ' + fim : ''}</div>`;
        }

        // Tenta pegar o campo PASTOR ou RESPONSAVEL
        const pastores = getVal(item, 'PASTOR');
        const responsavel = getVal(item, 'RESPONSAVEL');

        html += `
            <div class="member-card" style="border-left: 5px solid ${corBorda};">
                <div style="font-weight:bold; font-size:1.1rem; margin-bottom:5px;">${getVal(item, keyTitulo)}</div>
                <div style="font-size:0.95rem; color:#475569; display:grid; gap:2px;">
                    <div><strong>Data:</strong> ${getVal(item, keyData)}</div>
                    ${horarioHtml}
                    <div><strong>Local:</strong> ${getVal(item, 'LOCAL')}</div>
                    
                    ${pastores ? `<div style="color:#2563eb;"><strong>Pastor(es) Responsável(eis):</strong> ${pastores}</div>` : ''}
                    ${responsavel ? `<div><strong>Resp:</strong> ${responsavel}</div>` : ''}
                    
                    ${getVal(item, 'OBSERVACAO') ? `<div><strong>Obs:</strong> ${getVal(item, 'OBSERVACAO')}</div>` : ''}
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function renderizarMembros() {
    const container = document.getElementById('lista-membros');
    const busca = document.getElementById('buscaMembro')?.value.toLowerCase() || '';
    
    const filtrados = SISTEMA.dados.membros.filter(m => 
        getVal(m, 'NOME').toLowerCase().includes(busca)
    );

    if (filtrados.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum membro encontrado.</p>';
        return;
    }

    container.innerHTML = filtrados.map(m => {
        const contato = getVal(m, 'CONTATO');
        const linkZap = gerarLinkZap(contato);
        const endereco = getVal(m, 'ENDERECO');
        const linkMaps = endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : '#';
        
        // --- LÓGICA DA FOTO ---
        const foto = getVal(m, 'FOTO');
        const avatarHtml = foto && foto.length > 20 
            ? `<img src="${foto}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.1);">`
            : `<div style="width:50px; height:50px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; color:#64748b; font-weight:bold; border:2px solid #fff;">${getVal(m, 'NOME').charAt(0)}</div>`;
        // ----------------------

        return `
        <div class="member-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                
                <div style="display:flex; align-items:center; gap:10px;">
                    ${avatarHtml}
                    <div style="display:flex; flex-direction:column;">
                        <strong style="font-size:1.1rem; color:#1e293b;">${getVal(m, 'NOME')}</strong>
                        <span class="badge-perfil" style="align-self:flex-start; font-size:0.75rem;">${getVal(m, 'PERFIL') || 'MEMBRO'}</span>
                    </div>
                </div>

            </div>
            
            <div style="color:#64748b; font-size:0.95rem; display:flex; flex-direction:column; gap:8px; margin-left: 60px;"> <div style="display:flex; align-items:center; gap:8px;">
                    <span class="material-icons" style="font-size:1.2rem; color:#64748b;">smartphone</span>
                    <span style="flex:1;">${contato || 'Sem contato'}</span>
                    ${contato ? `
                        <a href="${linkZap}" target="_blank" style="text-decoration:none;">
                            <button style="background:#25D366; border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                                <span class="material-icons" style="color:white; font-size:16px;">send</span>
                            </button>
                        </a>
                    ` : ''}
                </div>

                <div style="display:flex; align-items:start; gap:8px;">
                    <span class="material-icons" style="font-size:1.2rem; color:#64748b; margin-top:2px;">location_on</span>
                    <span style="flex:1; line-height:1.4;">${endereco || 'Endereço não informado'}</span>
                    ${endereco ? `
                        <div style="display:flex; gap:5px;">
                            <button onclick="copiarEndereco('${endereco.replace(/'/g, "\\'")}')" style="background:#e2e8f0; border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                                <span class="material-icons" style="color:#475569; font-size:14px;">content_copy</span>
                            </button>
                            <a href="${linkMaps}" target="_blank">
                                <button style="background:#3b82f6; border:none; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                                    <span class="material-icons" style="color:white; font-size:14px;">map</span>
                                </button>
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `}).join('');
}

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
            <span style="color:#64748b; font-size:0.9rem; margin-bottom:15px;">${getVal(SISTEMA.usuario, 'CARGO') || 'Membro'}</span>
            
            <button onclick="ativarNotificacoes()" id="btn-push" style="display:flex; align-items:center; gap:8px; background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:0.85rem; font-weight:600; transition:0.2s;">
                <span class="material-icons" style="font-size:1.1rem;">notifications_active</span>
                Ativar Avisos no Celular
            </button>
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
// 4. UTILITÁRIOS
// ============================================================
// Função para converter a chave VAPID pública (necessário para o navegador)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}

async function ativarNotificacoes() {
    const btn = document.getElementById('btn-push');
    
    if (!('serviceWorker' in navigator)) {
        Swal.fire('Erro', 'Service Worker não encontrado!', 'error');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            Swal.fire('Atenção', 'Você precisa permitir as notificações.', 'warning');
            return;
        }

        btn.innerHTML = '<span class="material-icons spin">sync</span> Verificando SW...';
        btn.disabled = true;

        // Garante que o SW está pronto com um timeout de 10 segundos
        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('SW Timeout')), 10000))
        ]);

        btn.innerHTML = '<span class="material-icons spin">sync</span> Gerando Assinatura...';

        // Verifica se já existe assinatura para não criar duplicado
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BAgPehTm8ZhgYy0mKvcgF-HefK4xwvbn-Cz1OGeQlbZtLsRJi4PnnmmiHrtYF_1FX5ty9KElHMD5AJ_tGM1Eiks')
            });
        }

        btn.innerHTML = '<span class="material-icons spin">sync</span> Salvando no Servidor...';

        const res = await fetch(`${API_BASE}/push/subscribe`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': SISTEMA.token 
            },
            body: JSON.stringify({ 
                cpf: getVal(SISTEMA.usuario, 'CPF'), 
                data: subscription 
            })
        });

        if (res.ok) {
            Swal.fire({ icon: 'success', title: 'Pronto!', text: 'Notificações ativadas.', timer: 2000, showConfirmButton: false });
            btn.innerHTML = '<span class="material-icons">check_circle</span> Ativado';
            btn.style.background = '#dcfce7';
        } else {
            throw new Error('Erro no servidor');
        }

    } catch (error) {
        console.error("Erro no Push:", error);
        Swal.fire('Erro', 'Falha na configuração. Tente recarregar a página.', 'error');
        btn.innerHTML = '<span class="material-icons">notifications_active</span> Tentar Novamente';
        btn.disabled = false;
    }
}
function configurarBuscas() {
    const buscaGeral = document.getElementById('buscaAgendaGeral');
    const buscaMembro = document.getElementById('buscaMembro');

    if(buscaGeral) buscaGeral.addEventListener('input', debounce(() => renderizarAgendaGeral(), 300));
    if(buscaMembro) buscaMembro.addEventListener('input', debounce(() => renderizarMembros(), 300));
}

function eventoValido(item, keyTitulo, keyData) {
    // Mesma validação: ignora nulls e datas inválidas
    const dataStr = getVal(item, keyData);
    if (!dataStr) return false;
    const d = dataParaObj(dataStr);
    if (isNaN(d.getTime())) return false;
    
    if (keyTitulo !== 'ignore') {
        const titulo = getVal(item, keyTitulo);
        if (!titulo || titulo === 'null') return false;
    }
    
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    return d >= hoje;
}

function mostrarTela(telaId, btn) {
    ['dashboard', 'minha-agenda', 'agenda-geral', 'reservas', 'membros', 'meus-dados'].forEach(id => {
        document.getElementById('sec-' + id).classList.add('hidden');
    });
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById('sec-' + telaId).classList.remove('hidden');
    if(btn) btn.classList.add('active');

    if(window.innerWidth < 768) toggleSidebar();
}

// Helpers Comuns (GetVal, Debounce, Dates, SidebarToggle, Logout)
// Copiar exatamente as mesmas funções do painel-secretaria.js ou painel-membro.js
function getVal(obj, k) { if(!obj) return ''; const u=k.toUpperCase(); for(let i in obj) if(i.toUpperCase()===u) return obj[i]||''; return ''; }
function dataParaObj(s) { if(!s) return new Date(0); const p=s.split('/'); return p.length===3?new Date(p[2],p[1]-1,p[0]):new Date(0); }
function debounce(f,w) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>f.apply(this,a),w); }; }
function toggleSidebar(){ const s=document.querySelector('.sidebar'); if(s) s.classList.toggle('open'); }
function logout(){ sessionStorage.clear(); window.location.href='/login'; }

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

// Função para copiar texto para a área de transferência
window.copiarEndereco = function(endereco) {
    if (!endereco || endereco === 'undefined') return;
    
    navigator.clipboard.writeText(endereco).then(() => {
        // Feedback visual tipo "Toast" (notificação rápida)
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: false,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });

        Toast.fire({
            icon: 'success',
            title: 'Endereço copiado!'
        });
    }).catch(err => {
        console.error('Erro ao copiar: ', err);
    });
};


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

// Função auxiliar para ordenar por Data e depois por Horário
function ordenarPorDataEHora(lista, chaveData, chaveHora) {
    lista.sort((a, b) => {
        // 1. Compara Datas
        const d1 = dataParaObj(getVal(a, chaveData));
        const d2 = dataParaObj(getVal(b, chaveData));
        
        if (d1 < d2) return -1;
        if (d1 > d2) return 1;

        // 2. Se as datas forem iguais, compara Horários
        // Converte "19:30" para minutos (19*60 + 30 = 1170) para comparar
        const h1 = timeParaMinutos(getVal(a, chaveHora));
        const h2 = timeParaMinutos(getVal(b, chaveHora));

        return h1 - h2;
    });
}

// Converte "HH:MM" para inteiros (minutos do dia) para facilitar a ordenação
function timeParaMinutos(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 9999; // Joga pro final se não tiver hora
    const partes = timeStr.split(':');
    if (partes.length < 2) return 9999;
    
    return (parseInt(partes[0]) * 60) + parseInt(partes[1]);
}


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
