const usuario = JSON.parse(sessionStorage.getItem('usuario_sistema'));
if(!usuario) window.location.href = '/login';

document.getElementById('nomeUsuario').innerText = usuario.NOME.split(' ')[0];

function sair() {
    sessionStorage.clear();
    window.location.href = '/login';
}

function mostrarMeusDados() {
    document.getElementById('areaDados').style.display = 'block';
    const form = document.getElementById('formDados');
    
    // Gera os campos automaticamente (Read-Only)
    let html = '';
    for (const [key, value] of Object.entries(usuario)) {
        if(key === 'ID' || key === 'SENHA') continue;
        html += `
            <div class="form-group">
                <label>${key.replace('_', ' ')}</label>
                <input class="form-input" value="${value || '-'}" disabled>
            </div>
        `;
    }
    form.innerHTML = html;
    
    // Rola até os dados
    document.getElementById('areaDados').scrollIntoView({behavior: 'smooth'});
}

function fecharMeusDados() {
    document.getElementById('areaDados').style.display = 'none';
}
