/**
 * FIND DATA FOR SPECIFIC DATES
 * 
 * This script demonstrates how to find backup data for any specific date.
 * Usage: node find-date-data.js YYYY-MM-DD
 * Example: node find-date-data.js 2025-07-11
 */

const BackupDataManager = require('./backup-data-manager');

// Get date from command line argument
const targetDate = process.argv[2];

if (!targetDate) {
  console.log('❌ Please provide a date in YYYY-MM-DD format');
  console.log('Usage: node find-date-data.js YYYY-MM-DD');
  console.log('Example: node find-date-data.js 2025-07-11');
  process.exit(1);
}

// Validate date format
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!datePattern.test(targetDate)) {
  console.log('❌ Invalid date format. Please use YYYY-MM-DD format');
  console.log('Example: node find-date-data.js 2025-07-11');
  process.exit(1);
}

// Create manager and find data
const manager = new BackupDataManager();

console.log(`🔍 Searching for backup data for: ${targetDate}`);
console.log('='.repeat(50));

// Find specific date backups
const results = manager.findBackupsByDate(targetDate);

if (results.database.length === 0 && results.reports.length === 0) {
  console.log('\n📋 SUGGESTIONS:');
  console.log('---------------');
  console.log('• Check available dates with: node backup-data-manager.js');
  console.log('• Try a different date format: YYYY-MM-DD');
  console.log('• Make sure you have performed Close Sell operation on that date');
  
  // Show available dates
  console.log('\n📅 Available dates:');
  const availableDates = manager.listAvailableDates();
  if (availableDates.length > 0) {
    console.log('\nTry one of these dates:');
    availableDates.slice(0, 5).forEach(date => {
      console.log(`  node find-date-data.js ${date}`);
    });
  }
} else {
  console.log('\n✅ SUCCESS! Found backup data for this date.');
  console.log('\n📂 NEXT STEPS:');
  console.log('---------------');
  
  if (results.database.length > 0) {
    console.log('• Copy database file to restore data from this date');
    console.log('• Use SQLite browser to view database contents');
    console.log('• Database contains all business data for this date');
  }
  
  if (results.reports.length > 0) {
    console.log('• Extract ZIP file to view PDF reports');
    console.log('• Reports contain daily summaries and analytics');
    console.log('• ZIP file also contains database backup');
  }
}

console.log('\n🔗 USEFUL COMMANDS:');
console.log('-------------------');
console.log('• View all backups: node backup-data-manager.js');
console.log('• Find specific date: node find-date-data.js YYYY-MM-DD');
console.log('• Access files directly from backup directories');
