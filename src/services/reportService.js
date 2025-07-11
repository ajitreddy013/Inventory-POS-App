const Database = require("../database");
const { jsPDF } = require("jspdf");
const fs = require("fs");

// Import jspdf-autotable plugin
require("jspdf-autotable");

class ReportService {
  constructor() {
    this.db = new Database();
  }

  async generateSalesReport(salesData, selectedDate, filePath) {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Sales Report", 148, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Report Date: ${selectedDate}`, 148, 30, { align: "center" });
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 40, { align: "center" });

      // Table header
      let yPosition = 60;
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(50, 50, 50);
      doc.rect(15, yPosition - 5, 267, 8, "F");

      doc.text("Sale Number", 18, yPosition);
      doc.text("Type", 55, yPosition);
      doc.text("Customer", 80, yPosition);
      doc.text("Items", 120, yPosition);
      doc.text("Cost Price", 140, yPosition);
      doc.text("Sale Price", 170, yPosition);
      doc.text("Profit", 200, yPosition);
      doc.text("Date", 230, yPosition);

      // Table items
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;

      salesData.forEach((sale, index) => {
        if (yPosition > 180) {
          doc.addPage();
          yPosition = 30;
        }

        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(15, yPosition - 5, 267, 8, "F");
        }

        const saleAmount = sale.total_amount || 0;
        const costPrice = sale.total_cost_price || 0;
        const profit = sale.profit || (saleAmount - costPrice);

        doc.setFont("helvetica", "normal");
        doc.text(sale.sale_number, 18, yPosition);
        doc.text(sale.sale_type === "table" ? "Table" : "Parcel", 55, yPosition);
        doc.text(sale.customer_name || "Walk-in", 80, yPosition);
        doc.text(String(sale.item_count || 0), 120, yPosition, { align: "center" });
        doc.text(`${costPrice.toFixed(2)}`, 140, yPosition, { align: "center" });
        doc.text(`${saleAmount.toFixed(2)}`, 170, yPosition, { align: "center" });
        doc.text(`${profit.toFixed(2)}`, 200, yPosition, { align: "center" });
        doc.text(new Date(sale.sale_date).toLocaleDateString(), 230, yPosition);

        totalRevenue += saleAmount;
        totalCost += costPrice;
        totalProfit += profit;

        yPosition += 8;
      });

      // Total section
      yPosition += 10;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(220, 220, 220);
      doc.rect(15, yPosition - 5, 267, 25, "F");
      
      doc.text(`Total Revenue: ${totalRevenue.toFixed(2)}`, 20, yPosition + 2);
      doc.text(`Total Cost: ${totalCost.toFixed(2)}`, 20, yPosition + 9);
      doc.text(`Total Profit: ${totalProfit.toFixed(2)}`, 20, yPosition + 16);
      doc.text(`Total Transactions: ${salesData.length}`, 150, yPosition + 9, { align: "center" });

      const pdfBuffer = doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error("Failed to generate sales report: ", error);
      throw error;
    }
  }

  async generateFinancialReport(reportData, selectedDate, filePath) {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Financial Report", 148, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Report Date: ${selectedDate}`, 148, 30, { align: "center" });
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 40, { align: "center" });

      // Financial Summary
      let yPosition = 60;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Financial Summary", 15, yPosition);
      
      yPosition += 15;
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Revenue: ${reportData.totalRevenue.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total Spendings: ${reportData.totalSpendings.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Opening Balance: ${reportData.totalOpeningBalance.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Net Income: ${reportData.netIncome.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total Balance: ${reportData.totalBalance.toFixed(2)}`, 20, yPosition);

      // Sales Details
      yPosition += 20;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sales Details", 15, yPosition);

      if (reportData.sales && reportData.sales.length > 0) {
        const salesHeaders = ["Sale Number", "Type", "Customer", "Amount", "Date"];
        const salesRows = reportData.sales.map(sale => ([
          sale.sale_number,
          sale.sale_type === "table" ? "Table" : "Parcel",
          sale.customer_name || "Walk-in",
          `${sale.total_amount.toFixed(2)}`,
          new Date(sale.sale_date).toLocaleDateString()
        ]));

        doc.autoTable({ 
          head: [salesHeaders], 
          body: salesRows, 
          startY: yPosition + 5,
          theme: "grid",
          headStyles: { fillColor: [50, 50, 50] },
          alternateRowStyles: { fillColor: [240, 240, 240] },
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 20 },
            2: { cellWidth: 40 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }

      // Spendings Details
      if (reportData.spendings && reportData.spendings.length > 0) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Spendings Details", 15, yPosition);

        const spendingsHeaders = ["Description", "Category", "Amount", "Payment Method", "Date"];
        const spendingsRows = reportData.spendings.map(spending => ([
          spending.description,
          spending.category,
          `${spending.amount.toFixed(2)}`,
          spending.payment_method.replace("_", " ").toUpperCase(),
          new Date(spending.spending_date).toLocaleDateString()
        ]));

        doc.autoTable({ 
          head: [spendingsHeaders], 
          body: spendingsRows, 
          startY: yPosition + 5,
          theme: "grid",
          headStyles: { fillColor: [50, 50, 50] },
          alternateRowStyles: { fillColor: [240, 240, 240] },
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }

      // Counter Balance Details
      if (reportData.counterBalances && reportData.counterBalances.length > 0) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Opening Balance Details", 15, yPosition);

        const balanceHeaders = ["Date", "Opening Balance", "Notes"];
        const balanceRows = reportData.counterBalances.map(balance => ([
          new Date(balance.balance_date).toLocaleDateString(),
          `${balance.opening_balance.toFixed(2)}`,
          balance.notes || "-"
        ]));

        doc.autoTable({ 
          head: [balanceHeaders], 
          body: balanceRows, 
          startY: yPosition + 5,
          theme: "grid",
          headStyles: { fillColor: [50, 50, 50] },
          alternateRowStyles: { fillColor: [240, 240, 240] },
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 40 },
            2: { cellWidth: 70 }
          }
        });
      }

      const pdfBuffer = doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error("Failed to generate financial report: ", error);
      throw error;
    }
  }
}

module.exports = ReportService;
