const { jsPDF } = require("jspdf");
const fs = require("fs");
const { 
  parseLocalDateString, 
  formatDateForDisplay,
  formatTimeString,
  getLocalDateString,
  getCurrentTimeString
} = require("./utils/dateUtils");

class PDFService {
  constructor() {
    this.doc = null;
  }

  async generateBill(billData, filePath) {
    try {
      const {
        saleNumber,
        saleType,
        tableNumber,
        customerName,
        customerPhone,
        items,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        paymentMethod,
        saleDate,
        barSettings,
      } = billData;

      // Use bar settings or fallback to defaults
      const shopName = barSettings?.bar_name || "Ajit Bar & Restaurant";
      const shopAddress = barSettings?.address || "Address not set";
      const shopPhone = barSettings?.contact_number || "Phone not set";
      const gstNumber = barSettings?.gst_number || "";
      const thankYouMessage =
        barSettings?.thank_you_message || "Thank you for visiting!";
      

      // Calculate dynamic height based on items count
      const baseHeight = 120; // Base height for header, footer, and summary
      const itemHeight = 5; // Height per item
      const extraHeight = 50; // Extra space for customer details, notes, etc.
      const footerHeight = 30; // Reserved space for footer with thank you message
      const dynamicHeight = Math.max(180, baseHeight + (items.length * itemHeight) + extraHeight + footerHeight);
      
      // Create new PDF document - use dynamic height for receipts
      this.doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, dynamicHeight], // Dynamic receipt size
      });

      // Set font
      this.doc.setFont("helvetica");

      // Header
      this.doc.setFontSize(14);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(shopName, 40, 10, { align: "center" });

      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(shopAddress, 40, 18, { align: "center" });
      this.doc.text(`Phone: ${shopPhone}`, 40, 24, { align: "center" });
      if (gstNumber) {
        this.doc.text(`GST: ${gstNumber}`, 40, 30, { align: "center" });
      }

      // Line separator
      this.doc.setLineWidth(0.3);
      this.doc.line(5, 35, 75, 35);

      // Invoice details - Two column layout
      this.doc.setFontSize(12);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("BILL", 40, 45, { align: "center" });

      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      
      // Parse and format the sale date using local time
      const saleDateTime = parseLocalDateString(saleDate);
      const formattedDate = formatDateForDisplay(saleDate);
      const formattedTime = saleDateTime ? formatTimeString(saleDateTime) : getCurrentTimeString();

      // Left column (x=5 to x=35)
      this.doc.text(`Date: ${formattedDate}`, 5, 55);
      this.doc.text(`Time: ${formattedTime}`, 5, 61);

      // Sale type and table info
      if (saleType === "table" && tableNumber) {
        this.doc.text(`Table No: ${tableNumber}`, 5, 67);
      } else {
        this.doc.text(
          `${saleType === "parcel" ? "Parcel" : "Table"} Order`,
          5,
          67
        );
      }

      // Right column (x=40 to x=75) - Customer details center aligned
      this.doc.text(`Bill No: ${saleNumber}`, 57.5, 55, { align: "center" });

      // Only show customer details if they exist
      if (customerName && customerName.trim() !== "") {
        // Truncate customer name if too long for proper alignment
        const displayCustomerName =
          customerName.length > 15
            ? customerName.substring(0, 12) + "..."
            : customerName;
        this.doc.text(`Customer: ${displayCustomerName}`, 57.5, 61, {
          align: "center",
        });
      }

      if (customerPhone && customerPhone.trim() !== "") {
        this.doc.text(`Phone: ${customerPhone}`, 57.5, 67, { align: "center" });
      }

      // Separator line
      this.doc.setLineWidth(0.3);
      this.doc.line(5, 75, 75, 75);

      // Table header
      let yPosition = 85;
      this.doc.setFontSize(8);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "bold");

      this.doc.text("Item", 8, yPosition);
      this.doc.text("Qty", 48, yPosition, { align: "center" });
      this.doc.text("Rate", 58, yPosition, { align: "center" });
      this.doc.text("Amount", 73, yPosition, { align: "center" });

      // Header underline
      this.doc.setLineWidth(0.2);
      this.doc.line(5, yPosition + 2, 75, yPosition + 2);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "normal");
      yPosition += 8;

      if (!Array.isArray(items)) {
        console.error('Items is not an array:', items);
        throw new Error('Items must be an array');
      }

      items.forEach((item, index) => {
        if (yPosition > 160) {
          // Add new page if needed
          this.doc.addPage();
          yPosition = 20;
        }

        // Item name (truncate if too long)
        const itemName =
          item.name.length > 20
            ? item.name.substring(0, 17) + "..."
            : item.name;
        this.doc.text(itemName, 8, yPosition);

        // Quantity - center aligned under Qty column
        this.doc.text(item.quantity.toString(), 48, yPosition, {
          align: "center",
        });

        // Rate - center aligned under Rate column
        this.doc.text(item.unitPrice.toFixed(2), 58, yPosition, {
          align: "center",
        });

        // Amount - center aligned under Amount column
        this.doc.text(item.totalPrice.toFixed(2), 73, yPosition, {
          align: "center",
        });

        yPosition += 5;
      });

      // Items separator line
      this.doc.setLineWidth(0.2);
      this.doc.line(5, yPosition + 2, 75, yPosition + 2);

      // Summary section - All amounts in one line
      yPosition += 8;
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");

      // Labels in rate column position (around x=58)
      this.doc.text("Subtotal:", 58, yPosition, { align: "center" });

      if (discountAmount > 0) {
        this.doc.text("Discount:", 58, yPosition + 5, { align: "center" });
      }

      if (taxAmount > 0) {
        this.doc.text("Tax:", 58, yPosition + 10, { align: "center" });
      }

      this.doc.setFont("helvetica", "bold");
      this.doc.text("Total:", 58, yPosition + 15, { align: "center" });

      // Amounts in amount column position (around x=73)
      this.doc.setFont("helvetica", "normal");
      this.doc.text(subtotal.toFixed(2), 73, yPosition, {
        align: "right",
      });

      if (discountAmount > 0) {
        this.doc.text(discountAmount.toFixed(2), 73, yPosition + 5, {
          align: "right",
        });
      }

      if (taxAmount > 0) {
        this.doc.text(taxAmount.toFixed(2), 73, yPosition + 10, {
          align: "right",
        });
      }

      this.doc.setFont("helvetica", "bold");
      this.doc.text(totalAmount.toFixed(2), 73, yPosition + 15, {
        align: "right",
      });

      yPosition += 20;
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Payment: ${paymentMethod.toUpperCase()}`, 5, yPosition);

      yPosition += 8;
      this.doc.setLineWidth(0.3);
      this.doc.line(5, yPosition, 75, yPosition);

      // Footer - Always ensure footer fits within the page
      yPosition += 10;
      
      // Ensure footer is positioned correctly within the page bounds
      const footerRequiredHeight = 20;
      const minBottomMargin = 10;
      
      // If the footer would go beyond the page, position it at the bottom
      if (yPosition + footerRequiredHeight > dynamicHeight - minBottomMargin) {
        yPosition = dynamicHeight - footerRequiredHeight - minBottomMargin;
      }

      this.doc.setFontSize(10);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(thankYouMessage, 40, yPosition, { align: "center" });

      yPosition += 6;
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Visit us again at ${shopName}`, 40, yPosition, {
        align: "center",
      });

      // Save PDF
      const pdfBuffer = this.doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error("PDF generation error:", error);
      throw error;
    }
  }

  async generateStockReport(reportData, reportType, filePath) {
    try {
      this.doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Header
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      const reportTitle =
        reportType === "godown"
          ? "Godown Stock Report"
          : reportType === "counter"
          ? "Counter Stock Report"
          : "Total Stock Report";
      this.doc.text(reportTitle, 148, 20, { align: "center" });

      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");

      // Format generation date using system local time
      const todayDate = getLocalDateString();
      const formattedGenDate = formatDateForDisplay(todayDate);
      const currentTime = getCurrentTimeString();

      this.doc.text(
        `Generated on: ${formattedGenDate} ${currentTime}`,
        148,
        30,
        { align: "center" }
      );

      // Bar details from settings
      if (reportData.barSettings) {
        this.doc.setFontSize(10);
        this.doc.text(reportData.barSettings.bar_name || "Bar Name", 148, 40, {
          align: "center",
        });
        if (reportData.barSettings.address) {
          this.doc.text(reportData.barSettings.address, 148, 47, {
            align: "center",
          });
        }
      }

      // Table header
      let yPosition = 60;
      this.doc.setFontSize(10);
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFillColor(50, 50, 50);
      this.doc.rect(15, yPosition - 5, 267, 8, "F");

      this.doc.text("Product Name", 18, yPosition);
      this.doc.text("Variant/Size", 80, yPosition);

      if (reportType === "godown") {
        this.doc.text("Godown Stock", 140, yPosition);
        this.doc.text("Unit Price", 180, yPosition);
        this.doc.text("Total Value", 220, yPosition);
      } else if (reportType === "counter") {
        this.doc.text("Counter Stock", 140, yPosition);
        this.doc.text("Unit Price", 180, yPosition);
        this.doc.text("Total Value", 220, yPosition);
      } else {
        this.doc.text("Godown", 120, yPosition);
        this.doc.text("Counter", 150, yPosition);
        this.doc.text("Total", 180, yPosition);
        this.doc.text("Price", 210, yPosition);
        this.doc.text("Value", 240, yPosition);
      }

      // Table items
      this.doc.setTextColor(0, 0, 0);
      yPosition += 10;

      let totalValue = 0;

      if (!reportData.inventory || !Array.isArray(reportData.inventory)) {
        console.error('Inventory is not an array:', reportData.inventory);
        throw new Error('Inventory must be an array');
      }

      reportData.inventory.forEach((item, index) => {
        if (yPosition > 190) {
          this.doc.addPage();
          yPosition = 30;
        }

        if (index % 2 === 0) {
          this.doc.setFillColor(245, 245, 245);
          this.doc.rect(15, yPosition - 5, 267, 8, "F");
        }

        this.doc.text(item.name, 18, yPosition);
        this.doc.text(item.variant || "-", 80, yPosition);

        if (reportType === "godown") {
          const value = item.godown_stock * item.price;
          this.doc.text(item.godown_stock.toString(), 140, yPosition, {
            align: "center",
          });
          this.doc.text(item.price.toFixed(2), 180, yPosition, {
            align: "center",
          });
          this.doc.text(value.toFixed(2), 220, yPosition, {
            align: "center",
          });
          totalValue += value;
        } else if (reportType === "counter") {
          const value = item.counter_stock * item.price;
          this.doc.text(item.counter_stock.toString(), 140, yPosition, {
            align: "center",
          });
          this.doc.text(item.price.toFixed(2), 180, yPosition, {
            align: "center",
          });
          this.doc.text(value.toFixed(2), 220, yPosition, {
            align: "center",
          });
          totalValue += value;
        } else {
          const value = item.total_stock * item.price;
          this.doc.text(item.godown_stock.toString(), 120, yPosition, {
            align: "center",
          });
          this.doc.text(item.counter_stock.toString(), 150, yPosition, {
            align: "center",
          });
          this.doc.text(item.total_stock.toString(), 180, yPosition, {
            align: "center",
          });
          this.doc.text(item.price.toFixed(2), 210, yPosition, {
            align: "center",
          });
          this.doc.text(value.toFixed(2), 240, yPosition, {
            align: "center",
          });
          totalValue += value;
        }

        yPosition += 8;
      });

      // Total section
      yPosition += 10;
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFillColor(220, 220, 220);
      this.doc.rect(15, yPosition - 5, 267, 10, "F");
      this.doc.text(
        `Total Inventory Value: ${totalValue.toFixed(2)}`,
        148,
        yPosition + 2,
        { align: "center" }
      );

      const pdfBuffer = this.doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error("Stock report generation error:", error);
      throw error;
    }
  }

  async generateTransferReport(transferData, filePath) {
    try {
      this.doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Header - Check if this is a complete history report
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      const reportTitle = transferData.transfer_date.includes('Complete History') 
        ? "Complete Transfer History Report" 
        : "Daily Transfer Report";
      this.doc.text(reportTitle, 105, 20, { align: "center" });

      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Date: ${transferData.transfer_date}`, 105, 30, {
        align: "center",
      });

      // Format generation date using system local time
      const todayDate = getLocalDateString();
      const formattedGenDate = formatDateForDisplay(todayDate);
      const currentTime = getCurrentTimeString();

      this.doc.text(
        `Generated on: ${formattedGenDate} ${currentTime}`,
        105,
        37,
        { align: "center" }
      );

      // Summary section
      let yPosition = 55;
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      const summaryTitle = transferData.transfer_date.includes('Complete History') 
        ? "Complete Transfer History Summary" 
        : "Transfer Summary";
      this.doc.text(summaryTitle, 20, yPosition);

      yPosition += 10;
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "normal");
      
      if (transferData.transfer_date.includes('Complete History')) {
        this.doc.text(
          `Total Transfer Sessions: ${transferData.transfer_date.match(/\d+/)[0]}`,
          20,
          yPosition
        );
        yPosition += 7;
      }
      
      this.doc.text(
        `Total Items Transferred: ${transferData.total_items}`,
        20,
        yPosition
      );

      yPosition += 7;
      this.doc.text(
        `Total Quantity: ${transferData.total_quantity}`,
        20,
        yPosition
      );

      // Table header
      yPosition += 20;
      this.doc.setFontSize(11);
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFillColor(50, 50, 50);
      this.doc.rect(15, yPosition - 5, 180, 8, "F");

      this.doc.text("Product Name", 18, yPosition);
      this.doc.text("Variant/Size", 80, yPosition);
      this.doc.text("Quantity", 140, yPosition);
      this.doc.text("Time", 165, yPosition);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      yPosition += 10;

      if (!transferData.items_transferred || !Array.isArray(transferData.items_transferred)) {
        console.error('Items transferred is not an array:', transferData.items_transferred);
        throw new Error('Items transferred must be an array');
      }

      transferData.items_transferred.forEach((item, index) => {
        if (yPosition > 250) {
          this.doc.addPage();
          yPosition = 30;
        }

        if (index % 2 === 0) {
          this.doc.setFillColor(245, 245, 245);
          this.doc.rect(15, yPosition - 5, 180, 8, "F");
        }

        this.doc.setFont("helvetica", "normal");
        this.doc.text(item.name, 18, yPosition);
        this.doc.text(item.variant || "-", 80, yPosition);
        this.doc.text(item.quantity.toString(), 140, yPosition, {
          align: "center",
        });

        const transferTime = item.transfer_time
          ? (() => {
              const transferDateTime = parseLocalDateString(item.transfer_time);
              return transferDateTime ? formatTimeString(transferDateTime) : "-";
            })()
          : "-";
        this.doc.text(transferTime, 165, yPosition, { align: "center" });

        yPosition += 8;
      });

      // Footer
      yPosition = Math.max(yPosition + 20, 260);
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "italic");
      this.doc.text("This is a system generated report", 105, yPosition, {
        align: "center",
      });

      const pdfBuffer = this.doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error("Transfer report generation error:", error);
      throw error;
    }
  }

  async generateSalesReport(salesData, selectedDate, filePath) {
    try {
      this.doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      // Header
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Sales Report", 148, 20, { align: "center" });

      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Report Date: ${selectedDate}`, 148, 30, { align: "center" });
      this.doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 40, { align: "center" });

      // Table header
      let yPosition = 60;
      this.doc.setFontSize(10);
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFillColor(50, 50, 50);
      this.doc.rect(15, yPosition - 5, 267, 8, "F");

      this.doc.text("Sale Number", 18, yPosition);
      this.doc.text("Type", 55, yPosition);
      this.doc.text("Customer", 80, yPosition);
      this.doc.text("Items", 120, yPosition);
      this.doc.text("Cost Price", 140, yPosition);
      this.doc.text("Sale Price", 170, yPosition);
      this.doc.text("Profit", 200, yPosition);
      this.doc.text("Date", 230, yPosition);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      yPosition += 10;

      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;

      if (!salesData || !Array.isArray(salesData)) {
        console.error('Sales data is not an array:', salesData);
        throw new Error('Sales data must be an array.');
      }

      salesData.forEach((sale, index) => {
        if (yPosition > 180) {
          this.doc.addPage();
          yPosition = 30;
        }

        if (index % 2 === 0) {
          this.doc.setFillColor(245, 245, 245);
          this.doc.rect(15, yPosition - 5, 267, 8, "F");
        }

        const saleAmount = sale.total_amount || 0;
        const costPrice = sale.total_cost_price || 0;
        const profit = sale.profit || (saleAmount - costPrice);

        this.doc.setFont("helvetica", "normal");
        this.doc.text(sale.sale_number, 18, yPosition);
        this.doc.text(sale.sale_type === "table" ? "Table" : "Parcel", 55, yPosition);
        this.doc.text(sale.customer_name || "Walk-in", 80, yPosition);
        this.doc.text(String(sale.item_count || 0), 120, yPosition, { align: "center" });
        this.doc.text(`${costPrice.toFixed(2)}`, 140, yPosition, { align: "center" });
        this.doc.text(`${saleAmount.toFixed(2)}`, 170, yPosition, { align: "center" });
        this.doc.text(`${profit.toFixed(2)}`, 200, yPosition, { align: "center" });
        this.doc.text(new Date(sale.sale_date).toLocaleDateString(), 230, yPosition);

        totalRevenue += saleAmount;
        totalCost += costPrice;
        totalProfit += profit;

        yPosition += 8;
      });

      // Total section
      yPosition += 10;
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFillColor(220, 220, 220);
      this.doc.rect(15, yPosition - 5, 267, 25, "F");
      
      this.doc.text(`Total Revenue: ${totalRevenue.toFixed(2)}`, 20, yPosition + 2);
      this.doc.text(`Total Cost: ${totalCost.toFixed(2)}`, 20, yPosition + 9);
      this.doc.text(`Total Profit: ${totalProfit.toFixed(2)}`, 20, yPosition + 16);
      this.doc.text(`Total Transactions: ${salesData.length}`, 150, yPosition + 9, { align: "center" });

      const pdfBuffer = this.doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
      
      return { success: true, filePath };
    } catch (error) {
      console.error("Sales report generation error:", error);
      throw error;
    }
  }

  async generateFinancialReport(reportData, selectedDate, filePath) {
    try {
      this.doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      
      // Header
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Financial Report", 148, 20, { align: "center" });

      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Report Date: ${selectedDate}`, 148, 30, { align: "center" });
      this.doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 40, { align: "center" });

      // Financial Summary
      let yPosition = 60;
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Financial Summary", 15, yPosition);
      
      yPosition += 15;
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Total Revenue: ${reportData.totalRevenue.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      this.doc.text(`Total Spendings: ${reportData.totalSpendings.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      this.doc.text(`Opening Balance: ${reportData.totalOpeningBalance.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      this.doc.text(`Net Income: ${reportData.netIncome.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      this.doc.text(`Total Balance: ${reportData.totalBalance.toFixed(2)}`, 20, yPosition);

      // Sales Details
      yPosition += 20;
      this.doc.setFontSize(14);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Sales Details", 15, yPosition);

      if (reportData.sales && reportData.sales.length > 0) {
        yPosition += 10;
        this.doc.setFontSize(10);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFillColor(50, 50, 50);
        this.doc.rect(15, yPosition - 5, 267, 8, "F");
        
        this.doc.text("Sale Number", 18, yPosition);
        this.doc.text("Type", 70, yPosition);
        this.doc.text("Customer", 110, yPosition);
        this.doc.text("Amount", 180, yPosition);
        this.doc.text("Date", 230, yPosition);
        
        this.doc.setTextColor(0, 0, 0);
        yPosition += 10;
        
        reportData.sales.forEach((sale, index) => {
          if (yPosition > 170) {
            this.doc.addPage();
            yPosition = 30;
          }
          
          if (index % 2 === 0) {
            this.doc.setFillColor(245, 245, 245);
            this.doc.rect(15, yPosition - 5, 267, 8, "F");
          }
          
          this.doc.setFontSize(9);
          this.doc.text(sale.sale_number, 18, yPosition);
          this.doc.text(sale.sale_type === "table" ? "Table" : "Parcel", 70, yPosition);
          this.doc.text(sale.customer_name || "Walk-in", 110, yPosition);
        this.doc.text(`${sale.total_amount.toFixed(2)}`, 180, yPosition, { align: "center" });
          this.doc.text(new Date(sale.sale_date).toLocaleDateString(), 230, yPosition);
          yPosition += 8;
        });
      }
      
      // Spendings Details
      if (reportData.spendings && reportData.spendings.length > 0) {
        yPosition += 10;
        this.doc.setFontSize(14);
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Spendings Details", 15, yPosition);
        
        yPosition += 10;
        this.doc.setFontSize(10);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFillColor(50, 50, 50);
        this.doc.rect(15, yPosition - 5, 267, 8, "F");
        
        this.doc.text("Description", 18, yPosition);
        this.doc.text("Category", 100, yPosition);
        this.doc.text("Amount", 160, yPosition);
        this.doc.text("Date", 230, yPosition);
        
        this.doc.setTextColor(0, 0, 0);
        yPosition += 10;
        
        reportData.spendings.forEach((spending, index) => {
          if (yPosition > 170) {
            this.doc.addPage();
            yPosition = 30;
          }
          
          if (index % 2 === 0) {
            this.doc.setFillColor(245, 245, 245);
            this.doc.rect(15, yPosition - 5, 267, 8, "F");
          }
          
          this.doc.setFontSize(9);
          this.doc.text(spending.description.substring(0, 30), 18, yPosition);
          this.doc.text(spending.category, 100, yPosition);
        this.doc.text(`${spending.amount.toFixed(2)}`, 160, yPosition, { align: "center" });
          this.doc.text(new Date(spending.spending_date).toLocaleDateString(), 230, yPosition);
          yPosition += 8;
        });
      }
      
      // Counter Balance Details
      if (reportData.counterBalances && reportData.counterBalances.length > 0) {
        yPosition += 10;
        this.doc.setFontSize(14);
        this.doc.setFont("helvetica", "bold");
        this.doc.text("Opening Balance Details", 15, yPosition);
        
        yPosition += 10;
        this.doc.setFontSize(10);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFillColor(50, 50, 50);
        this.doc.rect(15, yPosition - 5, 267, 8, "F");
        
        this.doc.text("Date", 18, yPosition);
        this.doc.text("Opening Balance", 100, yPosition);
        this.doc.text("Notes", 180, yPosition);
        
        this.doc.setTextColor(0, 0, 0);
        yPosition += 10;
        
        reportData.counterBalances.forEach((balance, index) => {
          if (yPosition > 170) {
            this.doc.addPage();
            yPosition = 30;
          }
          
          if (index % 2 === 0) {
            this.doc.setFillColor(245, 245, 245);
            this.doc.rect(15, yPosition - 5, 267, 8, "F");
          }
          
          this.doc.setFontSize(9);
          this.doc.text(new Date(balance.balance_date).toLocaleDateString(), 18, yPosition);
        this.doc.text(`${balance.opening_balance.toFixed(2)}`, 100, yPosition, { align: "center" });
          this.doc.text(balance.notes || "-", 180, yPosition);
          yPosition += 8;
        });
      }

      const pdfBuffer = this.doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));
      
      return { success: true, filePath };
    } catch (error) {
      console.error("Financial report generation error:", error);
      throw error;
    }
  }

  async generatePendingBillsReport(pendingBillsData, filePath) {
    try {
      this.doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      // Header
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Pending Bills Report", 148, 20, { align: "center" });

      // Format generation date using system local time
      const todayDate = getLocalDateString();
      const formattedGenDate = formatDateForDisplay(todayDate);
      const currentTime = getCurrentTimeString();

      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Generated on: ${formattedGenDate} ${currentTime}`, 148, 30, { align: "center" });
      this.doc.text(`Total Bills: ${pendingBillsData.length}`, 148, 40, { align: "center" });
      this.doc.text(`Total Amount: ${pendingBillsData.reduce((sum, bill) => sum + bill.total_amount, 0).toFixed(2)}`, 148, 50, { align: "center" });

      // Table header
      let yPosition = 70;
      this.doc.setFontSize(10);
      this.doc.setTextColor(255, 255, 255);
      this.doc.setFillColor(50, 50, 50);
      this.doc.rect(15, yPosition - 5, 267, 8, "F");

      this.doc.text("Bill Number", 18, yPosition);
      this.doc.text("Customer", 70, yPosition);
      this.doc.text("Phone", 130, yPosition);
      this.doc.text("Type", 170, yPosition);
      this.doc.text("Amount", 200, yPosition);
      this.doc.text("Date", 230, yPosition);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      yPosition += 10;

      pendingBillsData.forEach((bill, index) => {
        if (yPosition > 180) {
          this.doc.addPage();
          yPosition = 30;
        }

        if (index % 2 === 0) {
          this.doc.setFillColor(245, 245, 245);
          this.doc.rect(15, yPosition - 5, 267, 8, "F");
        }

        this.doc.setFont("helvetica", "normal");
        this.doc.text(bill.bill_number, 18, yPosition);
        this.doc.text(bill.customer_name || "Walk-in", 70, yPosition);
        this.doc.text(bill.customer_phone || "-", 130, yPosition);
        this.doc.text(bill.sale_type || "parcel", 170, yPosition);
        this.doc.text(`${bill.total_amount.toFixed(2)}`, 200, yPosition, { align: "center" });
        this.doc.text(new Date(bill.created_at).toLocaleDateString(), 230, yPosition);

        yPosition += 8;
      });

      // Footer
      yPosition = Math.max(yPosition + 20, 260);
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "italic");
      this.doc.text("This is a system generated report", 148, yPosition, {
        align: "center",
      });

      const pdfBuffer = this.doc.output("arraybuffer");
      fs.writeFileSync(filePath, Buffer.from(pdfBuffer));

      return { success: true, filePath };
    } catch (error) {
      console.error("Pending bills report generation error:", error);
      throw error;
    }
  }
}

module.exports = PDFService;
