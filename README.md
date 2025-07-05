# Inventory POS System

This is a standalone desktop application for managing inventory (godown and counter stocks separately) and providing POS-style billing. It can print bills on an Epson TM-T82II thermal printer (via ESC/POS) or export them to PDF.

## Features
- Manage separate inventory for godown and counter stock.
- POS-style billing system with product search.
- Print bills to an Epson TM-T82II thermal printer using ESC/POS commands.
- Export bills to PDF format.
- View sales reports and inventory management.

## Prerequisites
- Node.js (>=14.0.0)
- Yarn or npm

## Setup Instructions

### Clone the repository
```bash
git clone <repository-url>
cd inventory-pos-app
```

### Install dependencies
```bash
npm install
```

### Running the application

#### Development
Start the Electron app in development mode with React.
```bash
npm run dev
```

#### Production
Generate the production build and run the Electron app.
```bash
npm run build-electron
```

### Building the Installer
Create an installer for Windows.
```bash
npm run dist
```

## Notes
- Ensure that the Epson TM-T82II printer drivers are installed on the Windows system.
- For network printing, ensure the printer's IP address is correctly configured.

## License
This project is licensed under the MIT License.
