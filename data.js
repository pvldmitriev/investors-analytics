// Глобальные переменные
let investorsData = [];
let filteredData = [];
let currentPage = 1;
const recordsPerPage = 100;

// Загрузка данных через Render API
async function loadDataFromRender() {
    try {
        console.log('=== DEBUG: loadDataFromRender вызвана ===');
        console.log('Загружаем данные через Render API...');
        
        console.log('=== DEBUG: Начинаем fetch запрос ===');
        
        // Add visible test to page
        const testDiv = document.createElement('div');
        testDiv.innerHTML = '<p style="color: blue; font-weight: bold;">DEBUG: Starting API call...</p>';
        testDiv.style.position = 'fixed';
        testDiv.style.top = '50px';
        testDiv.style.right = '10px';
        testDiv.style.zIndex = '9999';
        testDiv.style.background = 'lightblue';
        testDiv.style.padding = '10px';
        testDiv.style.border = '2px solid blue';
        document.body.appendChild(testDiv);
        
        let response;
        try {
            response = await fetch('https://investors-app.onrender.com/api/investors');
            console.log('=== DEBUG: fetch завершен, status:', response.status, 'ok:', response.ok);
            
            // Update test div
            testDiv.innerHTML = `<p style="color: green; font-weight: bold;">DEBUG: API call successful! Status: ${response.status}</p>`;
            testDiv.style.background = 'lightgreen';
            testDiv.style.border = '2px solid green';
        } catch (fetchError) {
            console.error('=== DEBUG: Fetch error:', fetchError);
            
            // Update test div with error
            testDiv.innerHTML = `<p style="color: red; font-weight: bold;">DEBUG: API call failed! Error: ${fetchError.message}</p>`;
            testDiv.style.background = 'lightcoral';
            testDiv.style.border = '2px solid red';
            
            throw fetchError;
        }
        console.log('=== DEBUG: response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('=== DEBUG: JSON получен, success:', result.success, 'data length:', result.data ? result.data.length : 'null');
        
        if (result.success && result.data) {
            // Группируем данные по инвесторам
            const investorsMap = new Map();
            
            result.data.forEach(row => {
                if (!investorsMap.has(row.id)) {
                    investorsMap.set(row.id, {
                        id: row.id,
                        name: row.name,
                        title: row.title,
                        company: row.company,
                        linkedin_url: row.linkedin_url,
                        email: row.email,
                        phone: row.phone,
                        location: row.location,
                        industry: row.industry,
                        investment_stage: row.investment_stage,
                        investment_size: row.investment_size,
                        portfolio_companies: row.portfolio_companies,
                        description: row.description,
                        rating: row.rating,
                        owner_progress: [],
                        notes: null
                    });
                }
                
                const investor = investorsMap.get(row.id);
                
                // Добавляем прогресс владельца
                if (row.owner_name && row.stage) {
                    const existingProgress = investor.owner_progress.find(p => 
                        p.owner_name === row.owner_name && p.stage === row.stage
                    );
                    if (!existingProgress) {
                        investor.owner_progress.push({
                            owner_name: row.owner_name,
                            stage: row.stage,
                            is_active: row.is_active
                        });
                    }
                }
                
                // Добавляем заметку
                if (row.note_text && !investor.notes) {
                    investor.notes = row.note_text;
                }
            });
            
            investorsData = Array.from(investorsMap.values());
            console.log(`Загружено ${investorsData.length} инвесторов через Render API`);
            return investorsData;
        } else {
            throw new Error('Неверный формат данных от API');
        }
    } catch (error) {
        console.error('=== DEBUG: Ошибка загрузки данных через Render API ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
}

// Сохранение прогресса через Render API
async function saveProgressToRender(investorId, ownerName, stage, isActive) {
    try {
        const response = await fetch('https://investors-app.onrender.com/api/progress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                investor_id: investorId,
                owner_name: ownerName,
                stage: stage,
                is_active: isActive
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Ошибка сохранения прогресса');
        }
        
        console.log('Прогресс сохранен в Render API');
        return result;
    } catch (error) {
        console.error('Ошибка сохранения прогресса в Render API:', error);
        throw error;
    }
}

// Сохранение заметки через Vercel API
async function saveNoteToRender(investorId, noteText) {
    try {
        const response = await fetch('https://investors-app.onrender.com/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                investor_id: investorId,
                note_text: noteText
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Ошибка сохранения заметки');
        }
        
        console.log('Заметка сохранена в Render API');
        return result;
    } catch (error) {
        console.error('Ошибка сохранения заметки в Render API:', error);
        throw error;
    }
}

// Логирование действий через Vercel API
async function logActionToRender(actionType, actionData) {
    try {
        const response = await fetch('https://investors-app.onrender.com/api/logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action_type: actionType,
                action_data: actionData
            })
        });
        
        if (!response.ok) {
            console.warn('Ошибка логирования:', response.status);
        }
    } catch (error) {
        console.warn('Ошибка логирования через Vercel API:', error);
    }
}

// Создание карточки инвестора для Render
function createInvestorCardRender(investor) {
    const card = document.createElement('div');
    card.className = 'investor-card';
    card.dataset.investorId = investor.id;
    
    // Получаем активный прогресс для каждого владельца
    const antonProgress = investor.owner_progress?.find(p => p.owner_name === 'Антон' && p.is_active) || null;
    const pavelProgress = investor.owner_progress?.find(p => p.owner_name === 'Павел' && p.is_active) || null;
    
    card.innerHTML = `
        <div class="investor-header">
            <div class="investor-info">
                <h3 class="investor-name">${investor.name}</h3>
                <p class="investor-title">${investor.title || ''}</p>
                <p class="investor-company">${investor.company || ''}</p>
            </div>
            <div class="investor-rating">
                <span class="rating-badge">${investor.rating || 0}</span>
            </div>
            <div class="investor-actions">
                <button class="btn btn-secondary" onclick="showDetailsModal(${investor.id})">Подробнее</button>
                ${investor.linkedin_url ? `<a href="${investor.linkedin_url}" target="_blank" class="btn btn-primary">LinkedIn</a>` : ''}
            </div>
        </div>
        <div class="investor-progress">
            <div class="owner-section">
                <div class="owner-checkbox">
                    <input type="checkbox" id="anton_${investor.id}" 
                           ${antonProgress ? 'checked' : ''} 
                           onchange="toggleOwner(${investor.id}, 'Антон', this.checked)">
                    <label for="anton_${investor.id}">Антон</label>
                </div>
                <div class="stage-toggles">
                    ${['INV', 'ACC', 'RESP-I', 'MSG', 'RESP-M', 'INT', 'CALL', 'NEXT'].map(stage => `
                        <button class="stage-btn ${antonProgress?.stage === stage ? 'active' : 'inactive'}" 
                                onclick="setStage(${investor.id}, 'Антон', '${stage}')"
                                title="${getStageTitle(stage)}">${stage}</button>
                    `).join('')}
                </div>
            </div>
            <div class="owner-section">
                <div class="owner-checkbox">
                    <input type="checkbox" id="pavel_${investor.id}" 
                           ${pavelProgress ? 'checked' : ''} 
                           onchange="toggleOwner(${investor.id}, 'Павел', this.checked)">
                    <label for="pavel_${investor.id}">Павел</label>
                </div>
                <div class="stage-toggles">
                    ${['INV', 'ACC', 'RESP-I', 'MSG', 'RESP-M', 'INT', 'CALL', 'NEXT'].map(stage => `
                        <button class="stage-btn ${pavelProgress?.stage === stage ? 'active' : 'inactive'}" 
                                onclick="setStage(${investor.id}, 'Павел', '${stage}')"
                                title="${getStageTitle(stage)}">${stage}</button>
                    `).join('')}
                </div>
            </div>
        </div>
        <div class="investor-footer">
            <button class="btn btn-notes" onclick="showNotesModalRender(${investor.id})">
                📝 Заметки
            </button>
        </div>
    `;

    return card;
}

// Показать модальное окно заметок для Render
async function showNotesModalRender(investorId) {
    const investor = investorsData.find(i => i.id === investorId);
    if (!investor) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Заметки: ${investor.name}</h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <textarea id="noteText" placeholder="Введите заметку..." rows="6">${investor.notes || ''}</textarea>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="saveNoteRender(${investorId})">Сохранить</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Отмена</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Сохранение заметки для Render
async function saveNoteRender(investorId) {
    try {
        const noteText = document.getElementById('noteText').value;
        await saveNoteToRender(investorId, noteText);
        
        // Обновляем данные в памяти
        const investor = investorsData.find(i => i.id === investorId);
        if (investor) {
            investor.notes = noteText;
        }
        
        // Закрываем модальное окно
        document.querySelector('.modal').remove();
        
        console.log('Заметка сохранена');
    } catch (error) {
        console.error('Ошибка сохранения заметки:', error);
        alert('Ошибка сохранения заметки: ' + error.message);
    }
}

// Переключение владельца для Render
async function toggleOwner(investorId, ownerName, isChecked) {
    try {
        const investor = investorsData.find(i => i.id === investorId);
        if (!investor) return;
        
        // Удаляем существующий прогресс для этого владельца
        investor.owner_progress = investor.owner_progress.filter(p => p.owner_name !== ownerName);
        
        if (isChecked) {
            // Если чекбокс включен, устанавливаем первый этап
            await saveProgressToRender(investorId, ownerName, 'INV', true);
            investor.owner_progress.push({
                owner_name: ownerName,
                stage: 'INV',
                is_active: true
            });
        } else {
            // Если чекбокс выключен, очищаем прогресс
            await saveProgressToVercel(investorId, ownerName, null, false);
        }
        
        // Обновляем отображение
        updateInvestorCard(investorId);
        
        // Логируем действие
        await logActionToRender('OWNER_TOGGLE', { investorId, ownerName, isChecked });
        
    } catch (error) {
        console.error('Ошибка переключения владельца:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

// Установка этапа для Render
async function setStage(investorId, ownerName, stage) {
    try {
        const investor = investorsData.find(i => i.id === investorId);
        if (!investor) return;
        
        // Обновляем прогресс
        await saveProgressToVercel(investorId, ownerName, stage, true);
        
        // Обновляем данные в памяти
        investor.owner_progress = investor.owner_progress.filter(p => p.owner_name !== ownerName);
        investor.owner_progress.push({
            owner_name: ownerName,
            stage: stage,
            is_active: true
        });
        
        // Обновляем отображение
        updateInvestorCard(investorId);
        
        // Логируем действие
        await logActionToRender('STAGE_UPDATE', { investorId, ownerName, stage });
        
    } catch (error) {
        console.error('Ошибка установки этапа:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

// Обновление карточки инвестора
function updateInvestorCard(investorId) {
    const investor = investorsData.find(i => i.id === investorId);
    if (!investor) return;
    
    const existingCard = document.querySelector(`[data-investor-id="${investorId}"]`);
    if (existingCard) {
        const newCard = createInvestorCardRender(investor);
        existingCard.replaceWith(newCard);
    }
}

// Вспомогательные функции
function getStageTitle(stage) {
    const titles = {
        'INV': 'Инвайт отправлен',
        'ACC': 'Инвайт принят',
        'RESP-I': 'Ответ на инвайт',
        'MSG': 'Отправлено первое сообщение',
        'RESP-M': 'Ответ на сообщение',
        'INT': 'Проявлен интерес',
        'CALL': 'Назначен созвон',
        'NEXT': 'Есть варианты, назначены следующие шаги'
    };
    return titles[stage] || stage;
}

// Экспорт функций в глобальную область
window.loadDataFromRender = loadDataFromRender;
window.saveProgressToRender = saveProgressToRender;
window.saveNoteToRender = saveNoteToRender;
window.logActionToRender = logActionToRender;
window.createInvestorCardRender = createInvestorCardRender;
window.showNotesModalRender = showNotesModalRender;
window.saveNoteRender = saveNoteRender;
window.toggleOwner = toggleOwner;
window.setStage = setStage;
window.updateInvestorCard = updateInvestorCard;