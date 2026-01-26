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
// --- Funções Auxiliares de Formatação ---
const formatarCPF = (valor) => {
    const cpf = valor.toString().replace(/\D/g, '').padStart(11, '0');
    return cpf.replace(/(\={3})(\={3})(\={3})(\={2})/, "$1.$2.$3-$4")
              .replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
};

const formatarData = (valor) => {
    if (!valor) return '';
    // Se a data já estiver no formato DD/MM/YYYY, apenas retorna
    if (valor.includes('/') && valor.split('/').length === 3) return valor;
    
    // Caso venha do banco como YYYY-MM-DD (padrão ISO)
    const data = new Date(valor);
    if (isNaN(data)) return valor;
    return data.toLocaleDateString('pt-BR');
};

function renderizarMeusDados() {
    const container = document.getElementById('form-meus-dados');
    if (!container || !usuario) return;

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
                { key: 'CARGO', label: 'Cargo Atual', span: 6 },
                { key: 'DEPARTAMENTO', label: 'Departamento', span: 6 }
            ]
        }
    ];

    container.innerHTML = '';

    secoes.forEach(secao => {
        const temDados = secao.campos.some(c => getVal(usuario, c.key));
        if (!temDados) return;

        container.innerHTML += `<div class="section-title-bar">${secao.titulo}</div>`;

        secao.campos.forEach(campo => {
            let valor = getVal(usuario, campo.key);
            if (!valor) return;

            let htmlConteudo = '';

            // --- APLICAÇÃO DAS MÁSCARAS ---
            if (campo.isCPF) {
                htmlConteudo = `<span class="data-pill">${formatarCPF(valor)}</span>`;
            } 
            else if (campo.isDate) {
                htmlConteudo = `<span class="data-pill">${formatarData(valor)}</span>`;
            }
            else if (campo.isList && valor.toString().includes(',')) {
                htmlConteudo = valor.split(',')
                    .map(item => `<span class="data-pill">${item.trim()}</span>`)
                    .join('');
            } 
            else {
                htmlConteudo = `<span class="data-pill">${valor}</span>`;
            }

            container.innerHTML += `
                <div class="form-group" style="grid-column: span ${campo.span}">
                    <label>${campo.label}</label>
                    <div class="valor-box">
                        ${htmlConteudo}
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
