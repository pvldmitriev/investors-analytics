// Основной файл приложения
class InvestorsApp {
    constructor() {
        this.currentPage = 1;
        this.recordsPerPage = 100;
        this.filters = {
            search: '',
            owner: 'all',
            stages: []
        };
    }

    async init() {
        try {
            console.log('=== DEBUG: InvestorsApp.init() вызван ===');
            this.showLoading('Загрузка данных...');
            console.log('Загружаем данные через Render API...');
            
            // Проверяем, что функция доступна
            if (typeof loadDataFromRender !== 'function') {
                throw new Error('loadDataFromRender function not found');
            }
            
            console.log('=== DEBUG: Вызываем loadDataFromRender() ===');
            const investors = await loadDataFromRender();
            console.log('=== DEBUG: loadDataFromRender() завершен, investors:', investors ? investors.length : 'null');
            
            // Добавляем видимую отладку
            const debugDiv = document.createElement('div');
            debugDiv.innerHTML = `<p style="color: purple; font-weight: bold;">DEBUG: App received ${investors ? investors.length : 'null'} investors</p>`;
            debugDiv.style.position = 'fixed';
            debugDiv.style.top = '200px';
            debugDiv.style.right = '10px';
            debugDiv.style.zIndex = '9999';
            debugDiv.style.background = 'plum';
            debugDiv.style.padding = '10px';
            debugDiv.style.border = '2px solid purple';
            document.body.appendChild(debugDiv);
            
            if (investors && investors.length > 0) {
                investorsData = investors;
                filteredData = [...investorsData];
                console.log(`Загружено ${investors.length} инвесторов с Render API`);
            } else {
                console.log('Данные не найдены');
                this.showError('Не удалось загрузить данные.');
                return;
            }
            
            this.setupEventListeners();
            this.applyFilters();
            
            // Добавляем отладку для updateDashboard
            console.log('=== DEBUG: Calling updateDashboard() ===');
            const debugDiv = document.createElement('div');
            debugDiv.innerHTML = `<p style="color: orange; font-weight: bold;">DEBUG: Calling updateDashboard()</p>`;
            debugDiv.style.position = 'fixed';
            debugDiv.style.top = '250px';
            debugDiv.style.right = '10px';
            debugDiv.style.zIndex = '9999';
            debugDiv.style.background = 'orange';
            debugDiv.style.padding = '10px';
            debugDiv.style.border = '2px solid darkorange';
            document.body.appendChild(debugDiv);
            
            setTimeout(() => { 
                console.log('=== DEBUG: updateDashboard timeout fired ===');
                this.updateDashboard(); 
            }, 100);
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showError(`Ошибка при инициализации приложения: ${error.message}`);
        }
    }

    setupEventListeners() {
        // Поиск
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filters.search = searchInput.value.toLowerCase();
                this.applyFilters();
            }, 300));
        }

        // Фильтр по владельцу
        const ownerFilter = document.getElementById('ownerFilter');
        if (ownerFilter) {
            ownerFilter.addEventListener('change', () => {
                this.filters.owner = ownerFilter.value;
                this.applyFilters();
            });
        }

        // Фильтр по этапам
        const stageFilters = document.querySelectorAll('.stage-filter');
        stageFilters.forEach(filter => {
            filter.addEventListener('change', () => {
                this.updateStageFilters();
                this.applyFilters();
            });
        });

        // Пагинация
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.updateDashboard();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const maxPages = Math.ceil(filteredData.length / this.recordsPerPage);
                if (this.currentPage < maxPages) {
                    this.currentPage++;
                    this.updateDashboard();
                }
            });
        }
    }

    updateStageFilters() {
        this.filters.stages = [];
        document.querySelectorAll('.stage-filter:checked').forEach(filter => {
            this.filters.stages.push(filter.value);
        });
    }

    applyFilters() {
        filteredData = investorsData.filter(investor => {
            // Поиск по тексту
            if (this.filters.search) {
                const searchText = `${investor.name} ${investor.title || ''} ${investor.company || ''}`.toLowerCase();
                if (!searchText.includes(this.filters.search)) {
                    return false;
                }
            }

            // Фильтр по владельцу
            if (this.filters.owner !== 'all') {
                const hasOwnerProgress = investor.owner_progress?.some(p => 
                    p.owner_name === this.filters.owner && p.is_active
                );
                
                if (this.filters.owner === 'none') {
                    if (hasOwnerProgress) return false;
                } else if (this.filters.owner === 'both') {
                    const antonProgress = investor.owner_progress?.some(p => p.owner_name === 'Антон' && p.is_active);
                    const pavelProgress = investor.owner_progress?.some(p => p.owner_name === 'Павел' && p.is_active);
                    if (!antonProgress || !pavelProgress) return false;
                } else {
                    if (!hasOwnerProgress) return false;
                }
            }

            // Фильтр по этапам
            if (this.filters.stages.length > 0) {
                const hasMatchingStage = investor.owner_progress?.some(p => 
                    p.is_active && this.filters.stages.includes(p.stage)
                );
                if (!hasMatchingStage) return false;
            }

            return true;
        });

        this.currentPage = 1;
        this.updateDashboard();
    }

    updateDashboard() {
        const startIndex = (this.currentPage - 1) * this.recordsPerPage;
        const endIndex = startIndex + this.recordsPerPage;
        const pageData = filteredData.slice(startIndex, endIndex);

        // Обновляем контейнер
        const container = document.getElementById('investorsList');
        if (container) {
            container.innerHTML = '';
            pageData.forEach(investor => {
                const card = createInvestorCardRender(investor);
                container.appendChild(card);
            });
            
            // Добавляем отладку
            console.log('=== DEBUG: Container updated with', pageData.length, 'investors ===');
            const debugDiv = document.createElement('div');
            debugDiv.innerHTML = `<p style="color: green; font-weight: bold;">DEBUG: Container updated! ${pageData.length} investors displayed</p>`;
            debugDiv.style.position = 'fixed';
            debugDiv.style.top = '300px';
            debugDiv.style.right = '10px';
            debugDiv.style.zIndex = '9999';
            debugDiv.style.background = 'lightgreen';
            debugDiv.style.padding = '10px';
            debugDiv.style.border = '2px solid green';
            document.body.appendChild(debugDiv);
        } else {
            console.error('=== DEBUG: Container investorsList not found ===');
            const debugDiv = document.createElement('div');
            debugDiv.innerHTML = `<p style="color: red; font-weight: bold;">ERROR: Container investorsList not found!</p>`;
            debugDiv.style.position = 'fixed';
            debugDiv.style.top = '300px';
            debugDiv.style.right = '10px';
            debugDiv.style.zIndex = '9999';
            debugDiv.style.background = 'lightcoral';
            debugDiv.style.padding = '10px';
            debugDiv.style.border = '2px solid red';
            document.body.appendChild(debugDiv);
        }

        // Обновляем статистику
        this.updateStats();

        // Обновляем пагинацию
        this.updatePagination();
    }

    updateStats() {
        const totalElement = document.getElementById('totalInvestors');
        const filteredElement = document.getElementById('filteredInvestors');
        const pageInfoElement = document.getElementById('pageInfo');

        if (totalElement) {
            totalElement.textContent = investorsData.length;
        }
        if (filteredElement) {
            filteredElement.textContent = filteredData.length;
        }
        if (pageInfoElement) {
            const maxPages = Math.ceil(filteredData.length / this.recordsPerPage);
            pageInfoElement.textContent = `Страница ${this.currentPage} из ${maxPages}`;
        }
    }

    updatePagination() {
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        const maxPages = Math.ceil(filteredData.length / this.recordsPerPage);

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= maxPages;
        }
    }

    showLoading(message) {
        const container = document.getElementById('investorsList');
        if (container) {
            container.innerHTML = `<div class="loading">${message}</div>`;
        }
    }

    showError(message) {
        const container = document.getElementById('investorsList');
        if (container) {
            container.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Инициализация приложения
// Ждем полной загрузки всех скриптов
window.addEventListener('load', () => {
    console.log('=== DEBUG: Window load event fired ===');
    try {
        const app = new InvestorsApp();
        console.log('=== DEBUG: InvestorsApp created ===');
        app.init();
    } catch (error) {
        console.error('=== DEBUG: Error creating app:', error);
        // Добавляем видимую ошибку на страницу
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `<p style="color: red; font-weight: bold;">ERROR: ${error.message}</p>`;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '100px';
        errorDiv.style.right = '10px';
        errorDiv.style.zIndex = '9999';
        errorDiv.style.background = 'lightcoral';
        errorDiv.style.padding = '10px';
        errorDiv.style.border = '2px solid red';
        document.body.appendChild(errorDiv);
    }
});