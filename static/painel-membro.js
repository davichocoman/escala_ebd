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
function renderizarMeusDados(dados) {
    const container = document.querySelector('.form-grid');
    container.innerHTML = '';

    Object.entries(dados).forEach(([key, valor]) => {

        // Ignora campos vazios ou nulos
        if (valor === null || valor === undefined || valor === '') return;

        const keyUpper = key.toUpperCase();
        let sizeClass = 'form-group';

        /* -----------------------------
           Definição de tamanho do campo
        ------------------------------*/

        // Campos longos (linha inteira)
        if (
            keyUpper === 'FILHOS' ||
            keyUpper.includes('CARGO') ||
            keyUpper.includes('OBSERVA') ||
            keyUpper.includes('DESCR')
        ) {
            sizeClass += ' long-field';
        }

        // Campos médios (meia linha)
        else if (
            keyUpper === 'PAI' ||
            keyUpper === 'MAE'
        ) {
            sizeClass += ' medium';
        }

        /* -----------------------------
           Tratamento de valores em lista
        ------------------------------*/

        if (
            sizeClass.includes('long-field') &&
            typeof valor === 'string' &&
            valor.includes(',')
        ) {
            valor = valor
                .split(',')
                .map(item => item.trim())
                .filter(Boolean)
                .map(item => `• ${item}`)
                .join('<br>');
        }

        /* -----------------------------
           Label amigável
        ------------------------------*/

        const label = key
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, l => l.toUpperCase());

        /* -----------------------------
           Renderização final
        ------------------------------*/

        container.innerHTML += `
            <div class="${sizeClass}">
                <label>${label}</label>
                <div class="valor-box ${sizeClass.includes('long-field') ? 'special' : ''}">
                    ${valor}
                </div>
            </div>
        `;
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
