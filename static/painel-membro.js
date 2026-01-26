const API_BASE = 'https://api-escala.onrender.com/api';

// Estado global
let usuario = null;

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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // 1. Recupera usuário da sessão
    const userStr = sessionStorage.getItem('usuario_sistema');
    if (!userStr) {
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

    usuario = JSON.parse(userStr);

    // 2. Mostra nome no header da sidebar
    const nome = getVal(usuario, 'NOME') ? getVal(usuario, 'NOME').split(' ')[0] : 'Membro';
    const display = document.getElementById('userDisplay');
    if (display) display.innerHTML = `Olá, <strong>${nome}</strong><br><small>Membro</small>`;

    // 3. Renderiza os dados imediatamente (única tela)
    renderizarMeusDados();
});

// ============================================================
// Renderização
// ============================================================
function renderizarMeusDados() {
    const container = document.getElementById('form-meus-dados');
    if (!container || !usuario) return;

    // 1. Definição das Seções para organizar o visual
    const secoes = [
        {
            titulo: 'Informações Básicas',
            campos: [
                { key: 'NOME', label: 'Nome Completo', span: 8 },
                { key: 'NASCIMENTO', label: 'Data de Nascimento', span: 4 },
                { key: 'CPF', label: 'CPF', span: 4 },
                { key: 'ESTADO_CIVIL', label: 'Estado Civil', span: 4 },
                { key: 'CONTATO', label: 'WhatsApp/Telefone', span: 4 }
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
                { key: 'CARGO', label: 'Cargo Atual', span: 6 },
                { key: 'DEPARTAMENTO', label: 'Departamento', span: 6 }
            ]
        }
    ];

    container.innerHTML = '';

    secoes.forEach(secao => {
        // Verifica se a seção tem algum dado preenchido para não mostrar título vazio
        const temDados = secao.campos.some(c => getVal(usuario, c.key));
        if (!temDados) return;

        // Adiciona Título da Seção
        container.innerHTML += `<div class="section-title-bar">${secao.titulo}</div>`;

        secao.campos.forEach(campo => {
            let valor = getVal(usuario, campo.key);
            if (!valor) return; // Pula se estiver vazio

            // Tratamento especial para listas (Filhos)
            if (campo.isList && valor.includes(',')) {
                valor = valor.split(',')
                    .map(item => `<span class="list-bullet">Vocês • ${item.trim()}</span>`)
                    .join('');
            }

            container.innerHTML += `
                <div class="form-group" style="grid-column: span ${campo.span}">
                    <label>${campo.label}</label>
                    <div class="valor-box ${campo.isList ? 'list-mode' : ''}">
                        ${valor}
                    </div>
                </div>
            `;
        });
    });
}
// ============================================================
// Navegação e Sidebar
// ============================================================
window.mostrarTela = function(telaId, btn) {
    // Como só tem uma tela visível, não precisa esconder outras
    // Mas mantemos o padrão para futura expansão
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Fecha sidebar no mobile
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth < 768) {
        sidebar.classList.remove('open');
    }
};

// Toggle sidebar + overlay
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

// Fecha sidebar ao clicar em item no mobile
document.addEventListener('click', function(e) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    if (e.target.closest('.menu-item') &&
        sidebar.classList.contains('open') &&
        window.innerWidth < 768) {
        toggleSidebar();
    }
});

// Fecha com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            toggleSidebar();
        }
    }
});

// ============================================================
// Logout com confirmação
// ============================================================
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
