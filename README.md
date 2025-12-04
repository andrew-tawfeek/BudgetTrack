# Budget Tracker

A comprehensive budget tracking application with calendar view, balance graphs, and transaction tables.

## Features

### 📅 Calendar View
- Visual monthly calendar showing daily transactions
- Color-coded income (green) and expenses (red)
- Daily balance display
- Click any day to view or add transactions
- Recurring transaction support (daily, weekly, bi-weekly, monthly, yearly)
- Transaction categories with emoji icons

### 📊 Graph View
- Interactive balance-over-time chart
- Customizable date ranges (last month, quarter, or year)
- Statistics panel showing:
  - Total income
  - Total expenses
  - Net change
  - Average daily change
- Date range settings are saved and persist across sessions

### 📋 Table View
- Detailed transaction table with:
  - Date, description, category, and type
  - Separate income and expense columns
  - Running balance calculation
  - Balance change per transaction
- Customizable date ranges
- Export to Excel (CSV format)
- Date range settings are saved and persist across sessions

### 💾 Data Management
- Export data to JSON (includes all settings)
- Import data from JSON
- Clear all data option
- Standardized JSON format for future compatibility

## Standardized JSON Format

The application uses a versioned data structure to ensure compatibility with future updates:

```json
{
  "version": "1.0.0",
  "initialBalance": 5000,
  "initialBalanceDate": "2025-01-01",
  "bills": [
    {
      "id": 1234567890,
      "name": "Salary",
      "amount": 3000,
      "type": "monthly",
      "category": "salary",
      "date": "2025-01-01",
      "endDate": null
    },
    {
      "id": 1234567891,
      "name": "Rent",
      "amount": -1200,
      "type": "monthly",
      "category": "rent",
      "date": "2025-01-01",
      "endDate": "2025-12-31"
    }
  ],
  "settings": {
    "graphDateRange": {
      "start": "2024-12-01",
      "end": "2025-01-01"
    },
    "tableDateRange": {
      "start": "2024-12-01",
      "end": "2025-01-01"
    }
  }
}
```

### Data Structure Fields

#### Root Level
- **version** (string): Data format version for migration support
- **initialBalance** (number): Starting balance amount
- **initialBalanceDate** (string|null): Date when initial balance was set (YYYY-MM-DD)
- **bills** (array): List of all transactions
- **settings** (object): Application settings

#### Transaction Object (bills array)
- **id** (number): Unique transaction identifier
- **name** (string): Transaction description
- **amount** (number): Amount (positive for income, negative for expenses)
- **type** (string): Frequency type
  - `"one-time"`: Single transaction
  - `"daily"`: Repeats daily
  - `"weekly"`: Repeats weekly
  - `"biweekly"`: Repeats every 2 weeks
  - `"monthly"`: Repeats monthly
  - `"yearly"`: Repeats yearly
- **category** (string): Transaction category
  - `"salary"`, `"food"`, `"transport"`, `"utilities"`, `"entertainment"`, `"shopping"`, `"health"`, `"education"`, `"savings"`, `"rent"`, `"subscriptions"`, `"other"`
- **date** (string): Start date (YYYY-MM-DD)
- **endDate** (string|null): Optional end date for recurring transactions (YYYY-MM-DD)

#### Settings Object
- **graphDateRange**: Saved date range for graph view
  - **start** (string|null): Start date (YYYY-MM-DD)
  - **end** (string|null): End date (YYYY-MM-DD)
- **tableDateRange**: Saved date range for table view
  - **start** (string|null): Start date (YYYY-MM-DD)
  - **end** (string|null): End date (YYYY-MM-DD)

## Data Migration

The application includes a migration system to handle future data format changes:

1. **Version Detection**: When importing data, the version field is checked
2. **Automatic Migration**: Data is automatically migrated to the current format
3. **Backward Compatibility**: Older formats are supported and upgraded
4. **Default Values**: Missing fields are populated with sensible defaults

Example migration function:
```javascript
function migrateData(importedData) {
    const version = importedData.version || '0.0.0';
    
    // Migrate to current version
    const migratedData = {
        version: DATA_VERSION,
        initialBalance: importedData.initialBalance || 0,
        initialBalanceDate: importedData.initialBalanceDate || null,
        bills: importedData.bills || [],
        settings: importedData.settings || { /* defaults */ }
    };
    
    return migratedData;
}
```

## Usage

1. **Set Initial Balance**: Enter your starting balance and update
2. **Add Transactions**: Click any day on the calendar to add income or expenses
3. **View Balance Graph**: Switch to Graph tab to see balance trends over time
4. **Export Table**: Switch to Table tab and export your transactions to Excel
5. **Save Your Data**: Use Export to save all your data as JSON
6. **Load Data**: Use Import to restore previously saved data

## Keyboard Shortcuts

- **Escape**: Close transaction modal
- **Arrow Left**: Previous month (calendar view)
- **Arrow Right**: Next month (calendar view)

## File Structure

```
BudgetTrack/
├── index.html          # Main HTML structure
├── css/
│   └── styles.css      # All styling
├── js/
│   └── app.js          # Application logic
└── README.md           # Documentation
```

## Browser Support

Works in all modern browsers with ES6+ support:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Future Enhancements

The standardized JSON format is designed to support future features:
- Multiple accounts/budgets
- Budget goals and alerts
- Category budgets
- Custom categories
- Shared budgets
- Cloud sync
- Mobile app integration

## License

Free to use and modify.
