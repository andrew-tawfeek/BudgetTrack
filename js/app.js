// Data structure
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();
let selectedDate = null;

let data = {
    initialBalance: 0,
    initialBalanceDate: null, // Date when initial balance was set
    bills: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    renderCalendar();
    updateInitialBalanceInput();
    highlightToday();
});

function updateInitialBalanceInput() {
    document.getElementById('initialBalance').value = data.initialBalance;
}

function setInitialBalance() {
    const value = parseFloat(document.getElementById('initialBalance').value) || 0;
    data.initialBalance = value;
    // Set the initial balance date to the first of the current month if not set
    if (!data.initialBalanceDate) {
        data.initialBalanceDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    }
    saveToStorage();
    renderCalendar();
}

function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateString(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function renderCalendar() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
    
    document.getElementById('monthDisplay').textContent = 
        `${monthNames[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const calendar = document.getElementById('calendar');
    calendar.innerHTML = `
        <div class="calendar-grid">
            <div class="day-header">Sun</div>
            <div class="day-header">Mon</div>
            <div class="day-header">Tue</div>
            <div class="day-header">Wed</div>
            <div class="day-header">Thu</div>
            <div class="day-header">Fri</div>
            <div class="day-header">Sat</div>
        </div>
        <div class="calendar-grid" id="calendarDays"></div>
    `;

    const calendarDays = document.getElementById('calendarDays');
    
    // Calculate balances for all days including carry-over from previous months
    const balances = calculateBalances(currentYear, currentMonth);

    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty';
        calendarDays.appendChild(emptyCell);
    }

    const today = new Date();
    const todayStr = formatDateString(today);

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        
        dayCell.className = `day-cell${isToday ? ' today' : ''}`;
        
        const balance = balances[day];
        const billsOnDay = getBillsForDate(new Date(currentYear, currentMonth, day));
        
        // Separate income and expenses for better visualization
        const income = billsOnDay.filter(b => b.amount > 0);
        const expenses = billsOnDay.filter(b => b.amount < 0);
        const dayTotal = billsOnDay.reduce((sum, b) => sum + b.amount, 0);

        dayCell.innerHTML = `
            <div class="day-number">${day}${isToday ? ' <span class="today-badge">Today</span>' : ''}</div>
            ${billsOnDay.length > 0 ? `
                <div class="day-total ${dayTotal >= 0 ? 'total-positive' : 'total-negative'}">
                    ${dayTotal >= 0 ? '+' : ''}$${dayTotal.toFixed(2)}
                </div>
            ` : ''}
            <div class="day-balance ${balance >= 0 ? 'balance-positive' : 'balance-negative'}">
                Balance: $${balance.toFixed(2)}
            </div>
            <div class="bills-preview">
                ${billsOnDay.slice(0, 3).map(bill => 
                    `<div class="bill-item-preview ${bill.amount >= 0 ? 'income-preview' : 'expense-preview'}">
                        ${bill.amount >= 0 ? '↑' : '↓'} ${bill.name}: ${bill.amount >= 0 ? '+' : ''}$${Math.abs(bill.amount).toFixed(2)}
                    </div>`
                ).join('')}
                ${billsOnDay.length > 3 ? `<div class="more-bills">+${billsOnDay.length - 3} more...</div>` : ''}
            </div>
        `;

        dayCell.onclick = () => openDayModal(day);
        calendarDays.appendChild(dayCell);
    }
}

function calculateBalances(year, month) {
    const balances = {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Calculate the starting balance by computing all transactions from the initial balance date
    let startingBalance = calculateStartingBalanceForMonth(year, month);

    let runningBalance = startingBalance;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const bills = getBillsForDate(date);
        
        const dayTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
        runningBalance += dayTotal;
        balances[day] = runningBalance;
    }

    return balances;
}

function calculateStartingBalanceForMonth(year, month) {
    // Start from the initial balance
    let balance = data.initialBalance;
    
    // Determine the start date for calculations
    const initialDate = data.initialBalanceDate ? parseDateString(data.initialBalanceDate) : new Date(year, month, 1);
    const targetMonthStart = new Date(year, month, 1);
    
    // If we're viewing a month before the initial balance date, just return initial balance
    if (targetMonthStart <= initialDate) {
        return balance;
    }
    
    // Calculate all bills from initial balance date to the start of target month
    let currentDate = new Date(initialDate);
    
    while (currentDate < targetMonthStart) {
        const bills = getBillsForDate(currentDate);
        const dayTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
        balance += dayTotal;
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return balance;
}

function getBillsForDate(date) {
    return data.bills.filter(bill => billOccursOnDate(bill, date));
}

function billOccursOnDate(bill, date) {
    const billDate = parseDateString(bill.date);
    
    // Normalize dates to remove time component for comparison
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const normalizedBillDate = new Date(billDate.getFullYear(), billDate.getMonth(), billDate.getDate());
    
    // Bill can't occur before it starts
    if (normalizedDate < normalizedBillDate) return false;

    // Check for end date on recurring bills
    if (bill.endDate) {
        const endDate = parseDateString(bill.endDate);
        if (normalizedDate > endDate) return false;
    }

    if (bill.type === 'one-time') {
        return normalizedDate.getTime() === normalizedBillDate.getTime();
    }

    const daysDiff = Math.floor((normalizedDate - normalizedBillDate) / (1000 * 60 * 60 * 24));

    switch (bill.type) {
        case 'daily':
            return true;
        case 'weekly':
            return daysDiff % 7 === 0;
        case 'biweekly':
            return daysDiff % 14 === 0;
        case 'monthly':
            // Handle months with fewer days
            const billDay = normalizedBillDate.getDate();
            const daysInMonth = new Date(normalizedDate.getFullYear(), normalizedDate.getMonth() + 1, 0).getDate();
            const effectiveDay = Math.min(billDay, daysInMonth);
            return normalizedDate.getDate() === effectiveDay;
        case 'yearly':
            return normalizedDate.getDate() === normalizedBillDate.getDate() && 
                   normalizedDate.getMonth() === normalizedBillDate.getMonth();
        default:
            return false;
    }
}

function openDayModal(day) {
    selectedDate = new Date(currentYear, currentMonth, day);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
    
    document.getElementById('modalTitle').textContent = 
        `${monthNames[currentMonth]} ${day}, ${currentYear}`;
    
    // Show day summary
    updateDaySummary();
    renderBillsList();
    document.getElementById('dayModal').classList.add('active');
    document.getElementById('billName').focus();
}

function updateDaySummary() {
    const bills = getBillsForDate(selectedDate);
    const income = bills.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
    const expenses = bills.filter(b => b.amount < 0).reduce((sum, b) => sum + Math.abs(b.amount), 0);
    const net = income - expenses;
    
    const summaryEl = document.getElementById('daySummary');
    summaryEl.innerHTML = `
        <div class="summary-item income-summary">
            <span>Income</span>
            <span>+$${income.toFixed(2)}</span>
        </div>
        <div class="summary-item expense-summary">
            <span>Expenses</span>
            <span>-$${expenses.toFixed(2)}</span>
        </div>
        <div class="summary-item net-summary ${net >= 0 ? 'net-positive' : 'net-negative'}">
            <span>Net</span>
            <span>${net >= 0 ? '+' : ''}$${net.toFixed(2)}</span>
        </div>
    `;
}

function closeModal() {
    document.getElementById('dayModal').classList.remove('active');
    document.getElementById('billName').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billType').value = 'one-time';
    document.getElementById('billCategory').value = 'other';
    document.getElementById('billEndDate').value = '';
}

function addBill() {
    const name = document.getElementById('billName').value.trim();
    const amount = parseFloat(document.getElementById('billAmount').value);
    const type = document.getElementById('billType').value;
    const category = document.getElementById('billCategory').value;
    const endDate = document.getElementById('billEndDate').value || null;
    const isExpense = document.getElementById('isExpense').checked;

    if (!name || isNaN(amount) || amount === 0) {
        alert('Please enter a valid bill name and non-zero amount');
        return;
    }

    // Apply negative sign if it's an expense
    const finalAmount = isExpense ? -Math.abs(amount) : Math.abs(amount);

    const bill = {
        id: Date.now(),
        name,
        amount: finalAmount,
        type,
        category,
        date: formatDateString(selectedDate),
        endDate: endDate || null
    };

    data.bills.push(bill);
    saveToStorage();
    updateDaySummary();
    renderBillsList();
    renderCalendar();

    // Reset form
    document.getElementById('billName').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billType').value = 'one-time';
    document.getElementById('billCategory').value = 'other';
    document.getElementById('billEndDate').value = '';
    document.getElementById('isExpense').checked = true;
    
    // Show confirmation
    showToast(`${name} added successfully!`);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function renderBillsList() {
    const billsList = document.getElementById('billsList');
    const selectedDateStr = formatDateString(selectedDate);
    
    // Get all bills that occur on this date
    const billsOnDate = getBillsForDate(selectedDate);
    
    // Also get recurring bills that were created on this date (to show their origin)
    const billsCreatedOnDate = data.bills.filter(bill => bill.date === selectedDateStr);
    
    // Combine and deduplicate
    const allBillsMap = new Map();
    billsOnDate.forEach(bill => allBillsMap.set(bill.id, { ...bill, isOccurrence: true }));
    billsCreatedOnDate.forEach(bill => {
        if (!allBillsMap.has(bill.id)) {
            allBillsMap.set(bill.id, { ...bill, isOccurrence: false });
        }
    });
    
    const bills = Array.from(allBillsMap.values());

    if (bills.length === 0) {
        billsList.innerHTML = '<p class="no-bills">No transactions on this day. Add one above!</p>';
        return;
    }

    // Sort: income first, then expenses, then by amount
    bills.sort((a, b) => {
        if (a.amount >= 0 && b.amount < 0) return -1;
        if (a.amount < 0 && b.amount >= 0) return 1;
        return Math.abs(b.amount) - Math.abs(a.amount);
    });

    billsList.innerHTML = `
        <h3 class="bills-list-header">Transactions on this day:</h3>
        ${bills.map(bill => {
            const isRecurring = bill.type !== 'one-time';
            const wasCreatedOnDifferentDate = bill.date !== selectedDateStr;
            const categoryEmoji = getCategoryEmoji(bill.category);
            
            return `
            <div class="bill-item ${bill.amount >= 0 ? 'income' : 'expense'}">
                <div class="bill-category-icon">${categoryEmoji}</div>
                <div class="bill-info">
                    <div class="bill-name">
                        ${bill.name}
                        ${isRecurring ? `<span class="recurring-badge">${getRecurringLabel(bill.type)}</span>` : ''}
                    </div>
                    <div class="bill-details">
                        ${bill.category ? capitalizeFirst(bill.category) : ''}
                        ${wasCreatedOnDifferentDate ? ` • Started ${formatDisplayDate(bill.date)}` : ''}
                        ${bill.endDate ? ` • Ends ${formatDisplayDate(bill.endDate)}` : ''}
                    </div>
                </div>
                <span class="bill-amount ${bill.amount >= 0 ? 'amount-positive' : 'amount-negative'}">
                    ${bill.amount >= 0 ? '+' : '-'}$${Math.abs(bill.amount).toFixed(2)}
                </span>
                <div class="bill-actions">
                    <button class="edit-bill" onclick="editBill(${bill.id})" title="Edit">✏️</button>
                    <button class="delete-bill" onclick="deleteBill(${bill.id})" title="Delete">🗑️</button>
                </div>
            </div>
        `}).join('')}
    `;
}

function getCategoryEmoji(category) {
    const emojis = {
        'salary': '💰',
        'food': '🍔',
        'transport': '🚗',
        'utilities': '💡',
        'entertainment': '🎮',
        'shopping': '🛍️',
        'health': '🏥',
        'education': '📚',
        'savings': '🏦',
        'rent': '🏠',
        'subscriptions': '📱',
        'other': '📝'
    };
    return emojis[category] || '📝';
}

function getRecurringLabel(type) {
    const labels = {
        'daily': '📅 Daily',
        'weekly': '📅 Weekly',
        'biweekly': '📅 Bi-weekly',
        'monthly': '📅 Monthly',
        'yearly': '📅 Yearly'
    };
    return labels[type] || type;
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDisplayDate(dateStr) {
    const date = parseDateString(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function editBill(billId) {
    const bill = data.bills.find(b => b.id === billId);
    if (!bill) return;

    document.getElementById('billName').value = bill.name;
    document.getElementById('billAmount').value = Math.abs(bill.amount);
    document.getElementById('billType').value = bill.type;
    document.getElementById('billCategory').value = bill.category || 'other';
    document.getElementById('billEndDate').value = bill.endDate || '';
    document.getElementById('isExpense').checked = bill.amount < 0;

    // Delete the old bill and let the user add the updated one
    data.bills = data.bills.filter(b => b.id !== billId);
    saveToStorage();
    updateDaySummary();
    renderBillsList();
    renderCalendar();
    
    document.getElementById('billName').focus();
    showToast('Editing bill - make changes and click Add');
}

function deleteBill(billId) {
    const bill = data.bills.find(b => b.id === billId);
    if (!bill) return;

    const isRecurring = bill.type !== 'one-time';
    
    if (isRecurring) {
        const choice = confirm(`"${bill.name}" is a recurring transaction.\n\nClick OK to delete ALL occurrences.\nClick Cancel to keep it.`);
        if (!choice) return;
    } else {
        if (!confirm(`Delete "${bill.name}"?`)) return;
    }

    data.bills = data.bills.filter(b => b.id !== billId);
    saveToStorage();
    updateDaySummary();
    renderBillsList();
    renderCalendar();
    showToast(`${bill.name} deleted`);
}

function previousMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

function goToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    renderCalendar();
}

function highlightToday() {
    // Already handled in renderCalendar
}

function saveToStorage() {
    localStorage.setItem('budgetTrackerData', JSON.stringify(data));
}

function loadFromStorage() {
    const stored = localStorage.getItem('budgetTrackerData');
    if (stored) {
        const parsed = JSON.parse(stored);
        data = {
            initialBalance: parsed.initialBalance || 0,
            initialBalanceDate: parsed.initialBalanceDate || null,
            bills: parsed.bills || []
        };
    }
}

function exportData() {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-tracker-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully!');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (confirm('This will replace all current data. Continue?')) {
                data = {
                    initialBalance: importedData.initialBalance || 0,
                    initialBalanceDate: importedData.initialBalanceDate || null,
                    bills: importedData.bills || []
                };
                saveToStorage();
                renderCalendar();
                updateInitialBalanceInput();
                showToast('Data imported successfully!');
            }
        } catch (error) {
            alert('Error importing data: Invalid JSON file');
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
        data = {
            initialBalance: 0,
            initialBalanceDate: null,
            bills: []
        };
        saveToStorage();
        renderCalendar();
        updateInitialBalanceInput();
        showToast('All data cleared');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
    if (e.key === 'ArrowLeft' && !document.getElementById('dayModal').classList.contains('active')) {
        previousMonth();
    }
    if (e.key === 'ArrowRight' && !document.getElementById('dayModal').classList.contains('active')) {
        nextMonth();
    }
});

// Close modal when clicking outside
document.getElementById('dayModal').addEventListener('click', (e) => {
    if (e.target.id === 'dayModal') {
        closeModal();
    }
});
