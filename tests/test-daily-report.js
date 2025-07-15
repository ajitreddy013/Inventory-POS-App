const DailyReportService = require('../src/services/dailyReportService-simple');
const { getLocalDateString } = require('../src/utils/dateUtils');
const path = require('path');
const fs = require('fs');

async function testDailyReport() {
  console.log('🔄 Testing Enhanced Daily Report Service...');
  
  try {
    const dailyReportService = new DailyReportService();
    
    // Initialize database first
    console.log('🔌 Initializing database...');
    await dailyReportService.db.initialize();
    console.log('✅ Database initialized successfully!');
    
    // Get today's date
    const today = getLocalDateString();
    console.log(`📅 Generating report for date: ${today}`);
    
    // Create output directory for reports
    const outputDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('📊 Collecting dashboard data...');
    
    // Test collecting dashboard data
    const dashboardData = await dailyReportService.collectDashboardData(today);
    console.log('✅ Dashboard data collected successfully!');
    console.log('📈 Dashboard Summary:');
    console.log(`   - Total Products: ${dashboardData.totalProducts}`);
    console.log(`   - Low Stock Items: ${dashboardData.lowStockItems}`);
    console.log(`   - Today's Sales: ${dashboardData.todaySales}`);
    console.log(`   - Total Revenue: ₹${dashboardData.totalRevenue.toFixed(2)}`);
    console.log(`   - Total Spendings: ₹${dashboardData.totalSpendings.toFixed(2)}`);
    console.log(`   - Net Income: ₹${dashboardData.netIncome.toFixed(2)}`);
    console.log(`   - Total Balance: ₹${dashboardData.totalBalance.toFixed(2)}`);
    console.log(`   - Top Items: ${dashboardData.topItems.length} items`);
    
    console.log('\n📄 Generating complete daily report...');
    
    // Generate complete daily report
    const result = await dailyReportService.generateCompleteDailyReport(today, outputDir);
    
    if (result.success) {
      console.log('✅ Daily report generated successfully!');
      console.log(`📁 Report saved to: ${result.dailyReportPath}`);
      
      // Check if additional reports were generated
      const salesReportPath = path.join(outputDir, `SalesReport_${today}.pdf`);
      const financialReportPath = path.join(outputDir, `FinancialReport_${today}.pdf`);
      
      if (fs.existsSync(salesReportPath)) {
        console.log(`📊 Sales report generated: ${salesReportPath}`);
      }
      
      if (fs.existsSync(financialReportPath)) {
        console.log(`💰 Financial report generated: ${financialReportPath}`);
      }
      
      console.log('\n📧 Email notification sent (if configured)');
      console.log('✨ Test completed successfully!');
      
    } else {
      console.error('❌ Failed to generate daily report');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Error details:', error);
  }
}

// Run the test
testDailyReport().then(() => {
  console.log('\n🎉 Daily Report Test Completed!');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test failed with error:', error);
  process.exit(1);
});
