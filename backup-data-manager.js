/**
 * BACKUP DATA MANAGEMENT UTILITY
 * 
 * This utility helps you manage and view all your historical backup data.
 * Since all backups are preserved permanently, this tool helps you:
 * - List all available backups by date
 * - View backup details
 * - Organize backup data
 * - Find specific date backups
 */

const fs = require('fs');
const path = require('path');

class BackupDataManager {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups');
    this.dbBackupDir = path.join(this.backupDir, 'database');
    this.reportsBackupDir = path.join(this.backupDir, 'reports');
  }

  /**
   * List all available database backups
   */
  listDatabaseBackups() {
    console.log('\n📁 DATABASE BACKUPS:');
    console.log('==================');
    
    if (!fs.existsSync(this.dbBackupDir)) {
      console.log('No database backups found.');
      return [];
    }

    const backups = fs.readdirSync(this.dbBackupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(this.dbBackupDir, file);
        const stats = fs.statSync(filePath);
        
        // Extract date from filename (format: inventory-backup-YYYY-MM-DD-timestamp.db)
        const dateMatch = file.match(/inventory-backup-(\d{4}-\d{2}-\d{2})-(\d+)\.db/);
        const backupDate = dateMatch ? dateMatch[1] : 'Unknown';
        const timestamp = dateMatch ? dateMatch[2] : 'Unknown';
        
        return {
          filename: file,
          path: filePath,
          date: backupDate,
          timestamp: timestamp,
          size: this.formatFileSize(stats.size),
          created: stats.mtime.toISOString().split('T')[0],
          fullCreated: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.fullCreated) - new Date(a.fullCreated));

    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.date} (${backup.size})`);
      console.log(`   File: ${backup.filename}`);
      console.log(`   Path: ${backup.path}`);
      console.log(`   Created: ${backup.fullCreated}`);
      console.log('');
    });

    return backups;
  }

  /**
   * List all available report backups
   */
  listReportBackups() {
    console.log('\n📊 REPORT BACKUPS:');
    console.log('==================');
    
    if (!fs.existsSync(this.reportsBackupDir)) {
      console.log('No report backups found.');
      return [];
    }

    const backups = fs.readdirSync(this.reportsBackupDir)
      .filter(file => file.endsWith('.zip'))
      .map(file => {
        const filePath = path.join(this.reportsBackupDir, file);
        const stats = fs.statSync(filePath);
        
        // Extract date from filename (format: reports-YYYY-MM-DD-timestamp.zip)
        const dateMatch = file.match(/reports-(\d{4}-\d{2}-\d{2})-(\d+)\.zip/);
        const backupDate = dateMatch ? dateMatch[1] : 'Unknown';
        const timestamp = dateMatch ? dateMatch[2] : 'Unknown';
        
        return {
          filename: file,
          path: filePath,
          date: backupDate,
          timestamp: timestamp,
          size: this.formatFileSize(stats.size),
          created: stats.mtime.toISOString().split('T')[0],
          fullCreated: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.fullCreated) - new Date(a.fullCreated));

    backups.forEach((backup, index) => {
      console.log(`${index + 1}. ${backup.date} (${backup.size})`);
      console.log(`   File: ${backup.filename}`);
      console.log(`   Path: ${backup.path}`);
      console.log(`   Created: ${backup.fullCreated}`);
      console.log('');
    });

    return backups;
  }

  /**
   * Find backups for a specific date
   */
  findBackupsByDate(targetDate) {
    console.log(`\n🔍 BACKUPS FOR ${targetDate}:`);
    console.log('===============================');
    
    const dbBackups = this.listDatabaseBackups().filter(backup => backup.date === targetDate);
    const reportBackups = this.listReportBackups().filter(backup => backup.date === targetDate);
    
    if (dbBackups.length === 0 && reportBackups.length === 0) {
      console.log(`No backups found for ${targetDate}`);
      return { database: [], reports: [] };
    }

    console.log(`Found ${dbBackups.length} database backup(s) and ${reportBackups.length} report backup(s)`);
    
    if (dbBackups.length > 0) {
      console.log('\nDatabase Backups:');
      dbBackups.forEach(backup => {
        console.log(`  📁 ${backup.filename} (${backup.size})`);
        console.log(`     Path: ${backup.path}`);
      });
    }
    
    if (reportBackups.length > 0) {
      console.log('\nReport Backups:');
      reportBackups.forEach(backup => {
        console.log(`  📊 ${backup.filename} (${backup.size})`);
        console.log(`     Path: ${backup.path}`);
      });
    }

    return { database: dbBackups, reports: reportBackups };
  }

  /**
   * Get backup statistics
   */
  getBackupStats() {
    const dbBackups = this.listDatabaseBackups();
    const reportBackups = this.listReportBackups();
    
    const totalDbSize = dbBackups.reduce((sum, backup) => sum + this.parseFileSize(backup.size), 0);
    const totalReportSize = reportBackups.reduce((sum, backup) => sum + this.parseFileSize(backup.size), 0);
    
    console.log('\n📈 BACKUP STATISTICS:');
    console.log('=====================');
    console.log(`Total Database Backups: ${dbBackups.length}`);
    console.log(`Total Report Backups: ${reportBackups.length}`);
    console.log(`Total Database Size: ${this.formatFileSize(totalDbSize)}`);
    console.log(`Total Report Size: ${this.formatFileSize(totalReportSize)}`);
    console.log(`Total Size: ${this.formatFileSize(totalDbSize + totalReportSize)}`);
    
    if (dbBackups.length > 0) {
      console.log(`Oldest Database Backup: ${dbBackups[dbBackups.length - 1].date}`);
      console.log(`Newest Database Backup: ${dbBackups[0].date}`);
    }
    
    if (reportBackups.length > 0) {
      console.log(`Oldest Report Backup: ${reportBackups[reportBackups.length - 1].date}`);
      console.log(`Newest Report Backup: ${reportBackups[0].date}`);
    }

    return {
      totalDbBackups: dbBackups.length,
      totalReportBackups: reportBackups.length,
      totalDbSize: totalDbSize,
      totalReportSize: totalReportSize,
      totalSize: totalDbSize + totalReportSize
    };
  }

  /**
   * List all unique dates that have backups
   */
  listAvailableDates() {
    const dbBackups = this.listDatabaseBackups();
    const reportBackups = this.listReportBackups();
    
    const allDates = new Set();
    dbBackups.forEach(backup => allDates.add(backup.date));
    reportBackups.forEach(backup => allDates.add(backup.date));
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(b) - new Date(a));
    
    console.log('\n📅 AVAILABLE BACKUP DATES:');
    console.log('==========================');
    sortedDates.forEach((date, index) => {
      const dbCount = dbBackups.filter(b => b.date === date).length;
      const reportCount = reportBackups.filter(b => b.date === date).length;
      console.log(`${index + 1}. ${date} (${dbCount} DB, ${reportCount} Reports)`);
    });
    
    return sortedDates;
  }

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Parse file size string back to bytes (rough estimate)
   */
  parseFileSize(sizeStr) {
    const parts = sizeStr.split(' ');
    const value = parseFloat(parts[0]);
    const unit = parts[1];
    
    switch (unit) {
      case 'KB': return value * 1024;
      case 'MB': return value * 1024 * 1024;
      case 'GB': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  /**
   * Display comprehensive backup overview
   */
  displayOverview() {
    console.log('\n🗄️ COMPREHENSIVE BACKUP OVERVIEW');
    console.log('==================================');
    
    this.getBackupStats();
    this.listAvailableDates();
    
    console.log('\n💡 TIPS:');
    console.log('--------');
    console.log('• Use manager.findBackupsByDate("YYYY-MM-DD") to find specific date backups');
    console.log('• All backups are preserved permanently - no automatic deletion');
    console.log('• Database backups contain complete business data for that date');
    console.log('• Report backups contain PDF reports for that date');
    console.log('• You can manually copy/move old backups to external storage if needed');
  }
}

// Export for use in other files
module.exports = BackupDataManager;

// If run directly, show overview
if (require.main === module) {
  const manager = new BackupDataManager();
  manager.displayOverview();
}

// Usage examples:
// const manager = new BackupDataManager();
// manager.listDatabaseBackups();
// manager.listReportBackups();
// manager.findBackupsByDate('2025-07-11');
// manager.getBackupStats();
// manager.listAvailableDates();
