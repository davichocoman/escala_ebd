SISTEMA.meusDepts = [];
SISTEMA.programacoes = [];
SISTEMA.deptoAtivo = null; // Guarda o departamento que está aberto na tela

// ============================================================
// 1. CARREGAMENTO DE DADOS (READ)
// ============================================================
window.carregarDadosIniciais = async function() {
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();
    const token = SISTEMA.token || sessionStorage.getItem('token_sistema');
    
    if (['ADMIN', 'SECRETARIA'].includes(perfil)) {
        document.getElementById('btn-novo-depto')?.classList.remove('hidden');
    }

    try {
        const [resDepts, resProgs] = await Promise.all([
            fetch(`${API_BASE}/cooperador/meus-departamentos`, { headers: { 'x-token': token } }),
            fetch(`${API_BASE}/cooperador/programacoes`, { headers: { 'x-token': token } })
        ]);
        
        if (resDepts.ok && resProgs.ok) {
            SISTEMA.meusDepts = await resDepts.json();
            SISTEMA.programacoes = await resProgs.json();
            
            // --- O ATALHO MÁGICO DO LÍDER ÚNICO ---
            if (perfil === 'MEMBRO' && SISTEMA.meusDepts.length === 1) {
                abrirDepto(SISTEMA.meusDepts[0].ID);
                document.getElementById('btn-voltar-deptos')?.classList.add('hidden'); // Esconde o "Voltar"
            } else {
                voltarParaListaDeptos(); // Garante que a tela A esteja visível
                renderizarDeptos();
            }
        }
    } catch (e) {
        console.error("Erro ao carregar dados dos departamentos:", e);
    }
};

window.carregarProgramacoes = async function() {
    const token = SISTEMA.token || sessionStorage.getItem('token_sistema');
    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes`, { headers: { 'x-token': token } });
        if (res.ok) {
            SISTEMA.programacoes = await res.json();
            renderizarProgramacoesAtuais(); // Re-renderiza a aba interna
        }
    } catch (e) { console.error(e); }
};

// ============================================================
// 2. NAVEGAÇÃO MASTER-DETAIL (A MÁGICA DA TELA DUPLA)
// ============================================================
window.voltarParaListaDeptos = function() {
    SISTEMA.deptoAtivo = null;
    document.getElementById('view-detalhes-depto').classList.add('hidden');
    document.getElementById('view-lista-deptos').classList.remove('hidden');
};

window.abrirDepto = function(idDepto) {
    const depto = SISTEMA.meusDepts.find(d => d.ID == idDepto);
    if(!depto) return;

    SISTEMA.deptoAtivo = depto;

    // Muda as Telas
    document.getElementById('view-lista-deptos').classList.add('hidden');
    document.getElementById('view-detalhes-depto').classList.remove('hidden');
    document.getElementById('titulo-depto-ativo').innerText = depto.NOME;

    // Define Permissão: Ele é líder DESTE grupo?
    const souLiderAqui = checarSeSouLider(depto);

    if (souLiderAqui) {
        document.getElementById('btn-nova-prog')?.classList.remove('hidden');
    } else {
        document.getElementById('btn-nova-prog')?.classList.add('hidden');
    }

    // Carrega Aba 1 (Equipe) por padrão
    switchDeptoTab('equipe', document.getElementById('btn-tab-equipe'));
};

window.switchDeptoTab = function(tabId, btnElement) {
    document.getElementById('tab-equipe').classList.add('hidden');
    document.getElementById('tab-progs').classList.add('hidden');
    
    document.querySelectorAll('.nav-btn-cooperador').forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    document.getElementById('tab-' + tabId).classList.remove('hidden');
    
    if (tabId === 'progs') {
        renderizarProgramacoesAtuais();
    } else {
        carregarLideradosDoPainel(); // Busca a equipe no banco
    }
};

// Função Auxiliar de Permissão
function checarSeSouLider(depto) {
    if (!depto || !depto.LIDERES_CPF) return false;
    const meuCpf = String(SISTEMA.usuario.CPF);
    return String(depto.LIDERES_CPF).includes(meuCpf);
}

// ============================================================
// 3. RENDERIZAÇÃO NA TELA
// ============================================================
window.renderizarDeptos = function() {
    const container = document.getElementById('lista-deptos');
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();

    if (SISTEMA.meusDepts.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum departamento encontrado.</p>';
        return;
    }

    container.innerHTML = SISTEMA.meusDepts.map(d => `
        <div class="member-card" style="cursor:pointer;" onclick="abrirDepto('${d.ID}')">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap: 10px;">
                    <span class="material-icons" style="color:var(--accent);">account_tree</span>
                    <strong style="font-size:1.2rem;">${d.NOME}</strong>
                </div>
            </div>
            <div class="card-body">
                <p>Clique para gerenciar equipe e programações.</p>
            </div>
        </div>
    `).join('');
};

window.carregarLideradosDoPainel = async function() {
    const deptoNome = SISTEMA.deptoAtivo.NOME;
    const container = document.getElementById('lista-liderados-painel');
    container.innerHTML = '<p style="padding:10px;">Buscando membros...</p>';

    try {
        const res = await fetch(`${API_BASE}/cooperador/membros-por-departamento/${deptoNome}`, {
            headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') }
        });
        const liderados = await res.json();

        if (liderados.length === 0) {
            container.innerHTML = '<p class="empty-msg">Nenhum membro cadastrado neste departamento.</p>';
            return;
        }

        container.innerHTML = liderados.map(m => {
            const fone = String(getVal(m, 'CONTATO') || "").replace(/\D/g, "");
            const foto = recuperarFoto(m) || '../static/icons/ios/32.png';
            return `
            <div class="member-card" style="border-left: 5px solid var(--accent);">
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="${foto}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong>${getVal(m, 'NOME')}</strong><br>
                        <small>${getVal(m, 'CARGO') || 'Membro'}</small>
                    </div>
                </div>
                <div class="card-actions" style="justify-content: flex-start; gap: 10px; margin-top:10px;">
                    <a href="https://wa.me/55${fone}" target="_blank" class="btn-small btn-success" style="text-decoration:none;">
                        <span class="material-icons" style="font-size:16px;">whatsapp</span> Contato
                    </a>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="empty-msg" style="color:red;">Erro ao buscar equipe.</p>';
    }
};

window.renderizarProgramacoesAtuais = function() {
    const container = document.getElementById('lista-progs-depto');
    const depto = SISTEMA.deptoAtivo;
    if(!depto) return;

    // Filtra as programações apenas deste departamento
    let progs = SISTEMA.programacoes.filter(p => String(p.DEPT_ID) === String(depto.ID));

    // Filtro do Select (Status)
    const filtro = document.getElementById('filtro-status-prog').value;
    if (filtro === 'PENDENTE') {
        progs = progs.filter(p => p.STATUS.includes('PENDENTE') || p.STATUS.includes('ANALISE'));
    } else if (filtro !== 'TODAS') {
        progs = progs.filter(p => p.STATUS === filtro);
    }

    if (progs.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma programação encontrada para este filtro.</p>';
        return;
    }

    // Renderiza passando se o cara logado é líder ou não (para mostrar os botões certos)
    const souLider = checarSeSouLider(depto);
    container.innerHTML = progs.map(p => renderizarCardProgramacao(p, souLider)).join('');
};

window.renderizarCardProgramacao = function(prog, souLider) {
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();
    const status = getVal(prog, 'STATUS');
    
    const cores = {
        'PENDENTE_LIDER': '#f59e0b',
        'PENDENTE_SEC': '#3b82f6',
        'ANALISE_PASTOR': '#8b5cf6',
        'APROVADO': '#22c55e',
        'REPROVADO': '#ef4444'
    };

    return `
    <div class="member-card" style="border-left: 5px solid ${cores[status] || '#ccc'}">
        <div class="card-header" style="display:flex; justify-content:space-between;">
            <strong>${getVal(prog, 'TEMA_NOITE') || getVal(prog, 'TIPO')}</strong>
            <span class="badge-perfil" style="background:${cores[status]}; color:white;">${status.replace('_', ' ')}</span>
        </div>
        
        <div class="card-body">
            <div><span class="material-icons" style="font-size:16px; vertical-align:middle;">calendar_today</span> <strong>Data:</strong> ${getVal(prog, 'DATA')}</div>
            <div><strong>🎤 Pregador:</strong> ${getVal(prog, 'PREGADOR_NOITE')}</div>
            <div><strong>🎵 Cantor:</strong> ${getVal(prog, 'CANTOR_NOITE')}</div>
            
            <div class="approval-history" style="background: #f8fafc; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.85rem; border:1px solid #e2e8f0;">
                <div style="color:#1e293b;"><strong>✅ Vistos dos Líderes:</strong> ${getVal(prog, 'APROVACOES_LIDERES') || 'Nenhum...'}</div>
                ${getVal(prog, 'SECRETARIO_REVISOR') ? `<div style="color:#3b82f6; margin-top:4px;"><strong>🔍 Revisado por:</strong> ${getVal(prog, 'SECRETARIO_REVISOR')}</div>` : ''}
                ${getVal(prog, 'PASTOR_RESP') ? `<div style="color:#8b5cf6; margin-top:4px;"><strong>⏳ Atribuído ao Pr.:</strong> ${getVal(prog, 'PASTOR_RESP')}</div>` : ''}
                ${getVal(prog, 'PASTOR_APROVADOR') ? `<div style="color:#15803d; margin-top:4px;"><strong>🏆 Decisão Final:</strong> ${getVal(prog, 'PASTOR_APROVADOR')} em ${getVal(prog, 'DATA_HORA_APROVACAO')}</div>` : ''}
            </div>
        </div>

        <div class="card-actions" style="margin-top:15px; justify-content:flex-start;">
            ${gerarBotoesAcao(prog, perfil, souLider)}
        </div>
    </div>`;
};

// ============================================================
// 4. LÓGICA DE BOTÕES E PERMISSÕES
// ============================================================
function gerarBotoesAcao(prog, perfil, souLider) {
    const status = getVal(prog, 'STATUS');
    const id = getVal(prog, 'ID');
    let html = '';

    // Só mostra se for líder DESTE depto
    if (status === 'PENDENTE_LIDER' && souLider) {
        const aprovados = (getVal(prog, 'APROVACOES_LIDERES') || "").split(", ");
        if (!aprovados.includes(SISTEMA.usuario.NOME)) {
            html += `<button class="btn-small btn-success" onclick="aprovarComoLider('${id}')">✅ Dar meu Visto</button>`;
        }
    }

    if (status === 'PENDENTE_SEC' && ['SECRETARIA', 'ADMIN'].includes(perfil)) {
        html += `<button class="btn-small btn-primary" onclick="encaminharParaPastor('${id}')">🙏 Enviar ao Pastor</button>`;
    }

    if (status === 'ANALISE_PASTOR' && perfil === 'PASTOR') {
        if (getVal(prog, 'PASTOR_RESP') === SISTEMA.usuario.NOME) {
            html += `
                <button class="btn-small btn-success" onclick="decidirPastor('${id}', 'APROVADO')">✅ Aprovar</button>
                <button class="btn-small btn-danger" onclick="decidirPastor('${id}', 'REPROVADO')">❌ Reprovar</button>
            `;
        }
    }
    return html;
}

// ============================================================
// 5. AÇÕES (CADASTRO, APROVAÇÃO, ETC)
// ============================================================
window.abrirModalProg = function() {
    document.getElementById('formProg')?.reset();
    
    // Opcional: Se já estamos no departamento, bloqueia o select para o ID correto
    const select = document.getElementById('prog_dept_id');
    if (select && SISTEMA.deptoAtivo) {
        select.innerHTML = `<option value="${SISTEMA.deptoAtivo.ID}">${SISTEMA.deptoAtivo.NOME}</option>`;
    }
    
    document.getElementById('campos-consag').classList.add('hidden');
    document.getElementById('modalProg')?.classList.remove('hidden');
};

window.salvarProgramacao = async function(e) {
    e.preventDefault();
    const dataAlvo = document.getElementById('prog_data').value;
    const diffDias = Math.ceil((new Date(dataAlvo + 'T00:00:00') - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    
    if (diffDias < 15) {
        const confirm = await Swal.fire({
            title: 'Prazo Curto',
            text: 'Mínimo de 15 dias exigido. Se for correção de reprovado, prossiga.',
            icon: 'warning', showCancelButton: true, confirmButtonText: 'É correção'
        });
        if (!confirm.isConfirmed) return;
    }

    const selectDept = document.getElementById('prog_dept_id');
    const nomeDept = selectDept.options[selectDept.selectedIndex].text;

    const payload = {
        DEPT_ID: selectDept.value,
        NOME_DEPT: nomeDept,
        DATA: dataBr(dataAlvo), 
        TIPO: document.getElementById('prog_tipo').value,
        CONSAGRACAO: document.getElementById('prog_consag_sn').value,
        DIRIGENTE_CONSAG: document.getElementById('prog_consag_dir').value,
        PREGADOR_CONSAG: document.getElementById('prog_consag_pre').value,
        TEMA_NOITE: document.getElementById('prog_tema').value,
        DIRIGENTE_NOITE: document.getElementById('prog_noite_dir').value,
        PREGADOR_NOITE: document.getElementById('prog_noite_pre').value,
        CANTOR_NOITE: document.getElementById('prog_noite_can').value,
        INSTA_PREGADOR: document.getElementById('prog_insta_pre').value,
        INSTA_CANTOR: document.getElementById('prog_insta_can').value
    };

    const token = SISTEMA.token || sessionStorage.getItem('token_sistema');
    const btnSubmit = document.querySelector('#formProg button[type="submit"]');
    if(btnSubmit) btnSubmit.innerText = "Enviando...";

    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-token': token },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            Swal.fire('Sucesso', 'Programação enviada para análise.', 'success');
            fecharModal('modalProg');
            carregarProgramacoes(); // Atualiza a lista na hora
        } else {
            const err = await res.json();
            Swal.fire('Aviso', err.detail || 'Erro ao salvar.', 'warning');
        }
    } catch(e) { console.error(e); }
    if(btnSubmit) btnSubmit.innerText = "Enviar para Análise";
};

// Funções de Aprovação da cadeia
window.aprovarComoLider = async function(idProg) {
    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes/${idProg}/aprovar-lider`, {
            method: 'PUT', headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') }
        });
        if (res.ok) {
            Swal.fire('Visto Registrado!', 'Aprovação confirmada.', 'success');
            carregarProgramacoes();
        }
    } catch(e) { console.error(e); }
};

window.encaminharParaPastor = async function(idProg) {
    const pastores = SISTEMA.dados.membros.filter(m => {
        const cargo = getVal(m, 'CARGO').toUpperCase();
        const perfil = getVal(m, 'PERFIL').toUpperCase();
        const nome = getVal(m, 'NOME').toUpperCase();
        return cargo.includes('PASTOR') || perfil === 'PASTOR' || nome.startsWith('PR.');
    });
    
    const options = {};
    pastores.forEach(p => { options[getVal(p, 'NOME')] = getVal(p, 'NOME'); });

    if (Object.keys(options).length === 0) {
        Swal.fire('Aviso', 'Nenhum Pastor encontrado no cadastro.', 'warning'); return;
    }

    const { value: pastorEscolhido } = await Swal.fire({
        title: 'Escolha o Pastor', input: 'select', inputOptions: options, showCancelButton: true
    });

    if (pastorEscolhido) {
        const res = await fetch(`${API_BASE}/admin/programacoes/${idProg}/vincular-pastor`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') },
            body: JSON.stringify({ PASTOR_NOME: pastorEscolhido })
        });
        if (res.ok) {
            Swal.fire('Enviado!', `Atribuído ao ${pastorEscolhido}`, 'success');
            carregarProgramacoes();
        }
    }
};

window.decidirPastor = async function(idProg, decisao) {
    const confirm = await Swal.fire({ title: `Confirmar ${decisao}?`, icon: 'question', showCancelButton: true });
    if (confirm.isConfirmed) {
        const res = await fetch(`${API_BASE}/pastor/programacoes/${idProg}/decidir`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') },
            body: JSON.stringify({ STATUS: decisao })
        });
        if (res.ok) {
            Swal.fire('Pronto!', `Evento ${decisao}`, 'success');
            carregarProgramacoes();
        }
    }
};

window.toggleConsag = function(val) { document.getElementById('campos-consag').classList.toggle('hidden', val === 'N'); };
