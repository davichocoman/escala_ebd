SISTEMA.meusDepts = [];
SISTEMA.programacoes = [];
SISTEMA.deptoAtivo = null;
SISTEMA.equipeAtual = []; // Guarda a equipe baixada para a barra de pesquisa funcionar

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
            
            // LÓGICA: Se for MEMBRO (Líder comum) e só tiver 1 departamento, já pula pra Tela Interna!
            if (perfil === 'MEMBRO' && SISTEMA.meusDepts.length === 1) {
                abrirDepto(SISTEMA.meusDepts[0].ID);
                document.getElementById('btn-voltar-deptos')?.classList.add('hidden'); // Esconde o "Voltar"
            } else {
                voltarParaListaDeptos(); 
                renderizarDeptos();
            }

            renderizarPendentesGeral(); // Atualiza a aba de Pendentes caso ela seja clicada
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
            if(SISTEMA.deptoAtivo) renderizarProgramacoesAtuais(); // Atualiza a aba interna
            renderizarPendentesGeral(); // Atualiza a aba geral
        }
    } catch (e) { console.error(e); }
};

// ============================================================
// LÓGICA DAS ABAS GERAIS (DEPARTAMENTOS vs PENDENTES)
// ============================================================
window.switchCooperadorMainTab = function(tabId, btnElement) {
    document.getElementById('main-tab-deptos').classList.add('hidden');
    document.getElementById('main-tab-pendentes').classList.add('hidden');
    
    document.getElementById('btn-main-deptos').classList.remove('active');
    document.getElementById('btn-main-pendentes').classList.remove('active');

    document.getElementById('main-tab-' + tabId).classList.remove('hidden');
    if (btnElement) btnElement.classList.add('active');

    if (tabId === 'pendentes') renderizarPendentesGeral();
};

window.renderizarPendentesGeral = function() {
    const container = document.getElementById('lista-pendentes-geral');
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();
    const meuNome = SISTEMA.usuario.NOME;
    const meuCpf = String(SISTEMA.usuario.CPF).replace(/\D/g, '');

    let pendentes = SISTEMA.programacoes.filter(prog => {
        const status = getVal(prog, 'STATUS');
        
        // 1. Líder tem que aprovar a do próprio departamento
        if (status === 'PENDENTE_LIDER') {
            const depto = SISTEMA.meusDepts.find(d => d.ID == prog.DEPT_ID);
            const souLiderAqui = depto && String(depto.LIDERES_CPF).replace(/\D/g, '').includes(meuCpf);
            const aprovados = (getVal(prog, 'APROVACOES_LIDERES') || "").split(", ");
            if (souLiderAqui && !aprovados.includes(meuNome)) return true;
        }

        // 2. Secretaria aprova as que chegaram pra ela
        if (status === 'PENDENTE_SEC' && ['SECRETARIA', 'ADMIN'].includes(perfil)) return true;

        // 3. Pastor aprova as que foram despachadas pra ele
        if (status === 'ANALISE_PASTOR' && perfil === 'PASTOR') {
            if (getVal(prog, 'PASTOR_RESP') === meuNome) return true;
        }

        return false;
    });

    if (pendentes.length === 0) {
        container.innerHTML = '<div class="empty-msg">Ufa! Nenhuma programação exigindo sua ação agora. 🎉</div>';
        return;
    }

    container.innerHTML = pendentes.map(p => {
        const depto = SISTEMA.meusDepts.find(d => d.ID == p.DEPT_ID);
        const souLider = depto && String(depto.LIDERES_CPF).replace(/\D/g, '').includes(meuCpf);
        return renderizarCardProgramacao(p, souLider);
    }).join('');
};

// ============================================================
// NAVEGAÇÃO INTERNA DO DEPARTAMENTO (MASTER / DETAIL)
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

    document.getElementById('view-lista-deptos').classList.add('hidden');
    document.getElementById('view-detalhes-depto').classList.remove('hidden');
    document.getElementById('titulo-depto-ativo').innerText = depto.NOME;

    // Limpa a barra de pesquisa ao trocar de departamento
    const buscaEquipe = document.getElementById('buscaEquipe');
    if (buscaEquipe) buscaEquipe.value = '';

    const meuCpf = String(SISTEMA.usuario.CPF).replace(/\D/g, '');
    const souLiderAqui = String(depto.LIDERES_CPF).replace(/\D/g, '').includes(meuCpf);

    if (souLiderAqui) document.getElementById('btn-nova-prog')?.classList.remove('hidden');
    else document.getElementById('btn-nova-prog')?.classList.add('hidden');

    switchDeptoTab('equipe', document.getElementById('btn-tab-equipe'));
};

window.switchDeptoTab = function(tabId, btnElement) {
    document.getElementById('tab-equipe').classList.add('hidden');
    document.getElementById('tab-progs').classList.add('hidden');
    
    document.getElementById('btn-tab-equipe').classList.remove('active');
    document.getElementById('btn-tab-progs').classList.remove('active');
    if (btnElement) btnElement.classList.add('active');

    // Troca a cor dos botões internos
    document.getElementById('btn-tab-equipe').style.background = tabId === 'equipe' ? 'var(--accent)' : '#e2e8f0';
    document.getElementById('btn-tab-equipe').style.color = tabId === 'equipe' ? 'white' : '#333';
    document.getElementById('btn-tab-progs').style.background = tabId === 'progs' ? 'var(--accent)' : '#e2e8f0';
    document.getElementById('btn-tab-progs').style.color = tabId === 'progs' ? 'white' : '#333';

    document.getElementById('tab-' + tabId).classList.remove('hidden');
    
    if (tabId === 'progs') renderizarProgramacoesAtuais();
    else carregarLideradosDoPainel();
};

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
                
                ${['SECRETARIA', 'ADMIN'].includes(perfil) ? `
                    <div style="display:flex; gap: 8px;">
                        <button class="btn-icon edit" onclick="event.stopPropagation(); abrirModalDepto('${d.ID}')">✏️</button>
                        <button class="btn-icon delete" onclick="event.stopPropagation(); excluirDepto('${d.ID}')">🗑️</button>
                    </div>
                ` : ''}
            </div>
            <div class="card-body">
                <p>Clique para ver as estatísticas, a equipe e as programações.</p>
            </div>
        </div>
    `).join('');
};

// ============================================================
// INTELIGÊNCIA DA EQUIPE (Contagem e Mapa Restaurado)
// ============================================================
window.carregarLideradosDoPainel = async function() {
    const depto = SISTEMA.deptoAtivo;
    const container = document.getElementById('lista-liderados-painel');
    container.innerHTML = '<p style="padding:10px;">Buscando equipe...</p>';

    try {
        const res = await fetch(`${API_BASE}/cooperador/membros-por-departamento/${depto.NOME}`, {
            headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') }
        });
        
        // Recebe os dados já filtrados e mastigados pelo Backend!
        SISTEMA.equipeAtual = await res.json();
        
        let nomesLideres = [];
        let qtdLideres = 0;
        let qtdComponents = 0;

        // Faz a contagem usando a marcação que o Backend mandou
        SISTEMA.equipeAtual.forEach(m => {
            if (m.isLider) {
                qtdLideres++;
                // Pega só o primeiro nome do líder para não quebrar o layout
                nomesLideres.push(getVal(m, 'NOME').split(' ')[0]); 
            } else {
                qtdComponents++;
            }
        });

        // Ordena: Líderes primeiro, depois alfabético
        SISTEMA.equipeAtual.sort((a, b) => {
            if (a.isLider && !b.isLider) return -1;
            if (!a.isLider && b.isLider) return 1;
            return getVal(a, 'NOME').localeCompare(getVal(b, 'NOME'));
        });

        // Atualiza os números no card do topo (Não tem duplicata no Total)
        document.getElementById('nomes-lideres-depto').innerText = nomesLideres.length > 0 ? nomesLideres.join(', ') : 'Nenhum cadastrado';
        document.getElementById('qtd-lideres').innerText = qtdLideres;
        document.getElementById('qtd-componentes').innerText = qtdComponents;
        document.getElementById('qtd-total').innerText = SISTEMA.equipeAtual.length;

        // Manda desenhar os cards!
        renderizarEquipeHTML(SISTEMA.equipeAtual);

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="empty-msg" style="color:red;">Erro ao buscar equipe.</p>';
    }
};

window.filtrarEquipe = function() {
    const termo = document.getElementById('buscaEquipe').value.toLowerCase();
    const filtrados = SISTEMA.equipeAtual.filter(m => getVal(m, 'NOME').toLowerCase().includes(termo));
    renderizarEquipeHTML(filtrados);
};

window.renderizarEquipeHTML = function(lista) {
    const container = document.getElementById('lista-liderados-painel');
    if (lista.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhum membro encontrado.</p>';
        return;
    }

    container.innerHTML = lista.map(m => {
        const fone = String(getVal(m, 'CONTATO') || "").replace(/\D/g, "");
        const endereco = getVal(m, 'ENDERECO') || "";
        const linkMaps = endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : '#';
        const foto = recuperarFoto(m) || '../static/icons/ios/32.png';

        const pai = String(getVal(m, 'PAI') || "");
        const mae = String(getVal(m, 'MAE') || "");

        let pais = "Não informado";

        if(pai && mae){
            pais = `${pai} / ${mae}`;
        } else if(pai){
            pais = pai;
        } else if(mae){
            pais = mae;
        }
        
        // Se for líder, bota uma borda dourada/amarela, se for componente azul
        const bordaCor = m.isLider ? '#f59e0b' : 'var(--accent)';
        const tagLider = m.isLider ? `<span style="background:#fef3c7; color:#d97706; padding:2px 6px; border-radius:10px; font-size:0.7rem; font-weight:bold;">LÍDER</span>` : '';

        return `
        <div class="member-card" style="border-left: 5px solid ${bordaCor}; padding: 15px;">
            <div style="display:flex; align-items:center; gap:15px;">
                <img src="${foto}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                <div>
                    <strong>${getVal(m, 'NOME')}</strong> ${tagLider}<br>
                </div>
            </div>

            <div style="margin-top:10px; font-size:0.85rem; color:#64748b;">
                <p><b>🛠 Funções:</b></p>
                <small style="color: #64748b;">${getVal(m, 'CARGO') || 'Membro'}</small>
            </div>

            <div style="margin-top:10px; font-size:0.85rem; color:#475569;">
                <p><b>👨‍👩‍👧‍👦 Filiação:</b> ${pais}</p>
            </div>

            <div style="margin-top:10px; font-size:0.85rem; color:#475569;">
                <p><b>💍 Estado Civil:</b> ${getVal(m, 'ESTADO_CIVIL') || "Não informado"}</p>
            </div>
            
            <div style="margin-top:10px; font-size:0.85rem; color:#475569;">
                <p><b>📍 Endereço:</b> ${endereco || 'Não informado'}</p>
            </div>

            <div class="card-actions" style="justify-content: flex-start; gap: 10px; margin-top:10px; border-top: none; padding-top: 5px;">
                <a href="https://wa.me/55${fone}" target="_blank" class="btn-small btn-success" style="text-decoration:none;">
                    <span class="material-icons" style="font-size:16px; vertical-align:middle;">whatsapp</span> Zap
                </a>
                ${endereco ? `
                <a href="${linkMaps}" target="_blank" class="btn-small btn-primary" style="text-decoration:none;">
                    <span class="material-icons" style="font-size:16px; vertical-align:middle;">map</span> Mapa
                </a>` : ''}
            </div>
        </div>`;
    }).join('');
};

// ============================================================
// LÓGICA DE PROGRAMAÇÕES
// ============================================================
window.renderizarProgramacoesAtuais = function() {
    const container = document.getElementById('lista-progs-depto');
    const depto = SISTEMA.deptoAtivo;
    if(!depto) return;

    let progs = SISTEMA.programacoes.filter(p => String(p.DEPT_ID) === String(depto.ID));

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

    const meuCpf = String(SISTEMA.usuario.CPF).replace(/\D/g, '');
    const souLider = String(depto.LIDERES_CPF).replace(/\D/g, '').includes(meuCpf);
    
    container.innerHTML = progs.map(p => renderizarCardProgramacao(p, souLider)).join('');
};

function formatarDataComDia(dataString) {
  if (!dataString) return "";
  
  // Converte a string (ex: "25/12/2023") para um objeto Date
  const partes = dataString.split('/');
  const data = new Date(partes[2], partes[1] - 1, partes[0]);
  
  // Opções para formatar o dia da semana em português
  const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
  
  // Retorna "Sexta-feira, 25/12/2023" (com a primeira letra maiúscula)
  return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1) + ", " + dataString;
}


window.renderizarCardProgramacao = function(prog, souLider) {
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();
    const status = getVal(prog, 'STATUS');
    
    const cores = {
        'PENDENTE_LIDER': '#f59e0b', 'PENDENTE_SEC': '#3b82f6',
        'ANALISE_PASTOR': '#8b5cf6', 'APROVADO': '#22c55e', 'REPROVADO': '#ef4444'
    };

    return `
    <div class="member-card" style="border-left: 5px solid ${cores[status] || '#ccc'}">
        <div class="card-header" style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:5px;">
            <strong>${getVal(prog, 'TEMA_NOITE') || getVal(prog, 'TIPO')}</strong>
            <span class="badge-perfil" style="background:${cores[status]}; color:white;">${status.replace('_', ' ')}</span>
        </div>
        
        <div class="card-body">
            <div>
              <span class="material-icons" style="font-size:16px; vertical-align:middle;">calendar_today</span> 
              <strong>Data do Culto:</strong> ${formatarDataComDia(getVal(prog, 'DATA'))}
            </div>
            
            <div><strong>🎤 Pregador:</strong> ${getVal(prog, 'PREGADOR_NOITE')}</div>
            <div>
              <strong>
                <a href="https://www.instagram.com{getVal(prog, 'INSTA_PREGADOR')}/" target="_blank" rel="noopener noreferrer">
                  📸 Instagram Pregador
                </a>
              </strong>
            </div>
            
            <div><strong>🎵 Cantor:</strong> ${getVal(prog, 'CANTOR_NOITE')}</div>
            <div>
              <strong>
                <a href="https://www.instagram.com{getVal(prog, 'INSTA_CANTOR')}/" target="_blank" rel="noopener noreferrer">
                  📸 Instagram Cantor
                </a>
              </strong>
            </div>

            
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

function gerarBotoesAcao(prog, perfil, souLider) {
    const status = getVal(prog, 'STATUS');
    const id = getVal(prog, 'ID');
    let html = '';

    if (status === 'PENDENTE_LIDER' && souLider) {
        const aprovados = (getVal(prog, 'APROVACOES_LIDERES') || "").split(", ");
        if (!aprovados.includes(SISTEMA.usuario.NOME)) {
            html += `<button class="btn-small btn-success" onclick="aprovarComoLider('${id}')">✅ Dar meu Visto</button>`;
        }
    }
    if (status === 'PENDENTE_SEC' && ['SECRETARIA', 'ADMIN'].includes(perfil)) {
        html += `<button class="btn-small btn-primary" onclick="encaminharParaPastor('${id}')">🙏 Enviar ao Pastor</button>`;
    }
    if (status === 'ANALISE_PASTOR' && perfil === 'PASTOR' && getVal(prog, 'PASTOR_RESP') === SISTEMA.usuario.NOME) {
        html += `
            <button class="btn-small btn-success" onclick="decidirPastor('${id}', 'APROVADO')">✅ Aprovar</button>
            <button class="btn-small btn-danger" onclick="decidirPastor('${id}', 'REPROVADO')">❌ Reprovar</button>
        `;
    }
    return html;
}

// Funções de Ação e Modais foram mantidas exatamente iguais...
window.abrirModalProg = function() {
    document.getElementById('formProg')?.reset();
    const select = document.getElementById('prog_dept_id');
    if (select && SISTEMA.deptoAtivo) select.innerHTML = `<option value="${SISTEMA.deptoAtivo.ID}">${SISTEMA.deptoAtivo.NOME}</option>`;
    document.getElementById('campos-consag').classList.add('hidden');
    document.getElementById('modalProg')?.classList.remove('hidden');
};

window.salvarProgramacao = async function(e) {
    e.preventDefault();
    const dataAlvo = document.getElementById('prog_data').value;
    const diffDias = Math.ceil((new Date(dataAlvo + 'T00:00:00') - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
    
    if (diffDias < 15) {
        const confirm = await Swal.fire({ title: 'Prazo Curto', text: 'Mínimo de 15 dias exigido. Se for correção, prossiga.', icon: 'warning', showCancelButton: true, confirmButtonText: 'É correção' });
        if (!confirm.isConfirmed) return;
    }

    const selectDept = document.getElementById('prog_dept_id');
    const payload = {
        DEPT_ID: selectDept.value, NOME_DEPT: selectDept.options[selectDept.selectedIndex].text,
        DATA: dataBr(dataAlvo), TIPO: document.getElementById('prog_tipo').value,
        CONSAGRACAO: document.getElementById('prog_consag_sn').value, DIRIGENTE_CONSAG: document.getElementById('prog_consag_dir').value,
        PREGADOR_CONSAG: document.getElementById('prog_consag_pre').value, TEMA_NOITE: document.getElementById('prog_tema').value,
        DIRIGENTE_NOITE: document.getElementById('prog_noite_dir').value, PREGADOR_NOITE: document.getElementById('prog_noite_pre').value,
        CANTOR_NOITE: document.getElementById('prog_noite_can').value, INSTA_PREGADOR: document.getElementById('prog_insta_pre').value,
        INSTA_CANTOR: document.getElementById('prog_insta_can').value
    };

    const token = SISTEMA.token || sessionStorage.getItem('token_sistema');
    const btnSubmit = document.querySelector('#formProg button[type="submit"]');
    if(btnSubmit) btnSubmit.innerText = "Enviando...";

    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-token': token }, body: JSON.stringify(payload) });
        if (res.ok) {
            Swal.fire('Sucesso', 'Enviada para análise.', 'success');
            fecharModal('modalProg');
            carregarProgramacoes(); 
        }
    } catch(e) { console.error(e); }
    if(btnSubmit) btnSubmit.innerText = "Enviar para Análise";
};

window.aprovarComoLider = async function(idProg) {
    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes/${idProg}/aprovar-lider`, { method: 'PUT', headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') } });
        if (res.ok) { Swal.fire('Visto Registrado!', 'Aprovação confirmada.', 'success'); carregarProgramacoes(); }
    } catch(e) { console.error(e); }
};

window.encaminharParaPastor = async function(idProg) {
    const pastores = SISTEMA.dados.membros.filter(m => {
        const c = getVal(m, 'CARGO').toUpperCase(), p = getVal(m, 'PERFIL').toUpperCase(), n = getVal(m, 'NOME').toUpperCase();
        return c.includes('PASTOR') || p === 'PASTOR' || n.startsWith('PR.');
    });
    const options = {}; pastores.forEach(p => options[getVal(p, 'NOME')] = getVal(p, 'NOME'));
    if (Object.keys(options).length === 0) { Swal.fire('Aviso', 'Nenhum Pastor encontrado.', 'warning'); return; }

    const { value: pastorEscolhido } = await Swal.fire({ title: 'Escolha o Pastor', input: 'select', inputOptions: options, showCancelButton: true });
    if (pastorEscolhido) {
        const res = await fetch(`${API_BASE}/admin/programacoes/${idProg}/vincular-pastor`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') }, body: JSON.stringify({ PASTOR_NOME: pastorEscolhido }) });
        if (res.ok) { Swal.fire('Enviado!', `Atribuído ao ${pastorEscolhido}`, 'success'); carregarProgramacoes(); }
    }
};

window.decidirPastor = async function(idProg, decisao) {
    const confirm = await Swal.fire({ title: `Confirmar ${decisao}?`, icon: 'question', showCancelButton: true });
    if (confirm.isConfirmed) {
        const res = await fetch(`${API_BASE}/pastor/programacoes/${idProg}/decidir`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') }, body: JSON.stringify({ STATUS: decisao }) });
        if (res.ok) { Swal.fire('Pronto!', `Evento ${decisao}`, 'success'); carregarProgramacoes(); }
    }
};

window.toggleConsag = function(val) { document.getElementById('campos-consag').classList.toggle('hidden', val === 'N'); };

// ============================================================
// MODAIS E CRUD DE DEPARTAMENTOS (RESTAURO)
// ============================================================
window.abrirModalDepto = async function(idEdit = null) {
    document.getElementById('formDepto')?.reset();
    document.getElementById('depto_id').value = idEdit || ''; // Setando se é Edição ou Criação
    
    const titulo = document.getElementById('tituloModalDepto');
    if (titulo) titulo.innerText = idEdit ? "Editar Departamento" : "Criar Novo Departamento";

    const busca = document.getElementById('buscaLider');
    if (busca) busca.value = '';
        
    const modal = document.getElementById('modalDepto');
    if(modal) modal.classList.remove('hidden');
    
    const container = document.getElementById('container-lideres-depto');
    if (container) {
        container.innerHTML = '<span style="color:#999; font-size:0.8rem;">Carregando membros...</span>';
        
        try {
            let membros = [];
            if (SISTEMA.dados && SISTEMA.dados.membros && SISTEMA.dados.membros.length > 0) {
                membros = SISTEMA.dados.membros;
            } else {
                const res = await fetch(`${API_BASE}/admin/membros-disponiveis`, { 
                    headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') } 
                });
                if(res.ok) membros = await res.json();
            }
            
            // Tratamento à prova de balas para pegar o Nome e CPF correto
            const listaLimpa = membros.map(m => {
                const cpfRaw = m.CPF || m.cpf || getVal(m, 'CPF');
                const nomeRaw = m.NOME || m.nome || getVal(m, 'NOME');
                return { NOME: nomeRaw, CPF: String(cpfRaw).replace(/\D/g, '') };
            }).filter(m => m.NOME && m.CPF);

            listaLimpa.sort((a,b) => a.NOME.localeCompare(b.NOME));
            
            container.innerHTML = listaLimpa.map(m => `
                <label class="checkbox-item" style="padding: 5px 0;">
                    <input type="checkbox" name="lider_depto_cb" value="${m.CPF}">
                    ${m.NOME}
                </label>
            `).join('');

            // Se for Edição, pré-marca as caixinhas dos líderes atuais
            if (idEdit) {
                const depto = SISTEMA.meusDepts.find(d => d.ID == idEdit);
                if (depto) {
                    document.getElementById('depto_nome').value = depto.NOME;
                    const lideresAtuais = String(depto.LIDERES_CPF || "").split(',').map(c => c.trim().replace(/\D/g, ''));
                    
                    document.querySelectorAll('input[name="lider_depto_cb"]').forEach(cb => {
                        if (lideresAtuais.includes(cb.value)) {
                            cb.checked = true;
                        }
                    });
                }
            }
        } catch(e) {
            container.innerHTML = '<span style="color:red; font-size:0.8rem;">Erro ao carregar membros.</span>';
        }
    }
};

window.filtrarLideres = function() {
    const termo = document.getElementById('buscaLider').value.toLowerCase();
    document.querySelectorAll('#container-lideres-depto label').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(termo) ? "block" : "none";
    });
};

window.salvarDepto = async function(e) {
    e.preventDefault();
    const id = document.getElementById('depto_id').value;
    const nome = document.getElementById('depto_nome').value.trim();
    const lideresCpf = Array.from(document.querySelectorAll('input[name="lider_depto_cb"]:checked')).map(cb => cb.value).join(', ');
    
    // Se tem ID, edita. Se não tem, cria!
    const url = id ? `${API_BASE}/admin/departamentos/${id}` : `${API_BASE}/admin/departamentos`;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') },
        body: JSON.stringify({ NOME: nome, LIDERES_CPF: lideresCpf })
    });

    if (res.ok) {
        Swal.fire('Sucesso', 'Departamento salvo com sucesso!', 'success');
        fecharModal('modalDepto');
        carregarDadosIniciais(); 
    } else {
        Swal.fire('Erro', 'Falha ao salvar departamento.', 'error');
    }
};

window.excluirDepto = async function(id) {
    const conf = await Swal.fire({ title: 'Excluir departamento?', icon: 'warning', showCancelButton: true });
    if(conf.isConfirmed) {
        await fetch(`${API_BASE}/admin/departamentos/${id}`, { 
            method: 'DELETE', headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') } 
        });
        Swal.fire('Excluído!', '', 'success');
        carregarDadosIniciais();
    }
};




