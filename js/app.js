// Data structure with versioning for future compatibility
const DATA_VERSION = '1.0.0';

let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();
let selectedDate = null;

// Standardized data format
let data = {
    version: DATA_VERSION,
    initialBalance: 0,
    initialBalanceDate: null, // Date when initial balance was set
    bills: [],
    settings: {
        graphDateRange: {
            start: null,
            end: null
        },
        tableDateRange: {
            start: null,
            end: null
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    renderCalendar();
    highlightToday();
    initializeGraphDates();
    initializeTableDates();
});

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
    
    // Show day summary and initialize balance adjustment
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
    
    // Update balance adjustment input with current balance
    updateBalanceAdjustmentInput();
}

function updateBalanceAdjustmentInput() {
    const balances = calculateBalances(selectedDate.getFullYear(), selectedDate.getMonth());
    const dayBalance = balances[selectedDate.getDate()];
    document.getElementById('balanceAdjustment').value = dayBalance.toFixed(2);
}

function adjustBalance() {
    const newBalance = parseFloat(document.getElementById('balanceAdjustment').value);
    
    if (isNaN(newBalance)) {
        alert('Please enter a valid balance amount');
        return;
    }
    
    // Calculate current balance for the day
    const balances = calculateBalances(selectedDate.getFullYear(), selectedDate.getMonth());
    const currentBalance = balances[selectedDate.getDate()];
    
    // Calculate the difference
    const difference = newBalance - currentBalance;
    
    if (Math.abs(difference) < 0.01) {
        showToast('Balance is already at this amount');
        return;
    }
    
    // Create a balance adjustment transaction
    const bill = {
        id: Date.now(),
        name: 'Balance Adjustment',
        amount: difference,
        type: 'one-time',
        category: 'other',
        date: formatDateString(selectedDate),
        endDate: null
    };
    
    data.bills.push(bill);
    saveToStorage();
    updateDaySummary();
    renderBillsList();
    renderCalendar();
    
    showToast(`Balance adjusted by ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}`);
}

function closeModal() {
    document.getElementById('dayModal').classList.remove('active');
    document.getElementById('billName').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billType').value = 'one-time';
    document.getElementById('billCategory').value = 'other';
    document.getElementById('billEndDate').value = '';
    document.getElementById('isIncome').checked = false;
    document.getElementById('balanceAdjustment').value = '';
}

function addBill() {
    const name = document.getElementById('billName').value.trim();
    const amount = parseFloat(document.getElementById('billAmount').value);
    const type = document.getElementById('billType').value;
    const category = document.getElementById('billCategory').value;
    const endDate = document.getElementById('billEndDate').value || null;
    const isIncome = document.getElementById('isIncome').checked;

    if (!name || isNaN(amount) || amount === 0) {
        alert('Please enter a valid bill name and non-zero amount');
        return;
    }

    // Apply positive sign if it's income, negative if expense
    const finalAmount = isIncome ? Math.abs(amount) : -Math.abs(amount);

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
    document.getElementById('isIncome').checked = false;
    
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
                    <button class="edit-bill" onclick="editBill(${bill.id})" title="Edit">Edit</button>
                    <button class="delete-bill" onclick="deleteBill(${bill.id})" title="Delete">Delete</button>
                </div>
            </div>
        `}).join('')}
    `;
}

function getCategoryEmoji(category) {
    const icons = {
        'salary': 'SAL',
        'food': 'FOOD',
        'transport': 'TRAN',
        'utilities': 'UTIL',
        'entertainment': 'ENT',
        'shopping': 'SHOP',
        'health': 'HLTH',
        'education': 'EDU',
        'savings': 'SAVE',
        'rent': 'RENT',
        'subscriptions': 'SUB',
        'other': 'OTH'
    };
    return icons[category] || 'OTH';
}

function getRecurringLabel(type) {
    const labels = {
        'daily': 'Daily',
        'weekly': 'Weekly',
        'biweekly': 'Bi-weekly',
        'monthly': 'Monthly',
        'yearly': 'Yearly'
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
    document.getElementById('isIncome').checked = bill.amount > 0;

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
            version: DATA_VERSION,
            initialBalance: parsed.initialBalance || 0,
            initialBalanceDate: parsed.initialBalanceDate || null,
            bills: parsed.bills || [],
            settings: {
                graphDateRange: {
                    start: parsed.settings?.graphDateRange?.start || null,
                    end: parsed.settings?.graphDateRange?.end || null
                },
                tableDateRange: {
                    start: parsed.settings?.tableDateRange?.start || null,
                    end: parsed.settings?.tableDateRange?.end || null
                }
            }
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
                data = migrateData(importedData);
                saveToStorage();
                renderCalendar();
                initializeGraphDates();
                initializeTableDates();
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
            version: DATA_VERSION,
            initialBalance: 0,
            initialBalanceDate: null,
            bills: [],
            settings: {
                graphDateRange: {
                    start: null,
                    end: null
                },
                tableDateRange: {
                    start: null,
                    end: null
                }
            }
        };
        saveToStorage();
        renderCalendar();
        showToast('All data cleared');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Check if modal is open
    const modalOpen = document.getElementById('dayModal').classList.contains('active');
    
    if (e.key === 'Escape') {
        if (modalOpen) {
            closeModal();
        }
        // Return to calendar view if on other tabs
        if (!modalOpen) {
            const calendarTab = document.querySelector('.tab-btn:first-child');
            if (!calendarTab.classList.contains('active')) {
                switchTabDirectly('calendar');
            }
        }
    }
    
    if (!modalOpen) {
        if (e.key === 'ArrowLeft') {
            previousMonth();
        }
        if (e.key === 'ArrowRight') {
            nextMonth();
        }
    }
});

// Helper function to switch tabs programmatically
function switchTabDirectly(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Add active class to correct button
    const buttons = document.querySelectorAll('.tab-btn');
    if (tabName === 'calendar') buttons[0].classList.add('active');
    else if (tabName === 'graph') buttons[1].classList.add('active');
    else if (tabName === 'table') buttons[2].classList.add('active');
}

// Close modal when clicking outside
document.getElementById('dayModal').addEventListener('click', (e) => {
    if (e.target.id === 'dayModal') {
        closeModal();
    }
});

// ==================== TAB SYSTEM ====================

function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.remove('hidden');
    
    // Add active class to clicked button
    event.target.classList.add('active');
    
    // Initialize tab-specific content
    if (tabName === 'graph') {
        // Ensure dates are set before updating
        if (!document.getElementById('graphStartDate').value || !document.getElementById('graphEndDate').value) {
            initializeGraphDates();
        }
        updateGraph();
    } else if (tabName === 'table') {
        // Ensure dates are set before updating
        if (!document.getElementById('tableStartDate').value || !document.getElementById('tableEndDate').value) {
            initializeTableDates();
        }
        updateTable();
    }
}

// ==================== GRAPH VIEW ====================

function initializeGraphDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    // Load saved dates from settings
    if (data.settings.graphDateRange.start && data.settings.graphDateRange.end) {
        document.getElementById('graphStartDate').value = data.settings.graphDateRange.start;
        document.getElementById('graphEndDate').value = data.settings.graphDateRange.end;
    } else {
        document.getElementById('graphStartDate').value = formatDateString(startDate);
        document.getElementById('graphEndDate').value = formatDateString(endDate);
    }
}

function setGraphDateRange(range) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch(range) {
        case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
    }
    
    document.getElementById('graphStartDate').value = formatDateString(startDate);
    document.getElementById('graphEndDate').value = formatDateString(endDate);
    updateGraph();
}

function updateGraph() {
    const startDateStr = document.getElementById('graphStartDate').value;
    const endDateStr = document.getElementById('graphEndDate').value;
    
    if (!startDateStr || !endDateStr) return;
    
    // Save date range to settings
    data.settings.graphDateRange.start = startDateStr;
    data.settings.graphDateRange.end = endDateStr;
    saveToStorage();
    
    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);
    
    // Generate data points for each day
    const dataPoints = [];
    let runningBalance = data.initialBalance;
    let totalIncome = 0;
    let totalExpenses = 0;
    
    // Get initial balance for start date
    const initialBalanceDate = data.initialBalanceDate ? parseDateString(data.initialBalanceDate) : null;
    if (initialBalanceDate && initialBalanceDate < startDate) {
        // Calculate all transactions from initial balance date to start date
        const tempDate = new Date(initialBalanceDate);
        while (tempDate < startDate) {
            const bills = getBillsForDate(tempDate);
            bills.forEach(bill => {
                runningBalance += bill.amount;
            });
            tempDate.setDate(tempDate.getDate() + 1);
        }
    }
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const bills = getBillsForDate(currentDate);
        
        bills.forEach(bill => {
            runningBalance += bill.amount;
            if (bill.amount > 0) {
                totalIncome += bill.amount;
            } else {
                totalExpenses += Math.abs(bill.amount);
            }
        });
        
        dataPoints.push({
            date: new Date(currentDate),
            balance: runningBalance
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Update statistics
    const netChange = totalIncome - totalExpenses;
    const dayCount = dataPoints.length || 1;
    const avgDaily = netChange / dayCount;
    
    document.getElementById('statIncome').textContent = `$${totalIncome.toFixed(2)}`;
    document.getElementById('statExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
    document.getElementById('statNet').textContent = `$${netChange.toFixed(2)}`;
    document.getElementById('statNet').className = `stat-value ${netChange >= 0 ? 'income' : 'expense'}`;
    document.getElementById('statAvgDaily').textContent = `$${avgDaily.toFixed(2)}`;
    document.getElementById('statAvgDaily').className = `stat-value ${avgDaily >= 0 ? 'income' : 'expense'}`;
    
    // Draw graph
    drawGraph(dataPoints);
}

function drawGraph(dataPoints) {
    const canvas = document.getElementById('balanceChart');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;
    
    if (dataPoints.length === 0) {
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText('No data available for selected date range', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate dimensions
    const padding = 60;
    const graphWidth = canvas.width - padding * 2;
    const graphHeight = canvas.height - padding * 2;
    
    // Find min and max balance
    const balances = dataPoints.map(p => p.balance);
    const minBalance = Math.min(...balances);
    const maxBalance = Math.max(...balances);
    const balanceRange = maxBalance - minBalance || 1;
    
    // Draw grid lines
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = padding + (graphHeight / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
        
        // Draw y-axis labels
        const balance = maxBalance - (balanceRange / gridLines) * i;
        ctx.fillStyle = '#6c757d';
        ctx.font = '12px Segoe UI';
        ctx.textAlign = 'right';
        ctx.fillText(`$${balance.toFixed(0)}`, padding - 10, y + 4);
    }
    
    // Draw x-axis
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw line graph
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    dataPoints.forEach((point, index) => {
        const x = padding + (graphWidth / (dataPoints.length - 1 || 1)) * index;
        const y = canvas.height - padding - ((point.balance - minBalance) / balanceRange) * graphHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Draw points
    ctx.fillStyle = '#667eea';
    dataPoints.forEach((point, index) => {
        const x = padding + (graphWidth / (dataPoints.length - 1 || 1)) * index;
        const y = canvas.height - padding - ((point.balance - minBalance) / balanceRange) * graphHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw date labels
    ctx.fillStyle = '#6c757d';
    ctx.font = '11px Segoe UI';
    ctx.textAlign = 'center';
    
    const labelInterval = Math.ceil(dataPoints.length / 8) || 1;
    dataPoints.forEach((point, index) => {
        if (index % labelInterval === 0 || index === dataPoints.length - 1) {
            const x = padding + (graphWidth / (dataPoints.length - 1 || 1)) * index;
            const dateStr = `${point.date.getMonth() + 1}/${point.date.getDate()}`;
            ctx.fillText(dateStr, x, canvas.height - padding + 20);
        }
    });
}

// ==================== TABLE VIEW ====================

function initializeTableDates() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    // Load saved dates from settings
    if (data.settings.tableDateRange.start && data.settings.tableDateRange.end) {
        document.getElementById('tableStartDate').value = data.settings.tableDateRange.start;
        document.getElementById('tableEndDate').value = data.settings.tableDateRange.end;
    } else {
        document.getElementById('tableStartDate').value = formatDateString(startDate);
        document.getElementById('tableEndDate').value = formatDateString(endDate);
    }
}

function setTableDateRange(range) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch(range) {
        case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
    }
    
    document.getElementById('tableStartDate').value = formatDateString(startDate);
    document.getElementById('tableEndDate').value = formatDateString(endDate);
    updateTable();
}

function updateTable() {
    const startDateStr = document.getElementById('tableStartDate').value;
    const endDateStr = document.getElementById('tableEndDate').value;
    
    if (!startDateStr || !endDateStr) return;
    
    // Save date range to settings
    data.settings.tableDateRange.start = startDateStr;
    data.settings.tableDateRange.end = endDateStr;
    saveToStorage();
    
    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);
    
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';
    
    // Calculate initial balance for start date
    let runningBalance = data.initialBalance;
    const initialBalanceDate = data.initialBalanceDate ? parseDateString(data.initialBalanceDate) : null;
    
    if (initialBalanceDate && initialBalanceDate < startDate) {
        const tempDate = new Date(initialBalanceDate);
        while (tempDate < startDate) {
            const bills = getBillsForDate(tempDate);
            bills.forEach(bill => {
                runningBalance += bill.amount;
            });
            tempDate.setDate(tempDate.getDate() + 1);
        }
    }
    
    // Generate table rows
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const bills = getBillsForDate(currentDate);
        const dateStr = formatDateString(currentDate);
        const dayStartBalance = runningBalance;
        
        if (bills.length === 0) {
            // Show day with no transactions
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${dateStr}</td>
                <td colspan="3" style="text-align: center; color: #6c757d; font-style: italic;">No transactions</td>
                <td>-</td>
                <td>-</td>
                <td class="balance">$${runningBalance.toFixed(2)}</td>
                <td>$0.00</td>
            `;
        } else {
            bills.forEach(bill => {
                const row = tableBody.insertRow();
                const income = bill.amount > 0 ? bill.amount : 0;
                const expense = bill.amount < 0 ? Math.abs(bill.amount) : 0;
                
                runningBalance += bill.amount;
                const balanceChange = bill.amount;
                
                row.innerHTML = `
                    <td>${dateStr}</td>
                    <td>${bill.name}</td>
                    <td>${getCategoryEmoji(bill.category)} ${bill.category}</td>
                    <td>${bill.type}</td>
                    <td class="${income > 0 ? 'income' : ''}">${income > 0 ? '$' + income.toFixed(2) : '-'}</td>
                    <td class="${expense > 0 ? 'expense' : ''}">${expense > 0 ? '$' + expense.toFixed(2) : '-'}</td>
                    <td class="balance">$${runningBalance.toFixed(2)}</td>
                    <td class="${balanceChange >= 0 ? 'positive' : 'negative'}">${balanceChange >= 0 ? '+' : ''}$${balanceChange.toFixed(2)}</td>
                `;
            });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

function exportToExcel() {
    const startDateStr = document.getElementById('tableStartDate').value;
    const endDateStr = document.getElementById('tableEndDate').value;
    
    if (!startDateStr || !endDateStr) {
        alert('Please select a date range first');
        return;
    }
    
    // Create CSV content
    let csv = 'Date,Description,Category,Type,Income,Expense,Balance,Balance Change\n';
    
    const startDate = parseDateString(startDateStr);
    const endDate = parseDateString(endDateStr);
    
    let runningBalance = data.initialBalance;
    const initialBalanceDate = data.initialBalanceDate ? parseDateString(data.initialBalanceDate) : null;
    
    if (initialBalanceDate && initialBalanceDate < startDate) {
        const tempDate = new Date(initialBalanceDate);
        while (tempDate < startDate) {
            const bills = getBillsForDate(tempDate);
            bills.forEach(bill => {
                runningBalance += bill.amount;
            });
            tempDate.setDate(tempDate.getDate() + 1);
        }
    }
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const bills = getBillsForDate(currentDate);
        const dateStr = formatDateString(currentDate);
        
        if (bills.length === 0) {
            csv += `${dateStr},No transactions,,,0,0,${runningBalance.toFixed(2)},0\n`;
        } else {
            bills.forEach(bill => {
                const income = bill.amount > 0 ? bill.amount.toFixed(2) : '0';
                const expense = bill.amount < 0 ? Math.abs(bill.amount).toFixed(2) : '0';
                const balanceChange = bill.amount.toFixed(2);
                
                runningBalance += bill.amount;
                
                const name = bill.name.replace(/,/g, ';'); // Replace commas to avoid CSV issues
                csv += `${dateStr},"${name}",${bill.category},${bill.type},${income},${expense},${runningBalance.toFixed(2)},${balanceChange}\n`;
            });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-tracker-${startDateStr}-to-${endDateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Table exported to Excel (CSV format)');
}

// ==================== DATA MIGRATION ====================

function migrateData(importedData) {
    // Handle data migration for future versions
    const version = importedData.version || '0.0.0';
    
    // Default structure for v1.0.0
    const migratedData = {
        version: DATA_VERSION,
        initialBalance: importedData.initialBalance || 0,
        initialBalanceDate: importedData.initialBalanceDate || null,
        bills: importedData.bills || [],
        settings: {
            graphDateRange: {
                start: importedData.settings?.graphDateRange?.start || null,
                end: importedData.settings?.graphDateRange?.end || null
            },
            tableDateRange: {
                start: importedData.settings?.tableDateRange?.start || null,
                end: importedData.settings?.tableDateRange?.end || null
            }
        }
    };
    
    // Future migrations can be added here
    // if (compareVersions(version, '2.0.0') < 0) {
    //     // Migrate from 1.x to 2.0.0
    // }
    
    return migratedData;
}
