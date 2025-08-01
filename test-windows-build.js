const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Windows Build Configuration for CounterFlow POS...\n');

// Check package.json configuration
console.log('1. Checking package.json configuration...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log(`   ✅ App Name: ${packageJson.name}`);
console.log(`   ✅ Product Name: ${packageJson.build.productName}`);
console.log(`   ✅ App ID: ${packageJson.build.appId}`);
console.log(`   ✅ Description: ${packageJson.description}`);

// Check Windows build configuration
console.log('\n2. Checking Windows build configuration...');
const winConfig = packageJson.build.win;
console.log(`   ✅ Windows Icon: ${winConfig.icon}`);
console.log(`   ✅ Target Platforms: ${winConfig.target.map(t => t.target).join(', ')}`);
console.log(`   ✅ Architecture: ${winConfig.target[0].arch.join(', ')}`);

// Check if logo file exists
console.log('\n3. Checking logo file...');
const logoPath = winConfig.icon;
if (fs.existsSync(logoPath)) {
    const stats = fs.statSync(logoPath);
    console.log(`   ✅ Logo exists: ${logoPath}`);
    console.log(`   ✅ File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
    console.log(`   ❌ Logo not found: ${logoPath}`);
}

// Check test files
console.log('\n4. Checking test files...');
const testFiles = ['test-app.js', 'test-daily-report.js', 'test-thermal-printer.js'];
testFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file} exists`);
    } else {
        console.log(`   ❌ ${file} missing`);
    }
});

// Check build scripts
console.log('\n5. Checking build scripts...');
console.log(`   ✅ dist-win: ${packageJson.scripts['dist-win']}`);
console.log(`   ✅ dist-win-portable: ${packageJson.scripts['dist-win-portable']}`);

// Check dependencies for Windows compatibility
console.log('\n6. Checking Windows-compatible dependencies...');
const requiredDeps = ['better-sqlite3', 'electron-builder', 'electron-packager'];
requiredDeps.forEach(dep => {
    if (packageJson.devDependencies[dep] || packageJson.dependencies[dep]) {
        const version = packageJson.devDependencies[dep] || packageJson.dependencies[dep];
        console.log(`   ✅ ${dep}: ${version}`);
    } else {
        console.log(`   ❌ ${dep} missing`);
    }
});

// Check asar unpack configuration for native modules
console.log('\n7. Checking native module configuration...');
const asarUnpack = packageJson.build.asarUnpack;
console.log('   ✅ Native modules configured for unpacking:');
asarUnpack.forEach(pattern => {
    console.log(`      - ${pattern}`);
});

console.log('\n🎉 Windows Build Configuration Check Complete!');
console.log('\n📝 To build for Windows:');
console.log('   npm run build        # Build React app');
console.log('   npm run dist-win      # Create Windows installer');
console.log('   npm run dist-win-portable # Create portable Windows app');

console.log('\n💡 Expected output files will be:');
console.log('   dist/CounterFlow POS-1.0.0-x64.exe (installer)');
console.log('   dist/CounterFlow POS-1.0.0-portable.exe (portable)');
