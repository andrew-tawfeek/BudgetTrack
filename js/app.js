// Data structure with versioning for future compatibility
const DATA_VERSION = '1.0.0';

let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth();
let selectedDate = null;
let focusedDay = null; // Track which day is currently focused with keyboard
let calendarView = 'month'; // 'month' or 'week'
let currentWeekStart = null; // For week view

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
    loadDarkMode();
});

// Dark mode functions
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
}

function loadDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
    }
}

function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateString(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function renderCalendar() {
    if (calendarView === 'week') {
        renderWeekView();
        return;
    }
    
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
        const isFocused = focusedDay === day;
        
        dayCell.className = `day-cell${isToday ? ' today' : ''}${isFocused ? ' focused' : ''}`;
        dayCell.setAttribute('data-day', day);
        
        const balance = balances[day];
        const billsOnDay = getBillsForDate(new Date(currentYear, currentMonth, day));
        
        // Separate income and expenses for better visualization
        const income = billsOnDay.filter(b => b.amount > 0);
        const expenses = billsOnDay.filter(b => b.amount < 0);
        const dayTotal = billsOnDay.reduce((sum, b) => sum + b.amount, 0);

        dayCell.innerHTML = `
            <div class="day-number">${day}${isToday ? ' <span class="today-badge">Today</span>' : ''}</div>
            <div class="day-balance ${balance >= 0 ? 'balance-positive' : 'balance-negative'}">
                Balance: $${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            ${billsOnDay.length > 0 ? `
                <div class="day-total ${dayTotal >= 0 ? 'total-positive' : 'total-negative'}">
                    ${dayTotal >= 0 ? '+' : ''}$${Math.abs(dayTotal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
            ` : ''}
            <div class="bills-preview">
                ${billsOnDay.slice(0, 3).map(bill => 
                    `<div class="bill-item-preview ${bill.amount >= 0 ? 'income-preview' : 'expense-preview'}">
                        ${bill.amount >= 0 ? '↑' : '↓'} ${bill.name}: ${bill.amount >= 0 ? '+' : ''}$${Math.abs(bill.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>`
                ).join('')}
                ${billsOnDay.length > 3 ? `<div class="more-bills">+${billsOnDay.length - 3} more...</div>` : ''}
            </div>
        `;

        dayCell.onclick = () => openDayModal(day);
        calendarDays.appendChild(dayCell);
    }
}

function renderWeekView() {
    // Initialize week start if not set
    if (!currentWeekStart) {
        const today = new Date();
        currentWeekStart = getWeekStart(today);
    }
    
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Format display text
    const startMonth = monthNames[currentWeekStart.getMonth()];
    const endMonth = monthNames[weekEnd.getMonth()];
    const startDay = currentWeekStart.getDate();
    const endDay = weekEnd.getDate();
    const year = currentWeekStart.getFullYear();
    
    let displayText;
    if (currentWeekStart.getMonth() === weekEnd.getMonth()) {
        displayText = `${startMonth} ${startDay}-${endDay}, ${year}`;
    } else if (currentWeekStart.getFullYear() === weekEnd.getFullYear()) {
        displayText = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    } else {
        displayText = `${startMonth} ${startDay}, ${currentWeekStart.getFullYear()} - ${endMonth} ${endDay}, ${weekEnd.getFullYear()}`;
    }
    
    document.getElementById('monthDisplay').textContent = displayText;
    
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = `
        <div class="calendar-grid week-view">
            <div class="day-header">Sun</div>
            <div class="day-header">Mon</div>
            <div class="day-header">Tue</div>
            <div class="day-header">Wed</div>
            <div class="day-header">Thu</div>
            <div class="day-header">Fri</div>
            <div class="day-header">Sat</div>
        </div>
        <div class="calendar-grid week-view" id="calendarDays"></div>
    `;
    
    const calendarDays = document.getElementById('calendarDays');
    
    // Render 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeekStart);
        date.setDate(date.getDate() + i);
        
        const day = date.getDate();
        const month = date.getMonth();
        const year = date.getFullYear();
        
        // Calculate balance for this specific day
        const balances = calculateBalances(year, month);
        const balance = balances[day];
        
        const billsOnDay = getBillsForDate(date);
        const isToday = date.toDateString() === new Date().toDateString();
        const isFocused = focusedDay === day && currentMonth === month && currentYear === year;
        
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        if (isToday) dayCell.classList.add('today');
        if (isFocused) {
            dayCell.classList.add('focused');
            dayCell.tabIndex = 0;
        }
        
        const income = billsOnDay.filter(b => b.amount > 0);
        const expenses = billsOnDay.filter(b => b.amount < 0);
        const dayTotal = billsOnDay.reduce((sum, b) => sum + b.amount, 0);

        dayCell.innerHTML = `
            <div class="day-number">${day}${isToday ? ' <span class="today-badge">Today</span>' : ''}</div>
            <div class="day-balance ${balance >= 0 ? 'balance-positive' : 'balance-negative'}">
                Balance: $${balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            ${billsOnDay.length > 0 ? `
                <div class="day-total ${dayTotal >= 0 ? 'total-positive' : 'total-negative'}">
                    ${dayTotal >= 0 ? '+' : ''}$${Math.abs(dayTotal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
            ` : ''}
            <div class="bills-preview">
                ${billsOnDay.slice(0, 3).map(bill => 
                    `<div class="bill-item-preview ${bill.amount >= 0 ? 'income-preview' : 'expense-preview'}">
                        ${bill.amount >= 0 ? '↑' : '↓'} ${bill.name}: ${bill.amount >= 0 ? '+' : ''}$${Math.abs(bill.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>`
                ).join('')}
                ${billsOnDay.length > 3 ? `<div class="more-bills">+${billsOnDay.length - 3} more...</div>` : ''}
            </div>
        `;
        
        dayCell.onclick = () => {
            currentYear = year;
            currentMonth = month;
            selectedDate = date;
            openDayModal(day);
        };
        
        calendarDays.appendChild(dayCell);
    }
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday as start of week
    return new Date(d.setDate(diff));
}

function switchCalendarView(view) {
    calendarView = view;
    
    // Update button states
    document.getElementById('monthViewBtn').classList.toggle('active', view === 'month');
    document.getElementById('weekViewBtn').classList.toggle('active', view === 'week');
    
    if (view === 'week' && !currentWeekStart) {
        currentWeekStart = getWeekStart(new Date(currentYear, currentMonth, 1));
    }
    
    renderCalendar();
}

function previousPeriod() {
    if (calendarView === 'week') {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    } else {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    }
    renderCalendar();
}

function nextPeriod() {
    if (calendarView === 'week') {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    } else {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
    }
    renderCalendar();
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
    
    const targetMonthStart = new Date(year, month, 1);
    
    // If no initial balance date is set, calculate from the earliest transaction or use initial balance
    if (!data.initialBalanceDate) {
        // Find the earliest transaction date
        if (data.bills.length > 0) {
            const earliestBill = data.bills.reduce((earliest, bill) => {
                const billDate = parseDateString(bill.date);
                return !earliest || billDate < earliest ? billDate : earliest;
            }, null);
            
            if (earliestBill && earliestBill < targetMonthStart) {
                // Calculate from earliest transaction to target month
                let currentDate = new Date(earliestBill);
                while (currentDate < targetMonthStart) {
                    const bills = getBillsForDate(currentDate);
                    const dayTotal = bills.reduce((sum, bill) => sum + bill.amount, 0);
                    balance += dayTotal;
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        }
        return balance;
    }
    
    const initialDate = parseDateString(data.initialBalanceDate);
    
    // If we're viewing a month before or at the initial balance date, just return initial balance
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
    
    // Hide add transaction form by default
    document.getElementById('addTransactionForm').style.display = 'none';
    document.getElementById('balanceEditForm').style.display = 'none';
    
    // Update balance display and render transactions
    updateBalanceDisplay();
    renderBillsList();
    document.getElementById('dayModal').classList.add('active');
}

function toggleAddTransactionForm() {
    const form = document.getElementById('addTransactionForm');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        document.getElementById('billName').focus();
    } else {
        form.style.display = 'none';
    }
}

function toggleBalanceEdit() {
    const editForm = document.getElementById('balanceEditForm');
    if (editForm.style.display === 'none') {
        const balances = calculateBalances(selectedDate.getFullYear(), selectedDate.getMonth());
        const dayBalance = balances[selectedDate.getDate()];
        document.getElementById('balanceAdjustment').value = dayBalance.toFixed(2);
        editForm.style.display = 'flex';
        document.getElementById('balanceAdjustment').focus();
    } else {
        editForm.style.display = 'none';
    }
}

function updateBalanceDisplay() {
    const balances = calculateBalances(selectedDate.getFullYear(), selectedDate.getMonth());
    const dayBalance = balances[selectedDate.getDate()];
    document.getElementById('dayBalanceAmount').textContent = `$${dayBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
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
        toggleBalanceEdit();
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
    updateBalanceDisplay();
    renderBillsList();
    renderCalendar();
    toggleBalanceEdit();
    
    showToast(`Balance adjusted by ${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}`);
}

function closeModal() {
    document.getElementById('dayModal').classList.remove('active');
    document.getElementById('billName').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billType').value = 'one-time';
    document.getElementById('billCategory').value = 'other';
    document.getElementById('billEndDate').value = '';
    document.getElementById('balanceAdjustment').value = '';
    document.getElementById('addTransactionForm').style.display = 'none';
    document.getElementById('balanceEditForm').style.display = 'none';
}

function addBill() {
    const name = document.getElementById('billName').value.trim();
    const amount = parseFloat(document.getElementById('billAmount').value);
    const type = document.getElementById('billType').value;
    const category = document.getElementById('billCategory').value;
    const endDate = document.getElementById('billEndDate').value || null;

    if (!name || isNaN(amount) || amount === 0) {
        alert('Please enter a valid bill name and non-zero amount');
        return;
    }

    const finalAmount = amount;

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
    updateBalanceDisplay();
    renderBillsList();
    renderCalendar();

    // Reset form and hide it
    document.getElementById('billName').value = '';
    document.getElementById('billAmount').value = '';
    document.getElementById('billType').value = 'one-time';
    document.getElementById('billCategory').value = 'other';
    document.getElementById('billEndDate').value = '';
    document.getElementById('addTransactionForm').style.display = 'none';
    
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
    document.getElementById('billAmount').value = bill.amount;
    document.getElementById('billType').value = bill.type;
    document.getElementById('billCategory').value = bill.category || 'other';
    document.getElementById('billEndDate').value = bill.endDate || '';

    // Delete the old bill and let the user add the updated one
    data.bills = data.bills.filter(b => b.id !== billId);
    saveToStorage();
    updateBalanceDisplay();
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
    updateBalanceDisplay();
    renderBillsList();
    renderCalendar();
    showToast(`${bill.name} deleted`);
}

function previousMonth() {
    previousPeriod();
}

function nextMonth() {
    nextPeriod();
}

function goToToday() {
    const today = new Date();
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    focusedDay = today.getDate();
    
    if (calendarView === 'week') {
        currentWeekStart = getWeekStart(today);
    }
    
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

// Temporary storage for CSV transactions pending review
let pendingCsvTransactions = [];

function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csv = e.target.result;
            const lines = csv.split('\n');
            
            if (lines.length < 2) {
                alert('CSV file appears to be empty');
                return;
            }
            
            // Parse header to find column indices
            const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const descIndex = header.findIndex(h => h.toLowerCase().includes('description'));
            const dateIndex = header.findIndex(h => h.toLowerCase().includes('date'));
            const amountIndex = header.findIndex(h => h.toLowerCase().includes('amount'));
            const balanceIndex = header.findIndex(h => h.toLowerCase().includes('balance'));
            
            if (descIndex === -1 || dateIndex === -1 || amountIndex === -1) {
                alert('CSV must contain columns for Description, Date, and Amount');
                return;
            }
            
            pendingCsvTransactions = [];
            let previousBalance = null;
            
            // Process each transaction line
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Parse CSV line (handling quoted fields)
                const fields = [];
                let currentField = '';
                let inQuotes = false;
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                        fields.push(currentField.trim());
                        currentField = '';
                    } else {
                        currentField += char;
                    }
                }
                fields.push(currentField.trim());
                
                if (fields.length <= Math.max(descIndex, dateIndex, amountIndex)) {
                    continue; // Skip incomplete rows
                }
                
                const description = fields[descIndex].replace(/"/g, '');
                const dateStr = fields[dateIndex].replace(/"/g, '');
                const amountStr = fields[amountIndex].replace(/"/g, '').replace(/[$,]/g, '');
                const balanceStr = balanceIndex !== -1 ? fields[balanceIndex].replace(/"/g, '').replace(/[$,]/g, '') : null;
                
                if (!description || !dateStr || !amountStr) continue;
                
                // Parse date (handle various formats)
                let transactionDate;
                try {
                    // Try parsing as MM/DD/YYYY or other common formats
                    const dateParts = dateStr.split('/');
                    if (dateParts.length === 3) {
                        const month = parseInt(dateParts[0]) - 1;
                        const day = parseInt(dateParts[1]);
                        let year = parseInt(dateParts[2]);
                        
                        // Fix 2-digit year parsing (assume 2000s)
                        if (year < 100) {
                            year += 2000;
                        }
                        
                        transactionDate = new Date(year, month, day);
                    } else {
                        transactionDate = new Date(dateStr);
                    }
                    
                    if (isNaN(transactionDate.getTime())) {
                        continue; // Skip invalid dates
                    }
                } catch (err) {
                    continue;
                }
                
                let amount = parseFloat(amountStr);
                if (isNaN(amount) || amount === 0) continue;
                
                // Check if description indicates an expense
                const descriptionLower = description.toLowerCase();
                const isDebitOrWithdrawal = descriptionLower.includes('debit card purchase') || 
                                           descriptionLower.includes('withdrawal');
                
                // Determine if income or expense based on balance change
                if (balanceStr && previousBalance !== null) {
                    const currentBalance = parseFloat(balanceStr);
                    const balanceChange = currentBalance - previousBalance;
                    
                    // If balance increased, it's income (positive)
                    // If balance decreased, it's expense (negative)
                    if (balanceChange > 0) {
                        amount = Math.abs(amount); // Income
                    } else {
                        amount = Math.abs(amount) * -1; // Expense
                    }
                    
                    previousBalance = currentBalance;
                } else {
                    // Fallback: check description or make negative
                    if (isDebitOrWithdrawal) {
                        amount = Math.abs(amount) * -1; // Expense
                    } else {
                        amount = Math.abs(amount) * -1; // Default to expense
                    }
                    
                    if (balanceStr) {
                        previousBalance = parseFloat(balanceStr);
                    }
                }
                
                // Override: if description indicates debit/withdrawal, force negative
                if (isDebitOrWithdrawal && amount > 0) {
                    amount = amount * -1;
                }
                
                // Store transaction for preview
                pendingCsvTransactions.push({
                    id: Date.now() + pendingCsvTransactions.length,
                    name: description,
                    amount: amount,
                    date: formatDateString(transactionDate),
                    recurrence: 'one-time',
                    selected: true
                });
            }
            
            if (pendingCsvTransactions.length > 0) {
                showCsvPreview();
            } else {
                alert('No valid transactions found in CSV');
            }
        } catch (error) {
            alert('Error importing CSV: ' + error.message);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function showCsvPreview() {
    const previewList = document.getElementById('csvPreviewList');
    previewList.innerHTML = '';
    
    pendingCsvTransactions.forEach((transaction, index) => {
        const item = document.createElement('div');
        item.className = 'csv-transaction-item';
        item.innerHTML = `
            <input type="checkbox" 
                   class="csv-transaction-checkbox csv-item-checkbox" 
                   id="csv-check-${index}" 
                   ${transaction.selected ? 'checked' : ''} 
                   onchange="toggleCsvTransaction(${index})">
            <div class="csv-transaction-fields">
                <div class="csv-field-group">
                    <label class="csv-field-label">Description</label>
                    <input type="text" 
                           class="csv-field-input" 
                           value="${transaction.name}" 
                           onchange="updateCsvTransaction(${index}, 'name', this.value)">
                </div>
                <div class="csv-field-group">
                    <label class="csv-field-label">Amount</label>
                    <input type="number" 
                           step="0.01" 
                           class="csv-field-input ${transaction.amount >= 0 ? 'amount-positive' : 'amount-negative'}" 
                           value="${transaction.amount}" 
                           onchange="updateCsvTransaction(${index}, 'amount', parseFloat(this.value))">
                </div>
                <div class="csv-field-group">
                    <label class="csv-field-label">Recurrence</label>
                    <select class="csv-field-input" 
                            onchange="updateCsvTransaction(${index}, 'recurrence', this.value)">
                        <option value="one-time" ${transaction.recurrence === 'one-time' ? 'selected' : ''}>One-time</option>
                        <option value="weekly" ${transaction.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option>
                        <option value="biweekly" ${transaction.recurrence === 'biweekly' ? 'selected' : ''}>Bi-weekly</option>
                        <option value="monthly" ${transaction.recurrence === 'monthly' ? 'selected' : ''}>Monthly</option>
                    </select>
                </div>
                <div class="csv-field-group">
                    <label class="csv-field-label">Date</label>
                    <input type="date" 
                           class="csv-field-input" 
                           value="${transaction.date}" 
                           onchange="updateCsvTransaction(${index}, 'date', this.value)">
                </div>
            </div>
        `;
        previewList.appendChild(item);
    });
    
    document.getElementById('csvPreviewModal').classList.add('active');
}

function toggleCsvTransaction(index) {
    pendingCsvTransactions[index].selected = !pendingCsvTransactions[index].selected;
    updateSelectAllCheckbox();
}

function toggleAllCsvTransactions(checked) {
    pendingCsvTransactions.forEach(t => t.selected = checked);
    document.querySelectorAll('.csv-item-checkbox').forEach(checkbox => {
        checkbox.checked = checked;
    });
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('csvSelectAll');
    if (selectAllCheckbox) {
        const allSelected = pendingCsvTransactions.every(t => t.selected);
        selectAllCheckbox.checked = allSelected;
    }
}

function updateCsvTransaction(index, field, value) {
    pendingCsvTransactions[index][field] = value;
    
    // Update amount color class if amount changed
    if (field === 'amount') {
        const input = event.target;
        input.className = `csv-field-input ${value >= 0 ? 'amount-positive' : 'amount-negative'}`;
    }
}

function closeCsvPreview() {
    document.getElementById('csvPreviewModal').classList.remove('active');
    pendingCsvTransactions = [];
}

function confirmCsvImport() {
    const selectedTransactions = pendingCsvTransactions.filter(t => t.selected);
    
    if (selectedTransactions.length === 0) {
        alert('No transactions selected for import');
        return;
    }
    
    // Import selected transactions
    selectedTransactions.forEach(transaction => {
        const bill = {
            id: transaction.id,
            name: transaction.name,
            amount: transaction.amount,
            type: transaction.recurrence,
            category: 'other',
            date: transaction.date,
            endDate: null
        };
        data.bills.push(bill);
    });
    
    saveToStorage();
    renderCalendar();
    closeCsvPreview();
    showToast(`Successfully imported ${selectedTransactions.length} transactions`);
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
    const calendarActive = document.getElementById('calendarTab').classList.contains('hidden') === false;
    
    const csvPreviewOpen = document.getElementById('csvPreviewModal').classList.contains('active');
    
    // Check if user is currently editing text in an input field
    const activeElement = document.activeElement;
    const isEditingText = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
    );
    
    if (e.key === 'Escape') {
        if (csvPreviewOpen) {
            closeCsvPreview();
        } else if (modalOpen) {
            closeModal();
        }
        // Return to calendar view if on other tabs
        if (!modalOpen && !csvPreviewOpen) {
            const calendarTab = document.querySelector('.tab-btn:first-child');
            if (!calendarTab.classList.contains('active')) {
                switchTabDirectly('calendar');
            }
        }
    }
    
    // Enter key to submit transaction when modal is open
    if (e.key === 'Enter' && modalOpen) {
        // Don't submit if user is in a textarea or select
        if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            addBill();
        }
    }
    
    // Enter key to open day when on calendar
    if (e.key === 'Enter' && !modalOpen && calendarActive && focusedDay) {
        e.preventDefault();
        openDayModal(focusedDay);
    }
    
    // Arrow key navigation for days (only if not editing text)
    if (!modalOpen && calendarActive && !isEditingText) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateDay(-1);
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateDay(1);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigateDay(-7);
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigateDay(7);
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

// Navigate between days with arrow keys
function navigateDay(offset) {
    if (calendarView === 'week') {
        navigateDayWeekView(offset);
        return;
    }
    
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Initialize focused day if not set
    if (focusedDay === null) {
        const today = new Date();
        if (today.getMonth() === currentMonth && today.getFullYear() === currentYear) {
            focusedDay = today.getDate();
        } else {
            focusedDay = 1;
        }
    }
    
    let newDay = focusedDay + offset;
    
    // Handle month boundaries
    if (newDay < 1) {
        // Go to previous month
        previousMonth();
        const prevMonthDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        focusedDay = prevMonthDays + newDay;
        renderCalendar();
    } else if (newDay > daysInMonth) {
        // Go to next month
        nextMonth();
        focusedDay = newDay - daysInMonth;
        renderCalendar();
    } else {
        // Stay in current month
        focusedDay = newDay;
        renderCalendar();
    }
}

function navigateDayWeekView(offset) {
    // Initialize focused day if not set
    if (focusedDay === null) {
        const today = new Date();
        focusedDay = today.getDate();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
    }
    
    // Create current focused date
    const focusedDate = new Date(currentYear, currentMonth, focusedDay);
    
    // Add offset
    focusedDate.setDate(focusedDate.getDate() + offset);
    
    // Update current year, month, and day
    currentYear = focusedDate.getFullYear();
    currentMonth = focusedDate.getMonth();
    focusedDay = focusedDate.getDate();
    
    // Check if we need to change weeks
    const focusedWeekStart = getWeekStart(focusedDate);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
    
    // If focused date is outside current week, update week
    if (focusedDate < currentWeekStart || focusedDate > currentWeekEnd) {
        currentWeekStart = focusedWeekStart;
    }
    
    renderCalendar();
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
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
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
    const startDate = new Date();
    const endDate = new Date();
    
    switch(range) {
        case 'month':
            endDate.setMonth(endDate.getMonth() + 1);
            break;
        case 'quarter':
            endDate.setMonth(endDate.getMonth() + 3);
            break;
        case 'year':
            endDate.setFullYear(endDate.getFullYear() + 1);
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
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
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
    const startDate = new Date();
    const endDate = new Date();
    
    switch(range) {
        case 'month':
            endDate.setMonth(endDate.getMonth() + 1);
            break;
        case 'quarter':
            endDate.setMonth(endDate.getMonth() + 3);
            break;
        case 'year':
            endDate.setFullYear(endDate.getFullYear() + 1);
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
    
    // Generate table rows (only for dates with transactions)
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const bills = getBillsForDate(currentDate);
        const dateStr = formatDateString(currentDate);
        
        // Only show rows if there are transactions
        if (bills.length > 0) {
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
