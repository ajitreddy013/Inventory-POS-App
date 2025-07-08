const Database = require("./database");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

class ReportService {
  constructor() {
    this.db = new Database();
  }

  async generateSalesReport(dateRange) {
    try {
      // Fetch sales data with detailed cost and profit
      const salesData = await this.db.getSalesWithDetails(dateRange);
      
      // Transform report data
      const reportData = salesData.map(sale => {
        return {
          saleNumber: sale.sale_number,
          totalCostPrice: sale.total_cost_price.toFixed(2),
          totalSalePrice: sale.total_sale_price.toFixed(2),
          profit: sale.profit.toFixed(2),
          saleDate: sale.sale_date
        };
      });

      // Generate PDF report
      this.createPDF(reportData);
    } catch (error) {
      console.error("Failed to generate report: ", error);
    }
  }

  createPDF(data) {
    const doc = new jsPDF();
    doc.text("Sales Report", 14, 20);

    const headers = ["Sale Number", "Cost Price", "Sale Price", "Profit", "Sale Date"];
    const rows = data.map(item => ([
      item.saleNumber, 
      `₹${item.totalCostPrice}`,
      `₹${item.totalSalePrice}`,
      `₹${item.profit}`,
      new Date(item.saleDate).toLocaleDateString()
    ]));

    doc.autoTable({ head: [headers], body: rows, startY: 30 });
    doc.save(`Sales_Report_${Date.now()}.pdf`);
  }
}

module.exports = ReportService;
