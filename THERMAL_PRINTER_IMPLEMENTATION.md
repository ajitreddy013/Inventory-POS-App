# Thermal Printer Implementation

## Overview
This document describes the thermal printer implementation for the Inventory POS application, which provides full compatibility with ESC/POS thermal printers.

## Features Implemented

### 1. Thermal Printer Support
- **ESC/POS Protocol**: Full support for ESC/POS thermal printers
- **Multiple Connection Types**: USB, Network, and Serial connections
- **Popular Printer Models**: Compatible with Epson TM-T82II, TM-T88V, TM-T20, and other ESC/POS printers

### 2. Dynamic Bill Height
- **Auto-sizing**: Bill height automatically adjusts based on the number of items
- **Optimized PDF Generation**: PDF receipts are generated with dynamic height
- **Thermal Print Formatting**: Proper formatting for thermal paper (80mm width)

### 3. Printer Configuration
- **Type Selection**: Switch between USB, Network, and Serial printers
- **Network Configuration**: Set IP address and port for network printers
- **Serial Configuration**: Configure serial port and baud rate
- **Configuration Persistence**: Settings are saved in `printer-config.json`

### 4. Bill Printing Features
- **Professional Layout**: Clean, readable receipt format
- **Shop Information**: Dynamic shop name, address, phone, GST number
- **Customer Details**: Name and phone number (if provided)
- **Item Details**: Name, quantity, rate, and amount
- **Totals**: Subtotal, tax, discount, and final total
- **Payment Method**: Cash, card, or other payment types
- **Thank You Message**: Customizable message

## Files Modified/Created

### Core Services
- `src/printer-service.js` - Main printer service with thermal printer support
- `src/pdf-service.js` - Updated with dynamic height calculation
- `printer-config.json` - Configuration file for printer settings

### UI Components
- `src/components/Settings.js` - Added printer configuration interface
- `src/main.js` - Added printer configuration IPC handlers
- `src/preload.js` - Added printer configuration APIs

### Test Files
- `test-thermal-printer.js` - Test file for thermal printer functionality

## Dependencies Added
- `escpos` - Core ESC/POS library
- `escpos-usb` - USB printer support
- `escpos-network` - Network printer support
- `escpos-serialport` - Serial printer support

## Configuration

### Printer Types
1. **USB Printers**: Auto-detected USB thermal printers
2. **Network Printers**: IP-based printers (default: 192.168.1.100:9100)
3. **Serial Printers**: Serial port printers (default: /dev/ttyUSB0 at 9600 baud)

### Paper Settings
- **Width**: 80mm (standard thermal paper)
- **Characters per line**: 32
- **Cut after print**: Yes
- **Beep after print**: Optional

## Usage

### Basic Printing
```javascript
const printerService = new PrinterService();
await printerService.initialize();
await printerService.printBill(billData);
```

### Configuration
```javascript
// Set printer type
printerService.setPrinterType('network');

// Configure network printer
printerService.setNetworkConfig('192.168.1.100', 9100);

// Configure serial printer
printerService.setSerialConfig('/dev/ttyUSB0', 9600);
```

### Status Check
```javascript
const status = await printerService.getStatus();
console.log('Connected:', status.connected);
console.log('Device:', status.device);
console.log('Type:', status.type);
```

## Fallback Behavior
- If no thermal printer is connected, the system falls back to console logging
- PDF generation continues to work independently
- All functions return appropriate success/failure indicators

## Testing
Run the test file to verify thermal printer functionality:
```bash
node test-thermal-printer.js
```

## Troubleshooting

### Common Issues
1. **Printer not detected**: Check USB connection and drivers
2. **Network printer not connecting**: Verify IP address and port
3. **Serial printer issues**: Check port path and permissions

### Status Indicators
- **Connected**: Printer is ready for use
- **Not Connected**: Check physical connection
- **Connection Error**: Driver or permission issue

## Future Enhancements
- Bluetooth printer support
- Logo printing capability
- Barcode/QR code printing
- Multiple printer support
- Print queue management

## KOT Removal
Note: Kitchen Order Ticket (KOT) functionality has been removed as it's not required for this inventory POS system. The focus is on bill printing for customer receipts.
