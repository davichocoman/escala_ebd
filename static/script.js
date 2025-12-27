// Configuração da API
// IMPORTANTE: Use a URL do seu Render aqui
const API_BASE_URL = 'https://api-escala.onrender.com'; // <-- Cole sua URL do Render aqui se mudou

// Estado da aplicação
let currentTab = 'scale';
let selectedTrimester = 'all';
let selectedClass = 'Todas as Classes';
let scheduleData = null; 
let lessonsData = [];
let globalThemesMap = {}; 

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Carrega o conteúdo inicial
    if (currentTab === 'scale') {
        // Se não tem classe selecionada, carrega o Visão Geral
        if (selectedClass === 'Todas as Classes' || selectedClass === '') {
            loadGeneralOverview();
        } else {
            loadScheduleData();
        }
    } else {
        loadLessonsData();
    }
});

// --- Lógica de Datas ---
function getNextSunday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayOfWeek = today.getDay(); // 0 = Domingo
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    
    const day = String(nextSunday.getDate()).padStart(2, '0');
    const month = String(nextSunday.getMonth() + 1).padStart(2, '0');
    
    return `${day}/${month}`;
}

// --- Event Listeners ---
function setupEventListeners() {
    document.getElementById('scaleTab').addEventListener('click', () => switchTab('scale'));
    document.getElementById('lessonsTab').addEventListener('click', () => switchTab('lessons'));
    
    document.getElementById('trimesterSelect').addEventListener('change', (e) => {
        selectedTrimester = e.target.value;
        if (currentTab === 'scale') {
            if (selectedClass === 'Todas as Classes' || selectedClass === '') {
                // Se mudar trimestre na visão geral, não afeta a escala da semana (que é data fixa), 
                // mas podemos recarregar por garantia.
                return; 
            }
            renderSchedule(); 
        } else {
            renderLessons(); 
        }
    });
    
    document.getElementById('classSelect').addEventListener('change', (e) => {
        selectedClass = e.target.value;
        if (currentTab === 'scale') {
            if (selectedClass === '' || selectedClass === 'Todas as Classes') {
                loadGeneralOverview(); // Volta para o painel geral
            } else {
                loadScheduleData(); // Carrega classe específica
            }
        }
    });
}

function switchTab(tab) {
    currentTab = tab;
    
    // Atualiza botões
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    
    // Referência ao container do filtro de classe
    const classFilter = document.getElementById('classFilterContainer');

    if (tab === 'scale') {
        document.getElementById('scaleTab').classList.add('active');
        document.getElementById('scaleContent').classList.remove('hidden');
        document.getElementById('lessonsContent').classList.add('hidden');
        
        // MOSTRA o filtro de classe na aba Escala
        if (classFilter) classFilter.style.display = 'block';

        if (selectedClass === 'Todas as Classes' || selectedClass === '') {
            loadGeneralOverview();
        } else if (!scheduleData) {
            loadScheduleData();
        }
    } else {
        document.getElementById('lessonsTab').classList.add('active');
        document.getElementById('scaleContent').classList.add('hidden');
        document.getElementById('lessonsContent').classList.remove('hidden');
        
        // ESCONDE o filtro de classe na aba Lições
        if (classFilter) classFilter.style.display = 'none';

        if (lessonsData.length === 0) {
            loadLessonsData();
        }
    }
}

// --- NOVA FUNÇÃO: Visão Geral da Semana (Dashboard) ---
async function loadGeneralOverview() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    const highlightContainer = document.getElementById('highlightContainer');
    
    // Limpa destaque individual se houver
    highlightContainer.innerHTML = '';

    scheduleContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Carregando escala geral da semana...</p>
        </div>
    `;

    try {
        // 1. Pega todas as classes disponíveis no <select> do HTML
        const select = document.getElementById('classSelect');
        const options = Array.from(select.options)
            .map(opt => opt.value)
            .filter(val => val !== '' && val !== 'Todas as Classes'); // Remove a opção padrão

        const targetDate = getNextSunday();
        const overviewData = [];

        // 2. Dispara requisições para todas as classes ao mesmo tempo (Promise.all)
        // Isso é mais rápido do que buscar uma por uma
        const promises = options.map(async (className) => {
            const formData = new FormData();
            formData.append('classe', className);
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/schedule`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) return null;
                
                const data = await response.json();
                const items = convertApiDataToScheduleItems(data);
                
                // Filtra apenas a lição da data alvo
                const match = items.find(item => item.date === targetDate);
                if (match) {
                    return { ...match, className: className }; // Adiciona o nome da classe
                }
                return null;
            } catch (err) {
                console.warn(`Erro ao carregar ${className}:`, err);
                return null;
            }
        });

        const results = await Promise.all(promises);
        
        // Limpa nulls e organiza
        const validResults = results.filter(item => item !== null);

        // 3. Renderiza o Dashboard
        if (validResults.length === 0) {
            scheduleContainer.innerHTML = `
                <div class="empty-state">
                    <p>Nenhuma aula encontrada para o próximo domingo (${targetDate}).</p>
                    <small>Selecione uma classe específica acima para ver todo o trimestre.</small>
                </div>
            `;
        } else {
            renderOverviewTable(validResults, targetDate);
        }

    } catch (error) {
        console.error("Erro no overview:", error);
        scheduleContainer.innerHTML = `<p class="error">Erro ao carregar visão geral.</p>`;
    }
}

// Função para desenhar a tabela do Dashboard
function renderOverviewTable(items, date) {
    const container = document.getElementById('scheduleContainer');
    
    // Ordena por nome da classe (A-Z)
    items.sort((a, b) => a.className.localeCompare(b.className));

    const html = `
        <div class="overview-container">
            <div class="overview-header">
                <h3>Escala Geral da Semana</h3>
                <span class="badge" style="background: #ea580c; color: white;">Domingo: ${date}</span>
            </div>
            <p style="text-align: center; color: #666; margin-bottom: 1.5rem;">
                Confira abaixo os professores escalados para este domingo em todas as classes.
            </p>
            
            <div class="table-container shadow-card">
                <table class="schedule-table overview-table">
                    <thead>
                        <tr>
                            <th>Classe</th>
                            <th>Lição / Tema</th>
                            <th>Professor(a)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td class="font-bold class-col">${item.className}</td>
                                <td>
                                    <div class="lesson-cell">
                                        <span class="lesson-tag">${item.lesson}</span>
                                        <span class="theme-text">${item.theme}</span>
                                    </div>
                                </td>
                                <td class="teacher-name teacher-col">${item.teacher}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// --- API: Escala Individual (Lógica Antiga Mantida) ---
async function loadScheduleData() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    const highlightContainer = document.getElementById('highlightContainer');
    
    // Loading state
    scheduleContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Carregando escala da classe ${selectedClass}...</p>
        </div>
    `;
    highlightContainer.innerHTML = ''; 
    
    try {
        const formData = new FormData();
        formData.append('classe', selectedClass);
        
        const response = await fetch(`${API_BASE_URL}/api/schedule`, {
            method: 'POST',
            body: formData,
        });
        
        if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
        
        scheduleData = await response.json(); 
        
        // Popula mapa de temas
        globalThemesMap = {}; 
        if (scheduleData.temas) {
            scheduleData.temas.forEach(t => {
                const trimesterNum = String(t.TRIMESTRE).split(' ')[0];
                globalThemesMap[`${trimesterNum}-${t.CLASSE}`] = t.TEMA;
            });
        }
        renderSchedule();
        
    } catch (error) {
        console.error('Erro:', error);
        scheduleContainer.innerHTML = `<div class="empty-state"><p>Erro ao carregar escala.</p></div>`;
    }
}

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    if (!scheduleData) return;
    
    const scheduleItems = convertApiDataToScheduleItems(scheduleData);
    const filteredData = filterScheduleData(scheduleItems); 

    // Renderiza destaque individual
    renderNextSundayCard(scheduleItems);

    if (filteredData.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Nenhuma escala para este filtro.</p></div>`;
        return;
    }
    
    const groupedData = groupScheduleData(filteredData);
    container.innerHTML = renderScheduleCards(groupedData);
}

function renderNextSundayCard(scheduleItems) {
    const targetDate = getNextSunday();
    const container = document.getElementById('highlightContainer');
    const lessonsThisWeek = scheduleItems.filter(item => item.date === targetDate);

    if (lessonsThisWeek.length > 0) {
        const item = lessonsThisWeek[0];
        container.innerHTML = `
            <div class="schedule-card highlight-card">
                <div class="schedule-header highlight-header">
                    <div class="schedule-header-content">
                        <div>
                            <span class="badge highlight-badge">Próxima Aula: ${targetDate}</span>
                            <h3 class="schedule-class-name" style="color: #9a3412;">${item.class}</h3>
                        </div>
                    </div>
                </div>
                <div class="table-container">
                    <table class="schedule-table">
                        <tbody>
                            <tr>
                                <td style="padding: 1rem;">
                                    <div class="label-sm">Professor(a)</div>
                                    <div class="value-lg">${item.teacher}</div>
                                </td>
                                <td style="padding: 1rem;">
                                    <div class="label-sm">Lição</div>
                                    <div class="value-lg">${item.theme}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = '';
    }
}

// --- Helpers e Funções Utilitárias ---
function convertApiDataToScheduleItems(apiData) {
    const allItems = [];
    [1, 2, 3, 4].forEach(trimesterNum => {
        const trimesterKey = `trimestre_${trimesterNum}`;
        const trimesterData = apiData[trimesterKey] || [];
        trimesterData.forEach((item, index) => {
            if(item.DATA && item.PROFESSOR) {
                allItems.push({
                    id: `${trimesterNum}-${index}`,
                    date: String(item.DATA),
                    teacher: item.PROFESSOR,
                    lesson: item.LIÇÃO,
                    lessonNumber: index + 1,
                    trimester: trimesterNum,
                    theme: item.TEMA,
                    class: apiData.classe || selectedClass 
                });
            }
        });
    });
    return allItems;
}

function filterScheduleData(scheduleItems) {
    return scheduleItems.filter(item => {
        return selectedTrimester === 'all' || item.trimester.toString() === selectedTrimester;
    });
}

function groupScheduleData(filteredData) {
    const grouped = {};
    filteredData.forEach(item => {
        const key = `${item.trimester}-${item.class}`; 
        if (!grouped[key]) {
            grouped[key] = {
                trimester: item.trimester,
                class: item.class,
                theme: globalThemesMap[`${item.trimester}-${item.class}`] || 'Tema do Trimestre',
                lessons: []
            };
        }
        grouped[key].lessons.push(item);
    });
    return grouped;
}

function renderScheduleCards(groupedData) {
    const sortedGroups = Object.values(groupedData).sort((a, b) => a.trimester - b.trimester);
    return sortedGroups.map(group => `
        <div class="schedule-card">
            <div class="schedule-header">
                <div class="schedule-header-content">
                    <h3 class="schedule-class-name">${group.class}</h3>
                    <div class="schedule-info">
                        <span class="badge badge-trimester-${group.trimester}">${group.trimester}º Trimestre</span>
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
                                <td class="lesson-number">${lesson.lesson}</td>
                                <td>${lesson.date}</td>
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

// --- API: Lições ---
async function loadLessonsData() {
    const container = document.getElementById('lessonsContainer');
    if (lessonsData.length > 0) { renderLessons(); return; }
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando materiais...</p></div>`;
    try {
        const response = await fetch(`${API_BASE_URL}/api/lessons`);
        if (!response.ok) throw new Error('Falha ao buscar lições');
        lessonsData = await response.json();
        renderLessons();
    } catch (error) {
        console.error('Erro:', error);
        container.innerHTML = `<div class="empty-state"><p style="color: red;">Erro ao carregar lições.</p></div>`;
    }
}

function renderLessons() {
    const container = document.getElementById('lessonsContainer');
    const filteredLessons = lessonsData.filter(lesson => selectedTrimester === 'all' || lesson.trimester.toString() === selectedTrimester);
    if (filteredLessons.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Nenhum material encontrado.</p></div>`;
        return;
    }
    const groupedByTrimester = {};
    filteredLessons.forEach(lesson => {
        if (!groupedByTrimester[lesson.trimester]) groupedByTrimester[lesson.trimester] = [];
        groupedByTrimester[lesson.trimester].push(lesson);
    });
    container.innerHTML = Object.entries(groupedByTrimester)
        .sort(([a], [b]) => a - b)
        .map(([trimester, lessons]) => `
            <div class="lessons-section">
                <div class="lessons-section-header"><span class="badge badge-trimester-${trimester}">${trimester}º Trimestre</span></div>
                <div class="lessons-grid">
                    ${lessons.map(lesson => `
                        <div class="lesson-card" onclick="window.open('${lesson.driveLink}', '_blank')">
                            <div class="lesson-image">
                                ${lesson.coverImage ? `<img src="${lesson.coverImage}" alt="${lesson.title}">` : '<div style="color:#ccc;">Sem Imagem</div>'}
                                <div class="lesson-overlay"><span style="color:white; font-weight:bold;">Abrir Material</span></div>
                            </div>
                            <div class="lesson-content">
                                <div class="lesson-badges-bottom"><span class="badge badge-type-${lesson.type}">${lesson.type.toUpperCase()}</span></div>
                                <h4 class="lesson-title">${lesson.title}</h4>
                                <p class="lesson-theme">${lesson.theme}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
}
