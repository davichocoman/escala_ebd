// Configuração da API
// IMPORTANTE: Use a URL do seu Render aqui
const API_BASE_URL = 'https://api-escala.onrender.com'; // <-- Cole sua URL do Render aqui se mudou

// Estado da aplicação
let currentTab = 'scale';
let selectedTrimester = 'all';
let selectedClass = 'Todas as Classes';
// Caches em memória
let scheduleData = null; 
let lessonsData = [];
let videosData = [];
let libraryData = [];

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // Inicia na escala
    loadGeneralOverview();
    const modal = document.getElementById('videoModal');
        if(modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeVideoModal();
                }
            });
        }
        
        // Fecha com a tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                closeVideoModal();
            }
        });
    document.getElementById('globalSearch').addEventListener('keyup', handleSearch);
});

// --- Lógica de Navegação ---
function setupEventListeners() {
    // Cliques nas abas
    document.getElementById('scaleTab').addEventListener('click', () => switchTab('scale'));
    document.getElementById('lessonsTab').addEventListener('click', () => switchTab('lessons'));
    document.getElementById('videosTab').addEventListener('click', () => switchTab('videos'));
    document.getElementById('libraryTab').addEventListener('click', () => switchTab('library'));
    
    // Filtros
    document.getElementById('trimesterSelect').addEventListener('change', (e) => {
        selectedTrimester = e.target.value;
        refreshCurrentTab();
    });
    
    document.getElementById('classSelect').addEventListener('change', (e) => {
        selectedClass = e.target.value;
        if (currentTab === 'scale') {
            if (selectedClass === '' || selectedClass === 'Todas as Classes') loadGeneralOverview();
            else loadScheduleData();
        }
    });
}

function switchTab(tab) {
    currentTab = tab;
    // Reseta botões
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');

    // Esconde TUDO (todas as 4 seções)
    ['scale', 'lessons', 'videos', 'library'].forEach(t => {
        const el = document.getElementById(t + 'Content');
        if(el) el.classList.add('hidden');
    });

    // Mostra o atual
    const content = document.getElementById(tab + 'Content');
    if(content) content.classList.remove('hidden');

    // Gerencia visibilidade do filtro de Classe (só aparece na Escala)
    const classFilter = document.getElementById('classFilterContainer');
    if (classFilter) classFilter.style.display = (tab === 'scale') ? 'block' : 'none';

    refreshCurrentTab();
}

function refreshCurrentTab() {
    if (currentTab === 'scale') {
        if (selectedClass === '' || selectedClass === 'Todas as Classes') loadGeneralOverview();
        else if (scheduleData) renderSchedule();
        else loadScheduleData();
    } else if (currentTab === 'lessons') {
        loadLessonsData();
    } else if (currentTab === 'videos') {
        loadVideosData();
    } else if (currentTab === 'library') {
        loadLibraryData();
    }
}

// --- Funções Auxiliares Genéricas ---
async function fetchData(endpoint, cacheKeyGlobal) {
    // Tenta LocalStorage
    const localCache = localStorage.getItem(cacheKeyGlobal);
    if (localCache) return JSON.parse(localCache);

    // Busca API
    try {
        const response = await fetch(`${API_BASE_URL}/api/${endpoint}`);
        if (!response.ok) throw new Error('Erro na API');
        const data = await response.json();
        // Salva LocalStorage
        localStorage.setItem(cacheKeyGlobal, JSON.stringify(data));
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

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

// --- REMOVIDA AQUI A VERSÃO ANTIGA E DUPLICADA DE switchTab ---

// --- Visão Geral da Semana (Dashboard) ---
async function loadGeneralOverview() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    const highlightContainer = document.getElementById('highlightContainer');
    
    highlightContainer.innerHTML = '';

    // 1. Tenta pegar do Cache Local primeiro
    const cachedOverview = localStorage.getItem('ebd_overview_cache');
    
    if (cachedOverview) {
        const parsed = JSON.parse(cachedOverview);
        const currentTarget = getNextSunday();
        if (parsed.date === currentTarget) {
            renderOverviewTable(parsed.items, parsed.date);
            const updateLabel = document.createElement('div');
            updateLabel.id = 'updating-indicator';
            updateLabel.innerHTML = '<small style="color:orange; display:block; text-align:center; margin-top:5px;">Verificando atualizações...</small>';
            scheduleContainer.prepend(updateLabel);
        } else {
            scheduleContainer.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando escala da semana...</p></div>`;
        }
    } else {
        scheduleContainer.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando escala da semana...</p></div>`;
    }

    try {
        const select = document.getElementById('classSelect');
        const options = Array.from(select.options)
            .map(opt => opt.value)
            .filter(val => val !== '' && val !== 'Todas as Classes');

        const targetDate = getNextSunday();
        
        const promises = options.map(async (className) => {
            const formData = new FormData();
            formData.append('classe', className);
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/schedule`, { method: 'POST', body: formData });
                if (!response.ok) return null;
                const data = await response.json();
                const items = convertApiDataToScheduleItems(data);
                const match = items.find(item => item.date === targetDate);
                if (match) return { ...match, className: className };
                return null;
            } catch (err) { return null; }
        });

        const results = await Promise.all(promises);
        const validResults = results.filter(item => item !== null);

        const indicator = document.getElementById('updating-indicator');
        if (indicator) indicator.remove();

        if (validResults.length === 0) {
            scheduleContainer.innerHTML = `
                <div class="empty-state">
                    <p>Nenhuma aula encontrada para o próximo domingo (${targetDate}).</p>
                </div>
            `;
        } else {
            renderOverviewTable(validResults, targetDate);
            localStorage.setItem('ebd_overview_cache', JSON.stringify({
                date: targetDate,
                items: validResults
            }));
        }

    } catch (error) {
        console.error("Erro no overview:", error);
        if (!cachedOverview) {
            scheduleContainer.innerHTML = `<p class="error">Erro ao carregar visão geral.</p>`;
        }
    }
}

function renderOverviewTable(items, date) {
    const container = document.getElementById('scheduleContainer');
    items.sort((a, b) => a.className.localeCompare(b.className));

    const html = `
        <div class="overview-container">
            <div class="overview-header">
                <h3>Escala Geral da Semana</h3>
                <span class="badge" style="background: #ea580c; color: white;">Domingo: ${date}</span>
            </div>
            <p style="text-align: center; color: #666; margin-bottom: 1.5rem;">
                Professores escalados para este domingo:
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

// --- API: Escala Individual ---
async function loadScheduleData() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    const highlightContainer = document.getElementById('highlightContainer');
    
    const cacheKey = `ebd_schedule_${selectedClass}`;
    const cachedData = localStorage.getItem(cacheKey);

    highlightContainer.innerHTML = ''; 
    
    if (cachedData) {
        const data = JSON.parse(cachedData);
        renderDataWithCache(data); 
        const updateBadge = document.createElement('div');
        updateBadge.id = 'updating-badge';
        updateBadge.innerHTML = '<div style="position:fixed; bottom:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:20px; font-size:12px; z-index:999;">Atualizando...</div>';
        document.body.appendChild(updateBadge);
    } else {
        scheduleContainer.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando escala...</p></div>`;
    }
    
    try {
        const formData = new FormData();
        formData.append('classe', selectedClass);
        const response = await fetch(`${API_BASE_URL}/api/schedule`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error(`Erro na API: ${response.status}`);
        
        scheduleData = await response.json(); 
        const badge = document.getElementById('updating-badge');
        if (badge) badge.remove();

        localStorage.setItem(cacheKey, JSON.stringify(scheduleData));
        renderDataWithCache(scheduleData);
        
    } catch (error) {
        console.error('Erro:', error);
        if (!cachedData) {
            scheduleContainer.innerHTML = `<div class="empty-state"><p>Erro ao carregar escala.</p></div>`;
        }
    }
}

function renderDataWithCache(data) {
    scheduleData = data; 
    globalThemesMap = {}; 
    if (data.temas) {
        data.temas.forEach(t => {
            const trimesterNum = String(t.TRIMESTRE).split(' ')[0];
            globalThemesMap[`${trimesterNum}-${t.CLASSE}`] = t.TEMA;
        });
    }
    renderSchedule(); 
}

function renderSchedule() {
    const container = document.getElementById('scheduleContainer');
    if (!scheduleData) return;
    
    const scheduleItems = convertApiDataToScheduleItems(scheduleData);
    const filteredData = filterScheduleData(scheduleItems); 
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

// ==========================================
// 2. VÍDEOS (NOVO) 🎬
// ==========================================
async function loadVideosData() {
    const container = document.getElementById('videosContainer');
    if (videosData.length === 0) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando vídeos...</p></div>`;
        const data = await fetchData('videos', 'ebd_videos_cache');
        if (data) videosData = data;
        else {
            container.innerHTML = `<p class="error">Erro ao carregar vídeos.</p>`;
            return;
        }
    }
    renderVideos();
}

function renderVideos() {
    const container = document.getElementById('videosContainer');
    
    const filtered = videosData.filter(v => {
        if (selectedTrimester === 'all') return true;
        const cat = v.category.toLowerCase();
        if (selectedTrimester === 'diversos') return cat.includes('diverso') || cat.includes('extra');
        return cat.includes(selectedTrimester);
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Nenhum vídeo encontrado para este filtro.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="lessons-grid">
            ${filtered.map(video => {
                // Extrai ID do Youtube
                let videoId = '';
                // Regex para pegar ID tanto de youtube.com quanto youtu.be
                const match = video.link.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|.*\/))([^&?]*)/);
                if (match && match[1]) videoId = match[1];
                
                const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';

                // MUDANÇA AQUI: Ao clicar, chamamos openVideoModal com o ID do vídeo
                return `
                <div class="lesson-card" onclick="openVideoModal('${videoId}')">
                    <div class="lesson-image">
                        ${thumbUrl ? `<img src="${thumbUrl}" alt="${video.title}" style="object-fit:cover;">` : '<div style="color:#ccc;">Sem Capa</div>'}
                        <div class="lesson-overlay">
                            <span style="font-size:3rem; color:white; opacity:0.8;">▶</span>
                        </div>
                    </div>
                    <div class="lesson-content">
                        <div class="lesson-badges-bottom">
                            <span class="badge" style="background:#fce7f3; color:#be185d;">${video.category}</span>
                        </div>
                        <h4 class="lesson-title">${video.title}</h4>
                        <p class="lesson-description">${video.description || ''}</p>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
}

// --- FUNÇÕES DA MODAL DE VÍDEO (NOVAS) ---

function openVideoModal(videoId) {
    if (!videoId) {
        alert("Erro: ID do vídeo não encontrado.");
        return;
    }
    
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('youtubePlayer');
    
    // Monta a URL de embed com autoplay
    player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    
    modal.classList.remove('hidden');
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('youtubePlayer');
    
    modal.classList.add('hidden');
    
    // IMPORTANTE: Limpar o src para o vídeo parar de tocar
    player.src = "";
}

// ==========================================
// 3. ACERVO / BIBLIOTECA (NOVO) 📚
// ==========================================
async function loadLibraryData() {
    const container = document.getElementById('libraryContainer');
    if (libraryData.length === 0) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div><p>Carregando acervo...</p></div>`;
        const data = await fetchData('library', 'ebd_library_cache');
        if (data) libraryData = data;
        else {
            container.innerHTML = `<p class="error">Erro ao carregar acervo.</p>`;
            return;
        }
    }
    renderLibrary();
}

function renderLibrary() {
    const container = document.getElementById('libraryContainer');
    const filtered = libraryData; 
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Acervo vazio.</p></div>`;
        return;
    }
    container.innerHTML = `
        <div class="lessons-grid">
            ${filtered.map(item => `
                <div class="lesson-card" onclick="window.open('${item.link}', '_blank')">
                    <div class="lesson-image" style="background-color: #f3f4f6;">
                        ${item.cover ? `<img src="${item.cover}" alt="${item.title}">` : '<span style="font-size:2rem;">📄</span>'}
                        <div class="lesson-overlay">
                            <span style="color:white; font-weight:bold;">Acessar</span>
                        </div>
                    </div>
                    <div class="lesson-content">
                        <div class="lesson-badges-bottom">
                            <span class="badge" style="background:#e0e7ff; color:#4338ca;">${item.type}</span>
                        </div>
                        <h4 class="lesson-title">${item.title}</h4>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// --- Função de Pesquisa em Tempo Real ---
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    // Define qual container estamos olhando baseada na aba ativa
    let activeContainerId = '';
    let itemSelector = '';

    if (currentTab === 'scale') {
        activeContainerId = 'scheduleContainer';
        itemSelector = '.schedule-card'; // Procura nos cards de escala
    } else if (currentTab === 'lessons') {
        activeContainerId = 'lessonsContainer';
        itemSelector = '.lesson-card';
    } else if (currentTab === 'videos') {
        activeContainerId = 'videosContainer';
        itemSelector = '.lesson-card';
    } else if (currentTab === 'library') {
        activeContainerId = 'libraryContainer';
        itemSelector = '.lesson-card';
    }

    const container = document.getElementById(activeContainerId);
    if (!container) return;

    const items = container.querySelectorAll(itemSelector);
    let hasResults = false;

    items.forEach(item => {
        // Pega todo o texto dentro do card
        const text = item.textContent.toLowerCase();
        
        // Verifica se o termo digitado existe no texto
        if (text.includes(searchTerm)) {
            item.style.display = ''; // Mostra
            hasResults = true;
        } else {
            item.style.display = 'none'; // Esconde
        }
    });

    // Feedback visual se não achar nada
    const noResultsMsg = document.getElementById('no-search-results');
    
    if (!hasResults && searchTerm !== '') {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.id = 'no-search-results';
            msg.className = 'empty-state';
            msg.innerHTML = '<p>Nenhum resultado encontrado para essa busca.</p>';
            container.appendChild(msg);
        }
    } else {
        if (noResultsMsg) noResultsMsg.remove();
    }
}
