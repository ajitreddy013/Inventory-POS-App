const { jsPDF } = require("jspdf");
const fs = require("fs");

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

      // Create new PDF document - use smaller format for receipts
      this.doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 200], // Receipt size
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

      // Currency note
      this.doc.setFontSize(6);
      this.doc.setFont("helvetica", "italic");
      this.doc.text("All amounts in Indian Rupees (₹)", 40, 42, {
        align: "center",
      });

      // Invoice details
      this.doc.setFontSize(12);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("BILL", 40, 52, { align: "center" });

      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      const date = new Date(saleDate);
      this.doc.text(`Date: ${date.toLocaleDateString("en-IN")}`, 5, 62);
      this.doc.text(`Time: ${date.toLocaleTimeString("en-IN")}`, 5, 68);

      // Sale type and table info
      if (saleType === "table" && tableNumber) {
        this.doc.text(`Table No: ${tableNumber}`, 5, 74);
      } else {
        this.doc.text(
          `${saleType === "parcel" ? "Parcel" : "Table"} Order`,
          5,
          74
        );
      }

      // Customer details on right side
      this.doc.text(`Bill No: ${saleNumber}`, 40, 62, { align: "right" });
      this.doc.text(`Customer: ${customerName || "Walk-in"}`, 40, 68, {
        align: "right",
      });
      if (customerPhone) {
        this.doc.text(`Phone: ${customerPhone}`, 40, 74, { align: "right" });
      }

      // Separator line
      this.doc.setLineWidth(0.3);
      this.doc.line(5, 82, 75, 82);

      // Table header
      let yPosition = 92;
      this.doc.setFontSize(8);
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "bold");

      this.doc.text("Item", 8, yPosition);
      this.doc.text("Qty", 45, yPosition);
      this.doc.text("Rate (₹)", 55, yPosition);
      this.doc.text("Amount (₹)", 70, yPosition);

      // Header underline
      this.doc.setLineWidth(0.2);
      this.doc.line(5, yPosition + 2, 75, yPosition + 2);

      // Table items
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFont("helvetica", "normal");
      yPosition += 8;

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

        // Quantity
        this.doc.text(item.quantity.toString(), 45, yPosition, {
          align: "center",
        });

        // Rate (without ₹ symbol for cleaner layout)
        this.doc.text(item.unitPrice.toFixed(2), 55, yPosition, {
          align: "right",
        });

        // Amount (without ₹ symbol for cleaner layout)
        this.doc.text(item.totalPrice.toFixed(2), 70, yPosition, {
          align: "right",
        });

        yPosition += 5;
      });

      // Items separator line
      this.doc.setLineWidth(0.2);
      this.doc.line(5, yPosition + 2, 75, yPosition + 2);

      // Summary section
      yPosition += 8;
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");

      // Right align the amounts (without ₹ symbol)
      this.doc.text("Subtotal:", 45, yPosition);
      this.doc.text(subtotal.toFixed(2), 70, yPosition, {
        align: "right",
      });

      if (discountAmount > 0) {
        yPosition += 5;
        this.doc.text("Discount:", 45, yPosition);
        this.doc.text(discountAmount.toFixed(2), 70, yPosition, {
          align: "right",
        });
      }

      if (taxAmount > 0) {
        yPosition += 5;
        this.doc.text("Tax:", 45, yPosition);
        this.doc.text(taxAmount.toFixed(2), 70, yPosition, {
          align: "right",
        });
      }

      // Total amount line
      yPosition += 8;
      this.doc.setLineWidth(0.3);
      this.doc.line(40, yPosition, 75, yPosition);

      yPosition += 8;
      this.doc.setFontSize(10);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Total Amount:", 40, yPosition);
      this.doc.text(totalAmount.toFixed(2), 70, yPosition, {
        align: "right",
      });

      yPosition += 5;
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Payment: ${paymentMethod.toUpperCase()}`, 5, yPosition);

      yPosition += 8;
      this.doc.setLineWidth(0.3);
      this.doc.line(40, yPosition, 75, yPosition);

      // Footer
      yPosition = Math.max(yPosition + 10, 180);
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
      this.doc.text(
        `Generated on: ${new Date().toLocaleDateString(
          "en-IN"
        )} ${new Date().toLocaleTimeString("en-IN")}`,
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
          this.doc.text(`₹${item.price.toFixed(2)}`, 180, yPosition, {
            align: "center",
          });
          this.doc.text(`₹${value.toFixed(2)}`, 220, yPosition, {
            align: "center",
          });
          totalValue += value;
        } else if (reportType === "counter") {
          const value = item.counter_stock * item.price;
          this.doc.text(item.counter_stock.toString(), 140, yPosition, {
            align: "center",
          });
          this.doc.text(`₹${item.price.toFixed(2)}`, 180, yPosition, {
            align: "center",
          });
          this.doc.text(`₹${value.toFixed(2)}`, 220, yPosition, {
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
          this.doc.text(`₹${item.price.toFixed(2)}`, 210, yPosition, {
            align: "center",
          });
          this.doc.text(`₹${value.toFixed(2)}`, 240, yPosition, {
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
        `Total Inventory Value: ₹${totalValue.toFixed(2)}`,
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

      // Header
      this.doc.setFontSize(18);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Daily Transfer Report", 105, 20, { align: "center" });

      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`Date: ${transferData.transfer_date}`, 105, 30, {
        align: "center",
      });
      this.doc.text(
        `Generated on: ${new Date().toLocaleDateString(
          "en-IN"
        )} ${new Date().toLocaleTimeString("en-IN")}`,
        105,
        37,
        { align: "center" }
      );

      // Summary section
      let yPosition = 55;
      this.doc.setFontSize(12);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Transfer Summary", 20, yPosition);

      yPosition += 10;
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "normal");
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
          ? new Date(item.transfer_time).toLocaleTimeString("en-IN", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            })
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
}

module.exports = PDFService;
