const usuario = JSON.parse(sessionStorage.getItem('usuario_sistema'));
if(!usuario || (usuario.PERFIL !== 'ADMIN' && usuario.PERFIL !== 'SECRETARIA')) {
    window.location.href = '/login';
}

function sair() {
    sessionStorage.clear();
    window.location.href = '/login';
}

function mostrarMeusDados() {
    const div = document.getElementById('meusDadosSec');
    const form = document.getElementById('formSec');
    div.style.display = 'block';
    
    let html = '';
    for (const [key, value] of Object.entries(usuario)) {
        if(key === 'ID' || key === 'SENHA') continue;
        html += `
            <div class="form-group">
                <label>${key}</label>
                <input class="form-input" value="${value || ''}" disabled>
            </div>
        `;
    }
    form.innerHTML = html;
}
