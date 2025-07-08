// Configuração da API
// Para desenvolvimento local, use a URL completa, ex: 'http://localhost:5000' (se o Flask rodar na porta 5000)
// Para produção na Vercel, use string vazia para que as requisições sejam feitas para o mesmo domínio
const API_BASE_URL = ''; 

// Estado da aplicação
let currentTab = 'scale';
let selectedTrimester = 'all';
let selectedClass = 'Todas as Classes';
let scheduleData = null; 
let lessonsData = [];

// Um mapa global (ou passado como argumento) para guardar os temas gerais por classe e trimestre
let globalThemesMap = {}; 

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    // Decide qual conteúdo carregar primeiro com base na aba ativa padrão
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    if (currentTab === 'scale') {
        loadScheduleData();
    } else {
        loadLessonsData();
    }
});

// Event Listeners
function setupEventListeners() {
    // Navegação entre abas
    document.getElementById('scaleTab').addEventListener('click', () => switchTab('scale'));
    document.getElementById('lessonsTab').addEventListener('click', () => switchTab('lessons'));
    
    // Filtros
    document.getElementById('trimesterSelect').addEventListener('change', (e) => {
        selectedTrimester = e.target.value;
        if (currentTab === 'scale') {
            renderSchedule(); // Renderiza com os dados já carregados
        } else {
            renderLessons(); // Renderiza com os dados de lições (que já deveriam estar em lessonsData)
        }
    });
    
    document.getElementById('classSelect').addEventListener('change', (e) => {
        selectedClass = e.target.value;
        if (currentTab === 'scale') {
            loadScheduleData(); // Recarrega os dados da escala se a classe mudar
        }
        // As lições podem não precisar recarregar, dependendo se o filtro de classe for aplicado a elas
        // Se as lições tiverem filtro por classe, você precisará adaptar loadLessonsData e renderLessons
    });
}

// Navegação entre abas
function switchTab(tab) {
    currentTab = tab;
    
    // Atualizar botões
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    if (tab === 'scale') {
        document.getElementById('scaleTab').classList.add('active');
        document.getElementById('scaleContent').classList.remove('hidden');
        document.getElementById('lessonsContent').classList.add('hidden');
        loadScheduleData(); // Garante que os dados da escala sejam carregados ao mudar para esta aba
    } else {
        document.getElementById('lessonsTab').classList.add('active');
        document.getElementById('scaleContent').classList.add('hidden');
        document.getElementById('lessonsContent').classList.remove('hidden');
        loadLessonsData(); // Garante que os dados das lições sejam carregados ao mudar para esta aba
    }
}

// Carregar dados da API de Escala
async function loadScheduleData() {
    const scheduleContainer = document.getElementById('scheduleContainer');

    if (selectedClass === 'Todas as Classes') {
        scheduleContainer.innerHTML = `
            <div class="empty-state">
                <p style="font-size: 1.125rem;">Selecione uma classe específica para visualizar a escala.</p>
            </div>
        `;
        scheduleData = null;
        globalThemesMap = {}; // Limpa o mapa de temas também
        return;
    }
    
    // Mostrar loading
    scheduleContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Carregando escala de professores...</p>
        </div>
    `;
    
    try {
        const formData = new FormData();
        formData.append('classe', selectedClass);
        
        const response = await fetch(`${API_BASE_URL}/api/schedule`, {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) {
            throw new Error(`Erro na API de Escalas: ${response.status} - ${await response.text()}`);
        }
        
        scheduleData = await response.json(); // Carrega os dados, incluindo a chave 'temas'
        
        // Populando o globalThemesMap a partir dos dados recebidos
        globalThemesMap = {}; 
        if (scheduleData.temas) {
            scheduleData.temas.forEach(t => {
                const trimesterNum = String(t.TRIMESTRE).split(' ')[0]; // Garante que TRIMESTRE é string antes de split
                globalThemesMap[`${trimesterNum}-${t.CLASSE}`] = t.TEMA;
            });
        }

        renderSchedule();
        
    } catch (error) {
        console.error('Erro ao carregar dados da escala:', error);
        scheduleContainer.innerHTML = `
            <div class="empty-state">
                <p style="font-size: 1.125rem; color: red;">Erro ao carregar escala: ${error.message}. Tente novamente mais tarde.</p>
            </div>
        `;
        scheduleData = null;
        globalThemesMap = {}; // Reseta o mapa em caso de erro
    }
}


// Renderizar escala (usa os dados já carregados em scheduleData)
function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    if (!scheduleData) {
        // Se scheduleData for null (ex: "Todas as Classes" selecionado ou erro anterior)
        // A mensagem de "Selecione uma classe" ou erro já deve estar lá.
        return; 
    }
    
    const scheduleItems = convertApiDataToScheduleItems(scheduleData);
    const filteredData = filterScheduleData(scheduleItems); // Filtra por trimestre

    if (filteredData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p style="font-size: 1.125rem;">Nenhuma escala encontrada para os filtros selecionados.</p>
            </div>
        `;
        return;
    }
    
    const groupedData = groupScheduleData(filteredData);
    container.innerHTML = renderScheduleCards(groupedData);
}

// Converter dados da API para o formato que o renderScheduleCards espera
function convertApiDataToScheduleItems(apiData) {
    const allItems = [];
    
    [1, 2, 3, 4].forEach(trimesterNum => {
        const trimesterKey = `trimestre_${trimesterNum}`;
        const trimesterData = apiData[trimesterKey] || [];
        
        trimesterData.forEach((item, index) => {
            allItems.push({
                id: `${trimesterNum}-${index}`,
                date: item.DATA,
                teacher: item.PROFESSOR,
                lesson: item.LIÇÃO,
                lessonNumber: index + 1,
                trimester: trimesterNum,
                theme: item.TEMA, // AQUI: Mantém o tema específico da lição, vindo da planilha de escala
                class: apiData.classe || selectedClass 
            });
        });
    });
    
    return allItems;
}

// Filtrar dados da escala por trimestre (a classe já foi filtrada pela API)
function filterScheduleData(scheduleItems) {
    return scheduleItems.filter(item => {
        return selectedTrimester === 'all' || item.trimester.toString() === selectedTrimester;
    });
}

// Agrupar dados da escala
function groupScheduleData(filteredData) {
    const grouped = {};
    
    filteredData.forEach(item => {
        const key = `${item.trimester}-${item.class}`; 
        if (!grouped[key]) {
            grouped[key] = {
                trimester: item.trimester,
                class: item.class,
                // AQUI: Pega o tema GERAL do trimestre/classe do mapa global
                theme: globalThemesMap[`${item.trimester}-${item.class}`] || 'Tema do Trimestre',
            };
            grouped[key].lessons = [];
        }
        grouped[key].lessons.push(item);
    });
    
    // Ordenar lições por número da aula
    Object.values(grouped).forEach(group => {
        group.lessons.sort((a, b) => {
            // Se 'DATA' for uma string no formato 'DD/MM', converta para um formato comparável
            const parseDate = (d) => {
                const parts = d.split('/');
                return new Date(2000, parseInt(parts[1]) - 1, parseInt(parts[0])); // Ano fictício, apenas para comparação
            };
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            return dateA - dateB;
        });
    });

    return grouped;
}

// Renderizar cards da escala
function renderScheduleCards(groupedData) {
    // Ordena os grupos por número do trimestre para exibição
    const sortedGroups = Object.values(groupedData).sort((a, b) => a.trimester - b.trimester);

    return sortedGroups.map(group => `
        <div class="schedule-card">
            <div class="schedule-header">
                <div class="schedule-header-content">
                    <h3 class="schedule-class-name">${group.class}</h3>
                    <div class="schedule-info">
                        <span class="badge badge-trimester-${group.trimester}">
                            ${group.trimester}º Trimestre
                        </span>
                        <span class="schedule-theme">${group.theme}</span>
                    </div>
                </div>
            </div>
            <div class="table-container">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>Aula</th>
                            <th>Data</th>
                            <th>Professor</th>
                            <th>Lição</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.lessons.map(lesson => `
                            <tr>
                                <td class="lesson-number">Lição ${lesson.lessonNumber}</td>
                                <td>${formatDate(lesson.date)}</td>
                                <td class="teacher-name">${lesson.teacher}</td>
                                <td>${lesson.theme}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

// Formatar data (melhorada para ser mais robusta)
function formatDate(dateString) {
    try {
        // Tenta parsing de YYYY-MM-DD ou DD/MM/YYYY
        const parts = dateString.split('/');
        let date;
        if (parts.length === 3) {
            // Assume DD/MM/YYYY
            date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
            // Tenta como está (espera YYYY-MM-DD ou formato reconhecido)
            date = new Date(dateString);
        }

        if (isNaN(date.getTime())) {
            return dateString; // Retorna original se inválido
        }
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit'
        });
    } catch {
        return dateString;
    }
}

// Carregar dados da API de Lições
async function loadLessonsData() {
    const container = document.getElementById('lessonsContainer');
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Carregando lições...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/api/lessons`); // Rota da API para lições
        if (!response.ok) {
            throw new Error(`Erro na API de Lições: ${response.status} - ${await response.text()}`);
        }
        lessonsData = await response.json(); // Armazena os dados das lições
        renderLessons(); // Renderiza as lições com os dados carregados
    } catch (error) {
        console.error('Erro ao carregar lições:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p style="font-size: 1.125rem; color: red;">Erro ao carregar lições: ${error.message}. Tente novamente mais tarde.</p>
            </div>
        `;
        lessonsData = []; // Reseta os dados em caso de erro
    }
}

// Renderizar lições (usa os dados já carregados em lessonsData)
function renderLessons() {
    const container = document.getElementById('lessonsContainer');
    if (lessonsData.length === 0 && currentTab === 'lessons') {
        // Se não há dados e estamos na aba de lições, significa que houve um erro ou ainda não carregou
        // A mensagem de loading ou erro já deve estar no container
        return; 
    }

    const filteredLessons = lessonsData.filter(lesson => {
        // Se a classe também for um filtro para lições, adicione aqui:
        // const classMatch = selectedClass === 'Todas as Classes' || lesson.class === selectedClass;
        // return (selectedTrimester === 'all' || lesson.trimester.toString() === selectedTrimester) && classMatch;
        return selectedTrimester === 'all' || lesson.trimester.toString() === selectedTrimester;
    });
    
    if (filteredLessons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                <p style="font-size: 1.125rem;">Nenhuma lição encontrada para o trimestre selecionado.</p>
            </div>
        `;
        return;
    }
    
    const groupedByTrimester = groupLessonsByTrimester(filteredLessons);
    container.innerHTML = renderLessonsGrid(groupedByTrimester);
}

// Agrupar lições por trimestre
function groupLessonsByTrimester(lessons) {
    const grouped = {};
    lessons.forEach(lesson => {
        if (!grouped[lesson.trimester]) {
            grouped[lesson.trimester] = [];
        }
        grouped[lesson.trimester].push(lesson);
    });
    // Opcional: ordenar os trimestres
    return grouped;
}

// Renderizar grid de lições
function renderLessonsGrid(groupedByTrimester) {
    return Object.entries(groupedByTrimester)
        .sort(([a], [b]) => parseInt(a) - parseInt(b)) // Garante ordem numérica dos trimestres
        .map(([trimester, lessons]) => `
            <div class="lessons-section">
                <div class="lessons-section-header">
                    <span class="badge badge-trimester-${trimester}">${trimester}º Trimestre</span>
                    <h3 class="lessons-section-title">Lições e Materiais</h3>
                </div>
                <div class="lessons-grid">
                    ${lessons.map(lesson => `
                        <div class="lesson-card" onclick="openLesson('${lesson.driveLink}')">
                            <div class="lesson-image">
                                <img src="${lesson.coverImage}" alt="${lesson.title}">
                                <div class="lesson-badges">
                                    <span class="badge badge-type-${lesson.type}">
                                        ${lesson.type === 'professor' ? '👨‍🏫 Professor' : '👥 Aluno'}
                                    </span>
                                    <span class="badge badge-class">${lesson.class}</span>
                                </div>
                                <div class="lesson-overlay">
                                    <svg class="lesson-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                                    </svg>
                                </div>
                            </div>
                            <div class="lesson-content">
                                <h4 class="lesson-title">${lesson.title}</h4>
                                <p class="lesson-theme">${lesson.theme}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
}

// Abrir lição no Drive
function openLesson(driveLink) {
    if (driveLink && driveLink !== 'undefined') { // Verifica se o link é válido
        window.open(driveLink, '_blank');
    } else {
        alert('Link da lição não disponível!');
    }
}