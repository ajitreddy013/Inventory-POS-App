# Tests Directory

This directory contains test files for the CounterFlow POS Application.

## Test Files

### `test-app.js`
- **Purpose**: Tests core application functionality
- **Features**: Database initialization, sample data creation, basic operations
- **Usage**: `node tests/test-app.js`

### `test-daily-report.js`
- **Purpose**: Tests daily report generation functionality
- **Features**: Dashboard data collection, PDF report generation
- **Usage**: `node tests/test-daily-report.js`

### `test-thermal-printer.js`
- **Purpose**: Tests thermal printer integration
- **Features**: Printer configuration, bill printing, various bill formats
- **Usage**: `node tests/test-thermal-printer.js`

## Running Tests

From the project root directory:

```bash
# Test core application
node tests/test-app.js

# Test daily reports
node tests/test-daily-report.js

# Test thermal printer
node tests/test-thermal-printer.js
```

## Prerequisites

- Database must be accessible
- For printer tests: thermal printer hardware (optional)
- For report tests: output directory permissions

## Notes

All tests are designed to run independently and don't require a testing framework.
They provide console output to verify functionality and can be used for debugging.
