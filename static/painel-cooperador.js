const SISTEMA = {
    usuario: JSON.parse(sessionStorage.getItem('usuario_sistema')),
    token: sessionStorage.getItem('token_sistema'),
    meusDepts: []
};

document.addEventListener('DOMContentLoaded', async () => {
    configurarVisibilidadeInicial();
    await carregarDadosIniciais();
});

function configurarVisibilidadeInicial() {
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();
    
    // Secretário: Pode criar departamentos
    if (perfil === 'ADMIN' || perfil === 'SECRETARIA') {
        document.getElementById('btn-novo-depto')?.classList.remove('hidden');
    }
}

async function carregarDadosIniciais() {
    // Busca departamentos (o back já filtra conforme o perfil)
    const res = await fetch(`${API_BASE}/cooperador/meus-departamentos`, {
        headers: { 'x-token': SISTEMA.token }
    });
    
    if (res.ok) {
        SISTEMA.meusDepts = await res.json();
        renderizarDeptos();
        
        // Se for líder de algum depto, permite criar programação
        if (SISTEMA.meusDepts.length > 0) {
            document.getElementById('btn-nova-prog')?.classList.remove('hidden');
        }
    }
}

function renderizarDeptos() {
    const container = document.getElementById('lista-deptos');
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();

    container.innerHTML = SISTEMA.meusDepts.map(d => `
        <div class="member-card">
            <div class="card-header">
                <strong>${d.NOME}</strong>
                ${perfil === 'SECRETARIA' ? `<button onclick="excluirDepto('${d.ID}')">🗑️</button>` : ''}
            </div>
            <div class="card-body">
                <button class="btn-link" onclick="verLiderados('${d.NOME}')">Ver Liderados</button>
            </div>
        </div>
    `).join('');
}

async function salvarProgramacao(e) {
    e.preventDefault();
    
    const dataAlvo = document.getElementById('prog_data').value;
    const dataObj = new Date(dataAlvo + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    const diffDias = Math.ceil((dataObj - hoje) / (1000 * 60 * 60 * 24));
    
    // Regra: 15 dias de antecedência (O backend também valida isso)
    if (diffDias < 15) {
        const confirm = await Swal.fire({
            title: 'Prazo Curto',
            text: 'Programações devem ser enviadas com 15 dias de antecedência. Se for uma CORREÇÃO de evento reprovado, pode continuar.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'É uma correção',
            cancelButtonText: 'Cancelar'
        });
        if (!confirm.isConfirmed) return;
    }

    const payload = {
        DEPT_ID: document.getElementById('prog_dept_id').value,
        DATA: dataBr(dataAlvo), // Função utilitária que você já tem no main.py
        TIPO: document.getElementById('prog_tipo').value,
        CONSAGRACAO: document.getElementById('prog_consag_sn').value,
        DIRIGENTE_CONSAG: document.getElementById('prog_consag_dir').value,
        PREGADOR_CONSAG: document.getElementById('prog_consag_pre').value,
        TEMA_NOITE: document.getElementById('prog_tema').value,
        DIRIGENTE_NOITE: document.getElementById('prog_noite_dir').value,
        PREGADOR_NOITE: document.getElementById('prog_noite_pre').value,
        CANTOR_NOITE: document.getElementById('prog_noite_can').value,
        INSTA_PREGADOR: document.getElementById('prog_insta_pre').value,
        INSTA_CANTOR: document.getElementById('prog_insta_can').value,
        NOME_DEPT: document.getElementById('prog_dept_id').options[document.getElementById('prog_dept_id').selectedIndex].text
    };

    const sucesso = await enviarDados(`${API_BASE}/cooperador/programacoes`, null, payload);
    if (sucesso) fecharModal('modalProg');
}

function toggleConsag(val) {
    document.getElementById('campos-consag').classList.toggle('hidden', val === 'N');
}

// Função para o Pastor dar o veredito final
async function decidirPastor(idProg, decisao) {
    const confirm = await Swal.fire({
        title: `Deseja ${decisao.toLowerCase()}?`,
        text: "Esta ação notificará o departamento responsável.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, confirmar',
        cancelButtonText: 'Cancelar'
    });

    if (confirm.isConfirmed) {
        const res = await fetch(`${API_BASE}/pastor/programacoes/${idProg}/decidir`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token },
            body: JSON.stringify({ STATUS: decisao })
        });

        if (res.ok) {
            Swal.fire('Sucesso!', `Programação ${decisao.toLowerCase()} com sucesso.`, 'success');
            await carregarDadosIniciais(); // Recarrega a lista para atualizar os selos
        }
    }
}

function renderizarBotoesAcao(prog, perfil) {
    const status = prog.STATUS;
    const id = prog.ID;
    let html = '';

    // LÓGICA PARA LÍDERES (MEMBRO)
    if (status === 'PENDENTE_LIDER') {
        const nomesAprovados = (prog.APROVACOES_LIDERES || "").split(", ");
        // Só mostra o botão de aprovar se o nome do líder logado ainda não estiver na lista
        if (!nomesAprovados.includes(SISTEMA.usuario.NOME)) {
            html += `<button class="btn-small btn-success" onclick="aprovarComoLider('${id}')">✅ Dar meu Visto</button>`;
        }
    }

    // LÓGICA PARA SECRETARIA
    if (status === 'PENDENTE_SEC' && (perfil === 'SECRETARIA' || perfil === 'ADMIN')) {
        html += `<button class="btn-small btn-primary" onclick="encaminharParaPastor('${id}')">🙏 Enviar ao Pastor</button>`;
    }

    // LÓGICA PARA O PASTOR
    if (status === 'ANALISE_PASTOR' && perfil === 'PASTOR') {
        // Verifica se o pastor logado é o responsável atribuído
        if (prog.PASTOR_RESP === SISTEMA.usuario.NOME) {
            html += `
                <button class="btn-small btn-success" onclick="decidirPastor('${id}', 'APROVADO')">✅ Aprovar</button>
                <button class="btn-small btn-danger" onclick="decidirPastor('${id}', 'REPROVADO')">❌ Reprovar</button>
            `;
        }
    }

    return html;
}

function renderizarCardProgramacao(prog) {
    const perfil = SISTEMA.usuario.PERFIL.toUpperCase();
    const status = prog.STATUS;
    
    // Cores baseadas no status
    const cores = {
        'PENDENTE_LIDER': '#f59e0b', // Amarelo
        'PENDENTE_SEC': '#3b82f6',   // Azul
        'ANALISE_PASTOR': '#8b5cf6', // Roxo
        'APROVADO': '#22c55e',       // Verde
        'REPROVADO': '#ef4444'       // Vermelho
    };

    return `
    <div class="member-card" style="border-left: 5px solid ${cores[status] || '#ccc'}">
        <div class="card-header">
            <strong>${prog.TEMA_NOITE || 'Evento sem tema'}</strong>
            <span class="badge-status">${status}</span>
        </div>
        
        <div class="card-body">
            <div><span class="material-icons">calendar_today</span> ${prog.DATA}</div>
            <div><span class="material-icons">person</span> Pregador: ${prog.PREGADOR_NOITE} (${prog.INSTA_PREGADOR})</div>
            
            <div class="approval-history" style="background: #f8fafc; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.85rem;">
                <p><strong>✅ Líderes que aprovaram:</strong> ${prog.APROVACOES_LIDERES || 'Aguardando...'}</p>
                ${prog.SECRETARIO_REVISOR ? `<p><strong>🔍 Revisado por:</strong> ${prog.SECRETARIO_REVISOR}</p>` : ''}
                ${prog.PASTOR_RESP ? `<p><strong>⏳ Atribuído ao:</strong> ${prog.PASTOR_RESP}</p>` : ''}
                ${prog.PASTOR_APROVADOR ? `<p><strong>🏆 Visto Final:</strong> ${prog.PASTOR_APROVADOR} em ${prog.DATA_HORA_APROVACAO}</p>` : ''}
            </div>
        </div>

        <div class="card-actions">
            ${renderizarBotoesAcao(prog, perfil)}
        </div>
    </div>`;
}

async function encaminharParaPastor(idProg) {
    // 1. Busca os pastores para a lista suspensa
    const membros = await fetch(`${API_BASE}/admin/membros-disponiveis`, { headers: { 'x-token': SISTEMA.token } }).then(r => r.json());
    const pastores = membros.filter(m => m.perfil === 'PASTOR');

    const inputOptions = {};
    pastores.forEach(p => { inputOptions[p.nome] = p.nome; });

    // 2. Abre o alerta para escolha
    const { value: pastorEscolhido } = await Swal.fire({
        title: 'Escolha o Pastor Responsável',
        input: 'select',
        inputOptions: inputOptions,
        inputPlaceholder: 'Selecione o pastor...',
        showCancelButton: true
    });

    if (pastorEscolhido) {
        // 3. Chama a rota que criamos no main.py
        const res = await fetch(`${API_BASE}/admin/programacoes/${idProg}/vincular-pastor`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token },
            body: JSON.stringify({ PASTOR_NOME: pastorEscolhido })
        });

        if (res.ok) {
            Swal.fire('Sucesso', `Programação enviada para ${pastorEscolhido}`, 'success');
            await carregarDadosIniciais(); // Atualiza a lista
        }
    }
}

async function verLiderados(nomeDepartamento) {
    Swal.fire({
        title: `Liderados: ${nomeDepartamento}`,
        html: '<div id="lista-liderados-modal" class="card-list">Carregando...</div>',
        width: '90%',
        showConfirmButton: false,
        showCloseButton: true
    });

    try {
        const res = await fetch(`${API_BASE}/cooperador/membros-por-departamento/${nomeDepartamento}`, {
            headers: { 'x-token': SISTEMA.token }
        });
        const liderados = await res.json();
        const container = document.getElementById('lista-liderados-modal');

        if (liderados.length === 0) {
            container.innerHTML = '<p class="empty-msg">Nenhum membro vinculado a este departamento.</p>';
            return;
        }

        container.innerHTML = liderados.map(m => {
            const fone = String(m.CONTATO || "").replace(/\D/g, "");
            const endereco = encodeURIComponent(m.ENDERECO || "");
            const foto = recuperarFoto(m);

            return `
            <div class="member-card" style="text-align: left; border-left: 5px solid var(--accent);">
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="${foto || '../static/logo.png'}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong>${m.NOME}</strong><br>
                        <small>${m.CARGO || 'Membro'}</small>
                    </div>
                </div>
                <div style="margin-top:10px; font-size:0.85rem; color:#64748b;">
                    <p><b>📍 Endereço:</b> ${m.ENDERECO || 'Não informado'}</p>
                    <p><b>🎂 Nascimento:</b> ${m.NASCIMENTO}</p>
                    <p><b>👨‍👩‍👧‍👦 Pais:</b> ${m.PAI} e ${m.MAE}</p>
                </div>
                <div class="card-actions" style="justify-content: flex-start; gap: 10px; margin-top:10px;">
                    <a href="https://wa.me/55${fone}" target="_blank" class="btn-small btn-success" style="text-decoration:none;">
                        <span class="material-icons" style="font-size:16px; vertical-align:middle;">whatsapp</span> Conversar
                    </a>
                    <a href="https://www.google.com/maps/search/?api=1&query=${endereco}" target="_blank" class="btn-small btn-primary" style="text-decoration:none;">
                        <span class="material-icons" style="font-size:16px; vertical-align:middle;">directions</span> Ver no Mapa
                    </a>
                </div>
            </div>`;
        }).join('');

    } catch (error) {
        document.getElementById('lista-liderados-modal').innerHTML = 'Erro ao carregar membros.';
    }
}