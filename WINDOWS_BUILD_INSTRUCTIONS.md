# Windows Executable Build Instructions

## 🚀 **Method 1: GitHub Actions (Automated) - RECOMMENDED**

Your repository now has automated Windows builds! Here's how to get your Windows executable:

### **Getting the Windows Executable:**

1. **Go to your GitHub repository**: https://github.com/ajitreddy013/Inventory-POS-App
2. **Navigate to "Actions" tab**
3. **Click on the latest "Build Windows Executable" workflow**
4. **Download the artifacts:**
   - `windows-installer` - Contains the installer (.exe)
   - `windows-portable` - Contains the portable version (.exe)

### **Manual Trigger:**
You can also manually trigger a build:
1. Go to **Actions** → **Build Windows Executable**
2. Click **"Run workflow"** → **"Run workflow"**
3. Wait for completion and download artifacts

---

## 🔧 **Method 2: Build on Windows Machine**

If you have access to a Windows machine:

### **Prerequisites:**
- Windows 10/11
- [Node.js](https://nodejs.org/) (v14 or higher)
- [Git](https://git-scm.com/download/win)

### **Steps:**
1. **Clone the repository:**
   ```bash
   git clone https://github.com/ajitreddy013/Inventory-POS-App.git
   cd Inventory-POS-App
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the React app:**
   ```bash
   npm run build
   ```

4. **Build Windows executable:**
   ```bash
   npm run dist
   ```

### **Output Files:**
- `dist/Inventory POS Setup 1.0.0.exe` - Windows installer
- `dist/Inventory POS-1.0.0-portable.exe` - Portable version

---

## 📦 **Method 3: Use GitHub Releases**

Check the **Releases** section of your repository for pre-built Windows executables:
- Go to: https://github.com/ajitreddy013/Inventory-POS-App/releases
- Download the latest Windows executable

---

## 🎯 **Installation on Windows:**

### **Using the Installer:**
1. Download `Inventory POS Setup 1.0.0.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

### **Using the Portable Version:**
1. Download `Inventory POS-1.0.0-portable.exe`
2. Place it in any folder
3. Double-click to run (no installation required)

---

## 🔍 **Features Available on Windows:**

✅ **Full POS System**
✅ **Inventory Management**
✅ **Sales Reporting**
✅ **Thermal Printer Support**
✅ **PDF Bill Generation**
✅ **Email Reports**
✅ **Local SQLite Database**
✅ **Offline Operation**

---

## 🛠️ **Troubleshooting:**

### **If the app doesn't start:**
1. Make sure Windows Defender/antivirus isn't blocking it
2. Run as Administrator if needed
3. Check Windows Event Viewer for errors

### **Database Issues:**
The app creates a local SQLite database automatically. If you encounter database errors:
1. Delete the `database.db` file (if it exists)
2. Restart the app (it will recreate the database)

### **Printer Issues:**
- Make sure your thermal printer is connected and recognized by Windows
- Check the printer settings in the app's Settings page
- Supported: ESC/POS compatible thermal printers

---

## 📞 **Support:**

For issues or questions:
- **Email**: ajitreddy013@gmail.com
- **Phone**: +91 7517323121

---

**Note**: The GitHub Actions build is the recommended method as it ensures proper Windows compatibility and handles all native dependencies correctly.
