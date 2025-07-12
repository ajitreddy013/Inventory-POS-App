const Database = require("../database");
const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");
const { 
  getLocalDateString, 
  formatDateForDisplay,
  getCurrentTimeString,
  getStartOfDay,
  getEndOfDay,
  formatDateTimeToString
} = require("../utils/dateUtils");
const EmailService = require("../email-service");
const PDFService = require("../pdf-service");
const ReportService = require("./reportService");

// Import jspdf-autotable plugin
require("jspdf-autotable");

// Initialize jsPDF with autotable plugin
if (typeof jsPDF.API.autoTable === 'undefined') {
  console.warn('jsPDF autoTable plugin not loaded, trying alternative import...');
  try {
    const { autoTable } = require('jspdf-autotable');
    jsPDF.API.autoTable = autoTable;
  } catch (error) {
    console.error('Failed to load jsPDF autotable plugin:', error);
  }
}

class DailyReportService {
  constructor() {
    this.db = new Database();
    this.emailService = new EmailService();
    this.pdfService = new PDFService();
    this.reportService = new ReportService();
  }

  async collectDashboardData(selectedDate) {
    try {
      const db = this.db;
      
      // Get inventory data
      const inventory = await db.getInventory();
      const lowStockItems = inventory.filter(
        (item) => item.godown_stock + item.counter_stock <= item.min_stock_level
      );

      // Get sales data for the selected date
      const sales = await db.getSales({
        start: getStartOfDay(selectedDate),
        end: getEndOfDay(selectedDate),
      });

      // Calculate sales metrics
      const tableSales = sales.filter(sale => sale.sale_type === 'table').length;
      const parcelSales = sales.filter(sale => sale.sale_type === 'parcel').length;
      const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalCostPrice = sales.reduce((sum, sale) => sum + (sale.total_cost_price || 0), 0);
      const totalProfit = totalRevenue - totalCostPrice;

      // Get spendings data
      const spendings = await db.getSpendings({
        start: getStartOfDay(selectedDate),
        end: getEndOfDay(selectedDate),
      });
      const totalSpendings = spendings.reduce((sum, spending) => sum + spending.amount, 0);

      // Get counter balance data
      const counterBalance = await db.getCounterBalance(selectedDate);
      const openingBalance = counterBalance ? counterBalance.opening_balance : 0;
      
      // Calculate net income and total balance
      const netIncome = totalRevenue - totalSpendings;
      const totalBalance = netIncome + openingBalance;

      // Get top selling items
      const topItems = await this.getTopSellingItems(selectedDate);

      // Get recent transactions for context
      const recentTransactions = sales.slice(-10);

      return {
        // Dashboard metrics
        totalProducts: inventory.length,
        lowStockItems: lowStockItems.length,
        todaySales: sales.length,
        totalTransactions: sales.length,
        tableSales: tableSales,
        parcelSales: parcelSales,
        
        // Financial metrics
        totalRevenue: totalRevenue,
        totalCostPrice: totalCostPrice,
        totalProfit: totalProfit,
        totalSpendings: totalSpendings,
        totalOpeningBalance: openingBalance,
        netIncome: netIncome,
        totalBalance: totalBalance,
        
        // Additional data
        topItems: topItems,
        sales: sales,
        spendings: spendings,
        counterBalances: counterBalance ? [counterBalance] : [],
        recentTransactions: recentTransactions,
        lowStockProducts: lowStockItems,
        
        // Meta data
        reportDate: selectedDate,
        generatedAt: formatDateTimeToString(new Date())
      };
    } catch (error) {
      console.error('Failed to collect dashboard data:', error);
      throw error;
    }
  }

  async getTopSellingItems(selectedDate) {
    try {
      const db = this.db;
      const query = `
        SELECT 
          p.name,
          p.variant,
          SUM(si.quantity) as quantity,
          SUM(si.quantity * si.unit_price) as revenue,
          AVG(si.unit_price) as avg_price
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE DATE(s.sale_date) = ?
        GROUP BY si.product_id
        ORDER BY quantity DESC
        LIMIT 10
      `;
      
      return new Promise((resolve, reject) => {
        db.db.all(query, [selectedDate], (err, rows) => {
          if (err) {
            console.error('Error fetching top selling items:', err);
            resolve([]);
          } else {
            const topItems = rows.map(item => ({
              name: item.variant ? `${item.name} (${item.variant})` : item.name,
              quantity: item.quantity,
              revenue: item.revenue,
              avgPrice: item.avg_price
            }));
            resolve(topItems);
          }
        });
      });
    } catch (error) {
      console.error('Failed to get top selling items:', error);
      return [];
    }
  }

  async generateCompleteDailyReport(selectedDate, outputDir) {
    try {
      // Collect all dashboard data
      const reportData = await this.collectDashboardData(selectedDate);
      
      // Generate main daily report
      const dailyReportPath = path.join(outputDir, `DailyReport_${selectedDate}.pdf`);
      await this.generateDailyReport(reportData, selectedDate, dailyReportPath);
      
      return {
        success: true,
        reportData: reportData,
        dailyReportPath: dailyReportPath
      };
    } catch (error) {
      console.error('Failed to generate complete daily report:', error);
      throw error;
    }
  }

  async generateDailyReport(reportData, selectedDate, filePath) {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Business Report", 105, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Report Date: ${formatDateForDisplay(selectedDate)}`, 105, 30, { align: "center" });
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${getCurrentTimeString()}`, 105, 40, { align: "center" });

      // Dashboard Overview Section
      let yPosition = 60;
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Dashboard Overview", 15, yPosition);
      yPosition += 15;

      // Dashboard metrics table
      yPosition = this.drawDashboardTable(doc, reportData, yPosition);
      yPosition += 20; // Add some spacing

      // Financial Summary Section
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Financial Summary", 15, yPosition);
      yPosition += 10;

      const financialData = [
        ["Financial Metric", "Amount (₹)", "Percentage"],
        ["Total Revenue", (reportData.totalRevenue || 0).toFixed(2), "100%"],
        ["Total Spendings", (reportData.totalSpendings || 0).toFixed(2), reportData.totalRevenue > 0 ? `${((reportData.totalSpendings || 0) / reportData.totalRevenue * 100).toFixed(1)}%` : "0%"],
        ["Net Income", (reportData.netIncome || 0).toFixed(2), reportData.totalRevenue > 0 ? `${((reportData.netIncome || 0) / reportData.totalRevenue * 100).toFixed(1)}%` : "0%"],
        ["Opening Balance", (reportData.totalOpeningBalance || 0).toFixed(2), "-"],
        ["Total Balance", (reportData.totalBalance || 0).toFixed(2), "-"]
      ];

doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      let tableY = yPosition;

      financialData.forEach(row => {
        doc.text(`${row[0]}`, 20, tableY);
        doc.text(`${row[1]}`, 80, tableY);
        doc.text(`${row[2]}`, 140, tableY);
        tableY += 8;
      });

      // Top Selling Items Section
      if (reportData.topItems && reportData.topItems.length > 0) {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Top Selling Items", 15, yPosition);
        yPosition += 10;

        const topItemsData = reportData.topItems.slice(0, 10).map((item, index) => [
          (index + 1).toString(),
          item.name,
          item.quantity.toString(),
          `₹${item.revenue.toFixed(2)}`,
          `₹${(item.revenue / item.quantity).toFixed(2)}`
        ]);

        doc.autoTable({
          head: [["Rank", "Item Name", "Qty Sold", "Revenue", "Avg Price"]],
          body: topItemsData,
          startY: yPosition,
          theme: "grid",
          headStyles: { fillColor: [155, 89, 182], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 60 },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 30, halign: "right" },
            4: { cellWidth: 30, halign: "right" }
          }
        });

        yPosition = doc.lastAutoTable.finalY + 20;
      }

      // Inventory Alerts Section
      if (reportData.lowStockItems && reportData.lowStockItems > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(211, 47, 47); // Red color for alerts
        doc.text("⚠️ Inventory Alerts", 15, yPosition);
        doc.setTextColor(0, 0, 0); // Reset to black
        yPosition += 10;

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`${reportData.lowStockItems} items are running low on stock and need immediate attention.`, 15, yPosition);
        doc.text("Please check the Inventory Management section for details.", 15, yPosition + 8);
        yPosition += 25;
      }

      // Performance Indicators Section
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Performance Indicators", 15, yPosition);
      yPosition += 10;

      const performanceData = [
        ["Indicator", "Today", "Status"],
        ["Revenue per Transaction", reportData.totalTransactions > 0 ? `₹${(reportData.totalRevenue / reportData.totalTransactions).toFixed(2)}` : "₹0.00", "Average"],
        ["Profit Margin", reportData.totalRevenue > 0 ? `${((reportData.netIncome / reportData.totalRevenue) * 100).toFixed(1)}%` : "0%", reportData.netIncome > 0 ? "Positive" : "Negative"],
        ["Table vs Parcel Ratio", reportData.totalTransactions > 0 ? `${Math.round((reportData.tableSales / reportData.totalTransactions) * 100)}:${Math.round((reportData.parcelSales / reportData.totalTransactions) * 100)}` : "0:0", "Balanced"],
        ["Items per Transaction", reportData.totalTransactions > 0 && reportData.topItems ? `${(reportData.topItems.reduce((sum, item) => sum + item.quantity, 0) / reportData.totalTransactions).toFixed(1)}` : "0", "Average"]
      ];

      doc.autoTable({
        head: [performanceData[0]],
        body: performanceData.slice(1),
        startY: yPosition,
        theme: "grid",
        headStyles: { fillColor: [230, 126, 34], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 40, halign: "center" },
          2: { cellWidth: 30, halign: "center" }
        }
      });

      yPosition = doc.lastAutoTable.finalY + 20;

      // Summary and Notes Section
      if (yPosition > 220) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Summary", 15, yPosition);
      yPosition += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      const summaryText = [
        `• Total business for ${formatDateForDisplay(selectedDate)}: ₹${(reportData.totalRevenue || 0).toFixed(2)}`,
        `• Operating expenses: ₹${(reportData.totalSpendings || 0).toFixed(2)}`,
        `• Net profit/loss: ₹${(reportData.netIncome || 0).toFixed(2)}`,
        `• Customer transactions processed: ${reportData.totalTransactions || 0}`,
        `• Inventory status: ${reportData.lowStockItems || 0} items need restocking`
      ];

      summaryText.forEach(text => {
        doc.text(text, 15, yPosition);
        yPosition += 7;
      });

      // Footer
      yPosition = Math.max(yPosition + 20, 270);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("This is an automated daily business report generated by the POS system.", 105, yPosition, { align: "center" });
      doc.text("For detailed analysis, please refer to the attached Sales and Financial reports.", 105, yPosition + 7, { align: "center" });

      const pdfBuffer = doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      // Generate detailed reports
      const salesReportPath = path.join(path.dirname(filePath), `SalesReport_${getLocalDateString()}.pdf`);
      const financialReportPath = path.join(path.dirname(filePath), `FinancialReport_${getLocalDateString()}.pdf`);
      
      if (reportData.sales && reportData.sales.length > 0) {
        await this.reportService.generateSalesReport(reportData.sales, selectedDate, salesReportPath);
      }
      
      await this.reportService.generateFinancialReport(reportData, selectedDate, financialReportPath);

      // Send report via email with attachments
      const attachments = [{ path: filePath, filename: 'DailyReport.pdf' }];
      if (fs.existsSync(salesReportPath)) {
        attachments.push({ path: salesReportPath, filename: 'SalesReport.pdf' });
      }
      if (fs.existsSync(financialReportPath)) {
        attachments.push({ path: financialReportPath, filename: 'FinancialReport.pdf' });
      }
      
      await this.emailService.sendDailyReport(reportData, attachments);

      return { success: true, filePath, attachments: attachments.map(att => att.path) };
    } catch (error) {
      console.error("Failed to generate daily report: ", error);
      throw error;
    }
  }

  drawDashboardTable(doc, reportData, yPosition) {
    try {
      // Dashboard metrics data
      const dashboardData = [
        ["Dashboard Metric", "Value", "Status"],
        ["Total Products", (reportData.totalProducts || 0).toString(), "Active"],
        ["Low Stock Items", (reportData.lowStockItems || 0).toString(), reportData.lowStockItems > 0 ? "⚠️ Alert" : "✅ Good"],
        ["Today's Sales Count", (reportData.todaySales || 0).toString(), "Transactions"],
        ["Total Transactions", (reportData.totalTransactions || 0).toString(), "Processed"],
        ["Table Sales", (reportData.tableSales || 0).toString(), "Dine-in"],
        ["Parcel Sales", (reportData.parcelSales || 0).toString(), "Takeaway"],
        ["Revenue per Transaction", reportData.totalTransactions > 0 ? `₹${(reportData.totalRevenue / reportData.totalTransactions).toFixed(2)}` : "₹0.00", "Average"],
        ["Profit Margin", reportData.totalRevenue > 0 ? `${((reportData.netIncome / reportData.totalRevenue) * 100).toFixed(1)}%` : "0%", reportData.netIncome > 0 ? "Positive" : "Negative"]
      ];

      // Use autoTable for better formatting
      doc.autoTable({
        head: [dashboardData[0]],
        body: dashboardData.slice(1),
        startY: yPosition,
        theme: "grid",
        headStyles: { 
          fillColor: [52, 152, 219], 
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { 
          fontSize: 10,
          cellPadding: 5
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40, halign: "center" },
          2: { cellWidth: 40, halign: "center" }
        }
      });

      return doc.lastAutoTable.finalY;
    } catch (error) {
      console.error('Error drawing dashboard table:', error);
      // Fallback to simple text if table fails
      doc.setFontSize(10);
      doc.text(`Total Products: ${reportData.totalProducts || 0}`, 15, yPosition);
      doc.text(`Low Stock Items: ${reportData.lowStockItems || 0}`, 15, yPosition + 10);
      doc.text(`Today's Sales: ${reportData.todaySales || 0}`, 15, yPosition + 20);
      doc.text(`Total Revenue: ₹${(reportData.totalRevenue || 0).toFixed(2)}`, 15, yPosition + 30);
      return yPosition + 50;
    }
  }
}

module.exports = DailyReportService;
