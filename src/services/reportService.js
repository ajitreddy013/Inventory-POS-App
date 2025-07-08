const Database = require("./database");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");

class ReportService {
  constructor() {
    this.db = new Database();
  }

  async generateSalesReport(dateRange) {
    try {
      // Fetch product cost and sales data
      const salesData = await this.db.getSales(dateRange);
      const productData = await this.db.getProducts();
      
      // Calculate report data
      const reportData = salesData.map(sale => {
        const items = sale.items_summary.split(',');
        let totalCost = 0;
        for (let item of items) {
          const [name, qty] = item.split(' x');
          const product = productData.find(p => p.name === name.trim());
          if (product) {
            totalCost += (product.cost * parseInt(qty.trim()));
          }
        }
        return {
          saleNumber: sale.sale_number,
          totalAmount: sale.total_amount,
          totalCost: totalCost.toFixed(2),
          profit: (sale.total_amount - totalCost).toFixed(2),
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

    const headers = ["Sale Number", "Total Cost", "Total Amount", "Profit", "Sale Date"];
    const rows = data.map(item => ([
      item.saleNumber, 
      `₹${item.totalCost}`,
      `₹${item.totalAmount.toFixed(2)}`,
      `₹${item.profit}`,
      new Date(item.saleDate).toLocaleDateString()
    ]));

    doc.autoTable({ head: [headers], body: rows, startY: 30 });
    doc.save(`Sales_Report_${Date.now()}.pdf`);
  }
}

module.exports = ReportService;
