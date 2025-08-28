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
            this.showLoading('Загрузка данных...');
            console.log('Загружаем данные через Render API...');
            
            const investors = await loadDataFromRender();
            
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
            setTimeout(() => { this.updateDashboard(); }, 100);
            
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
        const container = document.getElementById('investorsContainer');
        if (container) {
            container.innerHTML = '';
            pageData.forEach(investor => {
                const card = createInvestorCardRender(investor);
                container.appendChild(card);
            });
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
        const container = document.getElementById('investorsContainer');
        if (container) {
            container.innerHTML = `<div class="loading">${message}</div>`;
        }
    }

    showError(message) {
        const container = document.getElementById('investorsContainer');
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
document.addEventListener('DOMContentLoaded', () => {
    const app = new InvestorsApp();
    app.init();
});