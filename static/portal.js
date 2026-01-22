const API_BASE = 'https://api-escala.onrender.com/api';
let usuario = null;
let token = null;
let cacheMembros = []; // Para guardar os dados e usar na edição

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const userStr = sessionStorage.getItem('usuario_sistema');
    token = sessionStorage.getItem('token_sistema'); 
    
    if (!userStr) {
        window.location.href = '/login';
        return;
    }
    usuario = JSON.parse(userStr);
    
    // Header Sidebar
    document.getElementById('userInfo').innerHTML = `
        <strong>${usuario.NOME ? usuario.NOME.split(' ')[0] : 'Usuário'}</strong><br>
        <span style="font-size:0.8rem; text-transform:uppercase; color:#38bdf8;">${usuario.PERFIL}</span>
    `;

    gerarMenu(usuario.PERFIL);
    
    // Roteamento inicial
    if(usuario.PERFIL === 'PASTOR') carregarVisaoPastor();
    else if (['SECRETARIA', 'ADMIN'].includes(usuario.PERFIL)) carregarVisaoSecretaria();
    else carregarVisaoMembro();
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function logout() {
    sessionStorage.clear();
    window.location.href = '/login';
}

function gerarMenu(perfil) {
    const menu = document.getElementById('menuContainer');
    let html = '';

    html += `<button class="menu-btn" onclick="abrirEBD()"><span class="menu-icon">📖</span> Ir para EBD</button>`;

    if (perfil === 'PASTOR') {
        html += `<button class="menu-btn active" onclick="carregarVisaoPastor()"><span class="menu-icon">📅</span> Minha Agenda</button>`;
        html += `<button class="menu-btn" onclick="carregarMembrosRead()"><span class="menu-icon">👥</span> Membros</button>`;
    } 
    else if (['SECRETARIA', 'ADMIN'].includes(perfil)) {
        html += `<button class="menu-btn" onclick="carregarVisaoSecretaria()"><span class="menu-icon">🏠</span> Início</button>`;
        html += `<button class="menu-btn" onclick="carregarCRUDMembros()"><span class="menu-icon">👥</span> Gestão Membros</button>`;
        html += `<button class="menu-btn" onclick="carregarGestaoAgendaPastor()"><span class="menu-icon">👔</span> Agenda Pastor</button>`;
    } 
    else { 
        html += `<button class="menu-btn" onclick="carregarVisaoMembro()"><span class="menu-icon">👤</span> Meus Dados</button>`;
        html += `<button class="menu-btn" onclick="carregarAgendaIgreja()"><span class="menu-icon">📅</span> Agenda Igreja</button>`;
    }

    menu.innerHTML = html;
    
    const btns = menu.querySelectorAll('.menu-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', function() {
            btns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            if(window.innerWidth <= 768) toggleSidebar();
        });
    });
}

// ==========================================
// 1. GESTÃO DE MEMBROS (CRUD COMPLETO)
// ==========================================
async function carregarCRUDMembros() {
    const container = document.getElementById('mainContainer');
    container.innerHTML = '<div class="panel-card"><p>Carregando membros...</p></div>';

    try {
        const res = await fetch(`${API_BASE}/membros`);
        cacheMembros = await res.json(); // Salva em memória para edição

        let linhas = cacheMembros.map(m => `
            <tr>
                <td>${m.NOME}</td>
                <td>${m.CPF}</td>
                <td>${m.CARGO || '-'}</td>
                <td><span class="badge badge-${m.PERFIL ? m.PERFIL.toLowerCase() : 'membro'}">${m.PERFIL}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="editarMembro('${m.ID}')">Editar</button>
                    <button class="btn-action btn-delete" onclick="deletarMembro('${m.ID}')">Excluir</button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="panel-card">
                <div class="panel-title">
                    <span>Gestão de Membros</span>
                    <button class="btn-add" onclick="abrirModalMembro()">+ Novo Membro</button>
                </div>
                <div style="overflow-x:auto;">
                    <table class="data-table">
                        <thead><tr><th>Nome</th><th>CPF</th><th>Cargo</th><th>Perfil</th><th>Ações</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="panel-card"><p style="color:red">Erro: ${e.message}</p></div>`;
    }
}

// Abre Modal (Modo Criar ou Editar)
function abrirModalMembro(idEditar = null) {
    const modalBody = document.getElementById('modalBody');
    const isEdit = !!idEditar;
    let dados = {};

    if (isEdit) {
        document.getElementById('modalTitle').innerText = 'Editar Membro';
        dados = cacheMembros.find(m => m.ID === idEditar) || {};
    } else {
        document.getElementById('modalTitle').innerText = 'Cadastrar Novo Membro';
    }
    
    // Formulário Completo
    modalBody.innerHTML = `
        <form onsubmit="salvarMembro(event, '${idEditar || ''}')">
            
            <div class="form-section-title">Dados Pessoais</div>
            <div class="form-group">
                <label>Nome Completo *</label>
                <input type="text" id="m_nome" class="form-input" value="${dados.NOME || ''}" required>
            </div>
            
            <div class="form-grid-3">
                <div class="form-group">
                    <label>CPF (Só números) *</label>
                    <input type="text" id="m_cpf" class="form-input" value="${dados.CPF || ''}" required>
                </div>
                <div class="form-group">
                    <label>Data Nasc (DD/MM/AAAA) *</label>
                    <input type="text" id="m_nasc" class="form-input" value="${dados.NASCIMENTO || ''}" placeholder="Ex: 25/12/1990" required>
                </div>
                <div class="form-group">
                    <label>Estado Civil</label>
                    <select id="m_estado" class="form-input">
                        <option value="Solteiro">Solteiro(a)</option>
                        <option value="Casado">Casado(a)</option>
                        <option value="Divorciado">Divorciado(a)</option>
                        <option value="Viúvo">Viúvo(a)</option>
                    </select>
                </div>
            </div>

            <div class="form-grid-2">
                <div class="form-group">
                    <label>Cônjuge</label>
                    <input type="text" id="m_conjuge" class="form-input" value="${dados.CONJUGE || ''}">
                </div>
                <div class="form-group">
                    <label>Data Casamento</label>
                    <input type="text" id="m_data_casamento" class="form-input" value="${dados.DATA_CASAMENTO || ''}" placeholder="DD/MM/AAAA">
                </div>
            </div>

            <div class="form-group">
                <label>Filhos (Separe por vírgula)</label>
                <input type="text" id="m_filhos" class="form-input" value="${dados.FILHOS || ''}">
            </div>

            <div class="form-grid-2">
                <div class="form-group">
                    <label>Nome do Pai</label>
                    <input type="text" id="m_pai" class="form-input" value="${dados.PAI || ''}">
                </div>
                <div class="form-group">
                    <label>Nome da Mãe</label>
                    <input type="text" id="m_mae" class="form-input" value="${dados.MAE || ''}">
                </div>
            </div>

            <div class="form-section-title">Dados Profissionais</div>
            <div class="form-grid-2">
                <div class="form-group">
                    <label>Profissão</label>
                    <input type="text" id="m_profissao" class="form-input" value="${dados.PROFISSAO || ''}">
                </div>
                <div class="form-group">
                    <label>Situação de Trabalho</label>
                    <select id="m_situacao" class="form-input">
                        <option value="Empregado">Empregado</option>
                        <option value="Desempregado">Desempregado</option>
                        <option value="Autônomo">Autônomo</option>
                        <option value="Aposentado">Aposentado</option>
                    </select>
                </div>
            </div>

            <div class="form-section-title">Dados Eclesiásticos</div>
            <div class="form-grid-2">
                <div class="form-group">
                    <label>Cargo</label>
                    <input type="text" id="m_cargo" class="form-input" value="${dados.CARGO || 'Membro'}">
                </div>
                <div class="form-group">
                    <label>Departamento</label>
                    <input type="text" id="m_departamento" class="form-input" value="${dados.DEPARTAMENTO || ''}">
                </div>
            </div>

            <div class="form-grid-2">
                <div class="form-group">
                    <label>Perfil de Acesso</label>
                    <select id="m_perfil" class="form-input">
                        <option value="MEMBRO">Membro (Padrão)</option>
                        <option value="PASTOR">Pastor</option>
                        <option value="SECRETARIA">Secretaria</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Senha (Só p/ Admin/Pastor)</label>
                    <input type="text" id="m_senha" class="form-input" value="${dados.SENHA || ''}" placeholder="Deixe em branco p/ membro">
                </div>
            </div>

            <button type="submit" class="btn-add" style="width:100%; margin-top:10px;">${isEdit ? 'Atualizar Dados' : 'Salvar Cadastro'}</button>
        </form>
    `;

    // Preenche selects
    if (dados.ESTADO_CIVIL) document.getElementById('m_estado').value = dados.ESTADO_CIVIL;
    if (dados.SITUACAO_TRABALHO) document.getElementById('m_situacao').value = dados.SITUACAO_TRABALHO;
    if (dados.PERFIL) document.getElementById('m_perfil').value = dados.PERFIL;

    document.getElementById('modalForm').classList.remove('hidden');
}

// Wrapper para o botão Editar
function editarMembro(id) {
    abrirModalMembro(id);
}

// Salvar (POST ou PUT)
async function salvarMembro(e, idEditar) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = 'Salvando...';

    const payload = {
        NOME: document.getElementById('m_nome').value,
        CPF: document.getElementById('m_cpf').value,
        NASCIMENTO: document.getElementById('m_nasc').value,
        ESTADO_CIVIL: document.getElementById('m_estado').value,
        DATA_CASAMENTO: document.getElementById('m_data_casamento').value,
        CONJUGE: document.getElementById('m_conjuge').value,
        FILHOS: document.getElementById('m_filhos').value,
        PAI: document.getElementById('m_pai').value,
        MAE: document.getElementById('m_mae').value,
        PROFISSAO: document.getElementById('m_profissao').value,
        SITUACAO_TRABALHO: document.getElementById('m_situacao').value,
        DEPARTAMENTO: document.getElementById('m_departamento').value,
        PERFIL: document.getElementById('m_perfil').value,
        CARGO: document.getElementById('m_cargo').value,
        SENHA: document.getElementById('m_senha').value
    };

    try {
        let url = `${API_BASE}/membros`;
        let method = 'POST';

        if (idEditar) {
            url = `${API_BASE}/membros/${idEditar}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'x-admin-token': 'admin_secret' 
            },
            body: JSON.stringify(payload)
        });

        if(!res.ok) throw new Error("Erro na API");

        fecharModal();
        carregarCRUDMembros(); 
    } catch (err) {
        alert('Erro ao salvar. Verifique a conexão.');
        btn.innerText = 'Tentar Novamente';
    }
}

async function deletarMembro(id) {
    if(!confirm("Tem certeza que deseja excluir este membro?")) return;
    try {
        await fetch(`${API_BASE}/membros/${id}`, { 
            method: 'DELETE',
            headers: { 'x-admin-token': 'admin_secret' } 
        });
        carregarCRUDMembros();
    } catch (e) { alert("Erro ao deletar"); }
}

// ==========================================
// 2. GESTÃO AGENDA PASTOR
// ==========================================
async function carregarGestaoAgendaPastor() {
    const container = document.getElementById('mainContainer');
    container.innerHTML = '<div class="panel-card"><p>Carregando agenda...</p></div>';

    try {
        const res = await fetch(`${API_BASE}/agenda-pastor`);
        const agenda = await res.json();

        let linhas = agenda.map(a => `
            <tr>
                <td>${a.DATA}</td>
                <td>${a.HORARIO || '-'}</td>
                <td>${a.EVENTO}</td>
                <td>${a.LOCAL || '-'}</td>
                <td>
                    <button class="btn-action btn-delete" onclick="deletarEventoPastor('${a.ID}')">Excluir</button>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="panel-card">
                <div class="panel-title">
                    <span>Agenda do Pastor</span>
                    <button class="btn-add" onclick="abrirModalAgenda()">+ Novo Compromisso</button>
                </div>
                <div style="overflow-x:auto;">
                    <table class="data-table">
                        <thead><tr><th>Data</th><th>Hora</th><th>Evento</th><th>Local</th><th>Ações</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<div class="panel-card"><p>Erro: ${e.message}</p></div>`;
    }
}

function abrirModalAgenda() {
    const modalBody = document.getElementById('modalBody');
    document.getElementById('modalTitle').innerText = 'Agendar Compromisso';
    
    modalBody.innerHTML = `
        <form onsubmit="salvarEventoPastor(event)">
            <div class="form-grid-2">
                <div class="form-group">
                    <label>Data (DD/MM/AAAA)</label>
                    <input type="text" id="a_data" class="form-input" required>
                </div>
                <div class="form-group">
                    <label>Horário</label>
                    <input type="text" id="a_hora" class="form-input" placeholder="19:00">
                </div>
            </div>
            <div class="form-group">
                <label>Evento / Compromisso</label>
                <input type="text" id="a_evento" class="form-input" required>
            </div>
            <div class="form-group">
                <label>Local</label>
                <input type="text" id="a_local" class="form-input">
            </div>
            <div class="form-group">
                <label>Observação</label>
                <input type="text" id="a_obs" class="form-input">
            </div>
            <button type="submit" class="btn-add" style="width:100%">Salvar na Agenda</button>
        </form>
    `;
    document.getElementById('modalForm').classList.remove('hidden');
}

async function salvarEventoPastor(e) {
    e.preventDefault();
    const payload = {
        DATA: document.getElementById('a_data').value,
        HORARIO: document.getElementById('a_hora').value,
        EVENTO: document.getElementById('a_evento').value,
        LOCAL: document.getElementById('a_local').value,
        OBSERVACAO: document.getElementById('a_obs').value
    };

    try {
        await fetch(`${API_BASE}/agenda-pastor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'admin_secret' },
            body: JSON.stringify(payload)
        });
        fecharModal();
        carregarGestaoAgendaPastor();
    } catch (err) { alert('Erro ao salvar'); }
}

async function deletarEventoPastor(id) {
    if(!confirm("Excluir este compromisso?")) return;
    try {
        await fetch(`${API_BASE}/agenda-pastor/${id}`, { 
            method: 'DELETE', 
            headers: { 'x-admin-token': 'admin_secret' }
        });
        carregarGestaoAgendaPastor();
    } catch (e) { alert("Erro ao deletar"); }
}

// ==========================================
// 3. VISÃO DO PASTOR / MEMBRO
// ==========================================
async function carregarVisaoPastor() {
    const container = document.getElementById('mainContainer');
    container.innerHTML = '<div class="panel-card"><p>Carregando agendas...</p></div>';

    try {
        const [resPastor, resIgreja] = await Promise.all([
            fetch(`${API_BASE}/agenda-pastor`),
            fetch(`${API_BASE}/patrimonio/dados`)
        ]);
        const agendaPastor = await resPastor.json();
        const dadosIgreja = await resIgreja.json();

        container.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <div class="panel-card" style="border-top: 4px solid #3b82f6;">
                    <div class="panel-title">👔 Meus Compromissos</div>
                    ${renderListaSimples(agendaPastor, 'pessoal')}
                </div>
                <div class="panel-card" style="border-top: 4px solid #dc2626;">
                    <div class="panel-title">⛪ Agenda da Igreja</div>
                    ${renderListaSimples(dadosIgreja.agenda, 'igreja')}
                </div>
            </div>
        `;
    } catch (e) { container.innerHTML = 'Erro ao carregar'; }
}

function renderListaSimples(lista, tipo) {
    if(!lista || lista.length === 0) return '<p>Nada agendado.</p>';
    
    lista.sort((a,b) => parseDate(a.DATA||a.data) - parseDate(b.DATA||b.data));

    return lista.map(i => {
        const data = i.DATA || i.data;
        const titulo = i.EVENTO || i.evento;
        const extra = tipo === 'pessoal' ? (i.LOCAL || '') : (i.local || '');
        return `
            <div style="padding:10px; border-bottom:1px solid #eee; display:flex; gap:10px;">
                <div style="font-weight:bold; color:${tipo==='pessoal'?'#2563eb':'#dc2626'}; min-width:80px;">${data}</div>
                <div>
                    <div style="font-weight:600;">${titulo}</div>
                    <div style="font-size:0.85rem; color:#64748b;">${extra}</div>
                </div>
            </div>
        `;
    }).join('');
}

function carregarVisaoSecretaria() {
    document.getElementById('mainContainer').innerHTML = `
        <div class="panel-card">
            <h2>Olá, Secretaria</h2>
            <p>Use o menu lateral para gerenciar os membros e a agenda pastoral.</p>
        </div>
    `;
}

function carregarVisaoMembro() {
     document.getElementById('mainContainer').innerHTML = `
        <div class="panel-card">
            <h2>Olá, ${usuario.NOME}</h2>
            <p>Bem-vindo ao seu portal.</p>
            <p><strong>Cargo:</strong> ${usuario.CARGO}</p>
        </div>
    `;
}

// Utilitários
function fecharModal() { document.getElementById('modalForm').classList.add('hidden'); }
function abrirEBD() { window.location.href = '/'; }
function parseDate(str) { if(!str) return new Date(0); const p = str.split('/'); return new Date(p[2], p[1]-1, p[0]); }
