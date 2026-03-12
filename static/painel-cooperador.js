// ATENÇÃO: Não declaramos "const SISTEMA" aqui, pois já vem do painel principal.
SISTEMA.meusDepts = [];
SISTEMA.programacoes = [];

// ============================================================
// 1. CARREGAMENTO DE DADOS (READ)
// ============================================================
window.carregarDadosIniciais = async function () {

    try {

        const headers = {
            "Content-Type": "application/json",
            "x-token": SISTEMA.token
        };

        const [resDeptos, resProgs] = await Promise.all([
            fetch(`${API_BASE}/cooperador/meus-departamentos`, { headers }),
            fetch(`${API_BASE}/cooperador/programacoes`, { headers })
        ]);

        const deptos = await resDeptos.json();
        const progs = await resProgs.json();

        renderizarDepartamentos(deptos);
        renderizarProgramacoes(progs);

    } catch (erro) {

        console.error("Erro ao carregar cooperadores:", erro);

        Swal.fire({
            icon: "error",
            title: "Erro",
            text: "Não foi possível carregar os dados."
        });

    }
};

function renderizarDepartamentos(lista) {

    const container = document.getElementById("lista-deptos");

    if (!lista || lista.length === 0) {
        container.innerHTML = "<p>Nenhum departamento encontrado.</p>";
        return;
    }

    container.innerHTML = lista.map(d => `
        <div class="card">
            <h3>${d.NOME}</h3>
            <p>Membros: ${d.QTD_MEMBROS || 0}</p>
        </div>
    `).join("");

}

function renderizarProgramacoes(lista) {

    const container = document.getElementById("lista-progs");

    if (!lista || lista.length === 0) {
        container.innerHTML = "<p>Nenhuma programação encontrada.</p>";
        return;
    }

    container.innerHTML = lista.map(p => `
        <div class="card">
            <strong>${p.TEMA_NOITE || "Programação"}</strong>
            <p>Data: ${p.DATA}</p>
            <p>Status: ${p.STATUS}</p>
        </div>
    `).join("");

}

window.carregarProgramacoes = async function() {
    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes`, {
            headers: { 'x-token': SISTEMA.token }
        });
        if (res.ok) {
            SISTEMA.programacoes = await res.json();
            renderizarProgramacoesCards();
        }
    } catch (e) {
        console.error("Erro ao carregar programações:", e);
    }
};

// ============================================================
// 2. CONTROLE DE ABAS INTERNAS
// ============================================================
window.switchCooperadorTab = function(tab, btn) {

    document.querySelectorAll('#sec-cooperadores .nav-button')
        .forEach(b => b.classList.remove('active'));

    btn.classList.add('active');

    document.querySelectorAll('#sec-cooperadores .tab-content')
        .forEach(t => t.classList.add('hidden'));

    document.getElementById('tab-' + tab)
        .classList.remove('hidden');
};

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
        <div class="member-card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap: 10px;">
                    <strong>${d.NOME}</strong>
                    <span class="badge-perfil" style="background:#3b82f6; color:white; font-size:0.7rem; padding:3px 8px; border-radius:12px;">
                        ${d.QTD_MEMBROS || 0} membro(s)
                    </span>
                </div>
                ${['SECRETARIA', 'ADMIN'].includes(perfil) ? `<button class="btn-icon delete" onclick="excluirDepto('${d.ID}')">🗑️</button>` : ''}
            </div>
            <div class="card-body" style="margin-top:10px;">
                <button class="btn-small btn-primary" onclick="verLiderados('${d.NOME}')" style="display:flex; align-items:center; gap:5px;">
                    <span class="material-icons" style="font-size:16px;">groups</span> Ver Liderados
                </button>
            </div>
        </div>
    `).join('');
};

window.renderizarProgramacoesCards = function() {
    const container = document.getElementById('lista-progs');
    if (SISTEMA.programacoes.length === 0) {
        container.innerHTML = '<p class="empty-msg">Nenhuma programação encontrada.</p>';
        return;
    }
    container.innerHTML = SISTEMA.programacoes.map(p => renderizarCardProgramacao(p)).join('');
};

window.renderizarCardProgramacao = function(prog) {
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
            <span class="badge-perfil" style="background:${cores[status]}; color:white;">${status}</span>
        </div>
        
        <div class="card-body">
            <div><span class="material-icons" style="font-size:16px; vertical-align:middle;">calendar_today</span> <strong>Data:</strong> ${getVal(prog, 'DATA')}</div>
            <div><strong>🎤 Pregador:</strong> ${getVal(prog, 'PREGADOR_NOITE')} (${getVal(prog, 'INSTA_PREGADOR')})</div>
            <div><strong>🎵 Cantor:</strong> ${getVal(prog, 'CANTOR_NOITE')}</div>
            
            <div class="approval-history" style="background: #f8fafc; padding: 10px; border-radius: 5px; margin-top: 10px; font-size: 0.85rem; border:1px solid #e2e8f0;">
                <div style="color:#1e293b;"><strong>✅ Visto dos Líderes:</strong> ${getVal(prog, 'APROVACOES_LIDERES') || 'Aguardando...'}</div>
                ${getVal(prog, 'SECRETARIO_REVISOR') ? `<div style="color:#3b82f6; margin-top:4px;"><strong>🔍 Revisado por:</strong> ${getVal(prog, 'SECRETARIO_REVISOR')}</div>` : ''}
                ${getVal(prog, 'PASTOR_RESP') ? `<div style="color:#8b5cf6; margin-top:4px;"><strong>⏳ Atribuído ao:</strong> ${getVal(prog, 'PASTOR_RESP')}</div>` : ''}
                ${getVal(prog, 'PASTOR_APROVADOR') ? `<div style="color:#15803d; margin-top:4px;"><strong>🏆 Decisão Final:</strong> ${getVal(prog, 'PASTOR_APROVADOR')} em ${getVal(prog, 'DATA_HORA_APROVACAO')}</div>` : ''}
            </div>
        </div>

        <div class="card-actions" style="margin-top:15px; justify-content:flex-start;">
            ${gerarBotoesAcao(prog, perfil)}
        </div>
    </div>`;
};

// ============================================================
// 4. LÓGICA DE BOTÕES E PERMISSÕES
// ============================================================
function gerarBotoesAcao(prog, perfil) {
    const status = getVal(prog, 'STATUS');
    const id = getVal(prog, 'ID');
    let html = '';

    if (status === 'PENDENTE_LIDER') {
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
// 5. AÇÕES DO SISTEMA (POST, PUT, DELETE)
// ============================================================
window.abrirModalDepto = async function() {
    console.log("Abrindo modal de departamento..."); // <-- Adicionei isso pra você ver no F12
    
    // Reseta o formulário
    document.getElementById('formDepto')?.reset();

    const busca = document.getElementById('buscaLider');
    if (busca) busca.value = '';
        
    // Mostra o modal (Tirei a classe hidden)
    const modal = document.getElementById('modalDepto');
    if(modal) modal.classList.remove('hidden');
    
    const container = document.getElementById('container-lideres-depto');
    if (container) {
        container.innerHTML = '<span style="color:#999; font-size:0.8rem;">Carregando membros...</span>';
        
        try {
            // Tenta pegar a lista de membros já carregada pelo painel-secretaria
            let membros = [];
            if (SISTEMA && SISTEMA.dados && SISTEMA.dados.membros) {
                membros = SISTEMA.dados.membros;
            }
            
            // Se a lista local falhar, bate na API
            if (membros.length === 0) {
                console.log("Buscando membros da API...");
                const res = await fetch(`${API_BASE}/admin/membros-disponiveis`, { 
                    headers: { 'x-token': SISTEMA.token || sessionStorage.getItem('token_sistema') } 
                });
                const data = await res.json();
                membros = data.map(m => ({ NOME: m.nome || m.NOME, CPF: m.cpf || m.CPF }));
            }
            
            // Ordena alfabeticamente
            membros.sort((a,b) => getVal(a, 'NOME').localeCompare(getVal(b, 'NOME')));
            
            // Cria os checkboxes
            container.innerHTML = membros.map(m => `
                <label class="checkbox-item" style="padding: 5px 0;">
                    <input type="checkbox" name="lider_depto_cb" value="${getVal(m, 'CPF')}">
                    ${getVal(m, 'NOME')}
                </label>
            `).join('');
            
        } catch(e) {
            console.error("Erro ao popular lista de lideres:", e);
            container.innerHTML = '<span style="color:red; font-size:0.8rem;">Erro ao carregar membros.</span>';
        }
    }
};

window.filtrarLideres = function() {
    const termo = document.getElementById('buscaLider').value.toLowerCase();
    const container = document.getElementById('container-lideres-depto');

    if (!container) return;

    const itens = container.querySelectorAll('label.checkbox-item');

    itens.forEach(item => {
        const nome = item.textContent.toLowerCase();

        if (nome.includes(termo)) {
            item.style.display = "block";
        } else {
            item.style.display = "none";
        }
    });
};

// --- 3. SALVAR DEPARTAMENTO COM OS LÍDERES ---
window.salvarDepto = async function(e) {
    e.preventDefault();
    const nome = document.getElementById('depto_nome').value.trim();
    
    // Pega todos os CPFs que o secretário marcou
    const checkboxes = document.querySelectorAll('input[name="lider_depto_cb"]:checked');
    const lideresCpf = Array.from(checkboxes).map(cb => cb.value).join(', ');
    
    const payload = {
        NOME: nome,
        LIDERES_CPF: lideresCpf
    };

    const sucesso = await enviarDados(`${API_BASE}/admin/departamentos`, null, payload, 'formDepto');
    if (sucesso) {
        fecharModal('modalDepto');
        carregarDadosIniciais(); // Recarrega a tela para atualizar a contagem e as listas
    }
};

window.excluirDepto = async function(id) {
    const conf = await Swal.fire({ title: 'Tem certeza?', text: "Excluir departamento?", icon: 'warning', showCancelButton: true });
    if(conf.isConfirmed) {
        try {
            await fetch(`${API_BASE}/admin/departamentos/${id}`, { method: 'DELETE', headers: { 'x-token': SISTEMA.token } });
            Swal.fire('Excluído!', '', 'success');
            carregarDadosIniciais();
        } catch (e) {
            Swal.fire('Erro', 'Não foi possível excluir.', 'error');
        }
    }
};

window.aprovarComoLider = async function(idProg) {
    try {
        const res = await fetch(`${API_BASE}/cooperador/programacoes/${idProg}/aprovar-lider`, {
            method: 'PUT', headers: { 'x-token': SISTEMA.token }
        });
        if (res.ok) {
            Swal.fire('Visto Registrado!', 'Aprovação confirmada.', 'success');
            carregarProgramacoes();
        }
    } catch(e) { console.error(e); }
};

window.abrirModalProg = function() {
    document.getElementById('formProg')?.reset();
    
    // Preenche a lista de departamentos que a pessoa lidera
    const select = document.getElementById('prog_dept_id');
    select.innerHTML = SISTEMA.meusDepts.map(d => `<option value="${d.ID}">${d.NOME}</option>`).join('');
    
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

    const payload = {
        DEPT_ID: document.getElementById('prog_dept_id').value,
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
        INSTA_CANTOR: document.getElementById('prog_insta_can').value,
        NOME_DEPT: document.getElementById('prog_dept_id').options[document.getElementById('prog_dept_id').selectedIndex].text
    };

    const sucesso = await enviarDados(`${API_BASE}/cooperador/programacoes`, null, payload, 'formProg');
    if (sucesso) {
        fecharModal('modalProg');
        carregarProgramacoes();
    }
};

window.toggleConsag = function(val) {
    document.getElementById('campos-consag').classList.toggle('hidden', val === 'N');
};

// Outras funções (encaminharParaPastor, decidirPastor, verLiderados) permanecem com as mesmas rotas e lógicas...
window.encaminharParaPastor = async function(idProg) {
    const membros = await fetch(`${API_BASE}/admin/membros-disponiveis`, { headers: { 'x-token': SISTEMA.token } }).then(r => r.json());
    const pastores = membros.filter(m => String(m.perfil).toUpperCase() === 'PASTOR');
    
    const options = {};
    pastores.forEach(p => { options[p.nome] = p.nome; });

    const { value: pastorEscolhido } = await Swal.fire({
        title: 'Escolha o Pastor', input: 'select', inputOptions: options, showCancelButton: true
    });

    if (pastorEscolhido) {
        const res = await fetch(`${API_BASE}/admin/programacoes/${idProg}/vincular-pastor`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token },
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
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-token': SISTEMA.token },
            body: JSON.stringify({ STATUS: decisao })
        });
        if (res.ok) {
            Swal.fire('Pronto!', `Evento ${decisao}`, 'success');
            carregarProgramacoes();
        }
    }
};

window.verLiderados = async function(nomeDepartamento) {
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
        if(!container) return;

        if (liderados.length === 0) {
            container.innerHTML = '<p class="empty-msg">Nenhum membro encontrado.</p>';
            return;
        }

        container.innerHTML = liderados.map(m => {

            const fone = String(getVal(m, 'CONTATO') || "").replace(/\D/g, "");
            const endereco = encodeURIComponent(getVal(m, 'ENDERECO') || "");
            const foto = recuperarFoto(m) || '../static/icons/ios/32.png';

            const pai = String(getVal(m, 'PAI') || "");
            const mae = String(getVal(m, 'MAE') || "");

            let pais = "N/A";

            if(pai && mae){
                pais = `${pai} e ${mae}`;
            } else if(pai){
                pais = pai;
            } else if(mae){
                pais = mae;
            }

            return `
            <div class="member-card" style="text-align: left; border-left: 5px solid var(--accent, #3b82f6);">
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="${foto}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong>${getVal(m, 'NOME')}</strong><br>
                        <small>${getVal(m, 'CARGO') || 'Membro'}</small>
                    </div>
                </div>

                <div style="margin-top:10px; font-size:0.85rem; color:#64748b;">
                    <p><b>👨‍👩‍👧‍👦 Pais:</b> ${pais}</p>
                    <p><b>💍 Estado Civil:</b> ${getVal(m, 'ESTADO_CIVIL') || "N/A"}</p>
                    <p><b>📍 Endereço:</b> ${getVal(m, 'ENDERECO') || "N/A"}</p>
                </div>

                <div class="card-actions" style="justify-content: flex-start; gap: 10px; margin-top:10px;">
                    <a href="https://wa.me/55${fone}" target="_blank" class="btn-small btn-success" style="text-decoration:none;">
                        <span class="material-icons" style="font-size:16px;">whatsapp</span> Mensagem
                    </a>

                    <a href="https://www.google.com/maps/search/?api=1&query=${endereco}" target="_blank" class="btn-small btn-primary" style="text-decoration:none;">
                        <span class="material-icons" style="font-size:16px;">directions</span> Mapa
                    </a>
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        document.getElementById('lista-liderados-modal').innerHTML = 'Erro ao carregar membros.';
    }
};


