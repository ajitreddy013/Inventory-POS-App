const { jsPDF } = require('jspdf');
const fs = require('fs');

class PDFService {
  constructor() {
    this.doc = null;
  }

  async generateBill(billData, filePath) {
    try {
      const { 
        saleNumber, 
        customerName, 
        customerPhone, 
        items, 
        subtotal, 
        taxAmount, 
        discountAmount, 
        totalAmount, 
        paymentMethod,
        saleDate,
        shopName = 'Your Shop Name',
        shopAddress = 'Your Shop Address',
        shopPhone = 'Your Shop Phone',
        shopEmail = 'info@yourshop.com'
      } = billData;

      // Create new PDF document
      this.doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set font
      this.doc.setFont('helvetica');

      // Header
      this.doc.setFontSize(20);
      this.doc.setTextColor(0, 0, 0);
      this.doc.text(shopName, 105, 20, { align: 'center' });
      
      this.doc.setFontSize(12);
      this.doc.text(shopAddress, 105, 30, { align: 'center' });
      this.doc.text(`Phone: ${shopPhone}`, 105, 37, { align: 'center' });
      this.doc.text(`Email: ${shopEmail}`, 105, 44, { align: 'center' });

      // Line separator
      this.doc.setLineWidth(0.5);
      this.doc.line(15, 50, 195, 50);

      // Invoice details
      this.doc.setFontSize(16);
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('INVOICE', 105, 65, { align: 'center' });

      this.doc.setFontSize(12);
      this.doc.text(`Invoice No: ${saleNumber}`, 15, 80);
      this.doc.text(`Date: ${new Date(saleDate).toLocaleDateString()}`, 15, 87);
      this.doc.text(`Time: ${new Date(saleDate).toLocaleTimeString()}`, 15, 94);

      // Customer details
      this.doc.text('Bill To:', 15, 110);
      this.doc.text(customerName || 'Walk-in Customer', 15, 117);
      if (customerPhone) {
        this.doc.text(`Phone: ${customerPhone}`, 15, 124);
      }

      // Table header
      let yPosition = 145;
      this.doc.setFontSize(10);
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFillColor(100, 100, 100);
      this.doc.rect(15, yPosition - 5, 180, 8, 'F');
      
      this.doc.text('Item', 18, yPosition);
      this.doc.text('Qty', 120, yPosition);
      this.doc.text('Price', 140, yPosition);
      this.doc.text('Total', 170, yPosition);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      yPosition += 10;
      
      items.forEach((item, index) => {
        if (yPosition > 250) {
          // Add new page if needed
          this.doc.addPage();
          yPosition = 30;
        }
        
        // Alternate row colors
        if (index % 2 === 0) {
          this.doc.setFillColor(245, 245, 245);
          this.doc.rect(15, yPosition - 5, 180, 8, 'F');
        }
        
        this.doc.text(item.name, 18, yPosition);
        this.doc.text(item.quantity.toString(), 120, yPosition);
        this.doc.text(`₹${item.unitPrice.toFixed(2)}`, 140, yPosition);
        this.doc.text(`₹${item.totalPrice.toFixed(2)}`, 170, yPosition);
        
        yPosition += 8;
      });

      // Summary section
      yPosition += 10;
      this.doc.setLineWidth(0.5);
      this.doc.line(120, yPosition, 195, yPosition);
      
      yPosition += 10;
      this.doc.setFontSize(11);
      this.doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, 140, yPosition);
      
      if (discountAmount > 0) {
        yPosition += 7;
        this.doc.text(`Discount: ₹${discountAmount.toFixed(2)}`, 140, yPosition);
      }
      
      if (taxAmount > 0) {
        yPosition += 7;
        this.doc.text(`Tax: ₹${taxAmount.toFixed(2)}`, 140, yPosition);
      }
      
      yPosition += 7;
      this.doc.setLineWidth(0.5);
      this.doc.line(120, yPosition, 195, yPosition);
      
      yPosition += 10;
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`TOTAL: ₹${totalAmount.toFixed(2)}`, 140, yPosition);
      
      yPosition += 10;
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Payment Method: ${paymentMethod.toUpperCase()}`, 140, yPosition);

      // Footer
      yPosition = 280;
      this.doc.setFontSize(10);
      this.doc.setTextColor(100, 100, 100);
      this.doc.text('Thank you for your business!', 105, yPosition, { align: 'center' });
      this.doc.text('Visit us again!', 105, yPosition + 7, { align: 'center' });

      // Save PDF
      const pdfBuffer = this.doc.output('arraybuffer');
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  }

  async generateInventoryReport(inventoryData, filePath) {
    try {
      this.doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Header
      this.doc.setFontSize(18);
      this.doc.text('Inventory Report', 148, 20, { align: 'center' });
      this.doc.setFontSize(12);
      this.doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 30, { align: 'center' });

      // Table header
      let yPosition = 50;
      this.doc.setFontSize(10);
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFillColor(100, 100, 100);
      this.doc.rect(15, yPosition - 5, 267, 8, 'F');
      
      this.doc.text('Product', 18, yPosition);
      this.doc.text('SKU', 80, yPosition);
      this.doc.text('Godown', 120, yPosition);
      this.doc.text('Counter', 150, yPosition);
      this.doc.text('Total', 180, yPosition);
      this.doc.text('Price', 210, yPosition);
      this.doc.text('Value', 240, yPosition);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      yPosition += 10;
      
      inventoryData.forEach((item, index) => {
        if (yPosition > 190) {
          this.doc.addPage();
          yPosition = 30;
        }
        
        if (index % 2 === 0) {
          this.doc.setFillColor(245, 245, 245);
          this.doc.rect(15, yPosition - 5, 267, 8, 'F');
        }
        
        this.doc.text(item.name, 18, yPosition);
        this.doc.text(item.sku, 80, yPosition);
        this.doc.text(item.godown_stock.toString(), 120, yPosition);
        this.doc.text(item.counter_stock.toString(), 150, yPosition);
        this.doc.text(item.total_stock.toString(), 180, yPosition);
        this.doc.text(`₹${item.price.toFixed(2)}`, 210, yPosition);
        this.doc.text(`₹${(item.total_stock * item.price).toFixed(2)}`, 240, yPosition);
        
        yPosition += 8;
      });

      const pdfBuffer = this.doc.output('arraybuffer');
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error('Inventory report generation error:', error);
      throw error;
    }
  }
}

module.exports = PDFService;
