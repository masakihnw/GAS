@echo off

echo ================================
echo    clasp v3 Setup Installer
echo ================================
echo.

echo [1/3] Checking Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo X Node.js not found
    echo Installing Node.js LTS...
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    if %errorLevel% neq 0 (
        echo X Automatic installation failed
        echo Please install Node.js manually from https://nodejs.org
        start https://nodejs.org
        pause
        exit /b 1
    )
    echo Please restart this script after installation completes.
    pause
    exit /b 0
)

echo O Node.js found
node --version
echo.

echo [2/3] Installing clasp v3...
echo Running: npm install -g @google/clasp@latest
call npm install -g @google/clasp@latest
echo npm install completed with exit code: %errorLevel%
if %errorLevel% neq 0 (
    echo X clasp installation failed
    echo Try manually: npm install -g @google/clasp@latest
    pause
    exit /b 1
)
echo O clasp installation completed
echo.

echo [3/3] Testing clasp...
echo Running: clasp --version
call clasp --version
echo clasp test completed with exit code: %errorLevel%
if %errorLevel% neq 0 (
    echo X clasp test failed
    echo Please open NEW command prompt and test: clasp --version
    pause
    exit /b 1
)
echo O clasp test successful

echo.
echo ================================
echo     Installation Complete!
echo ================================
echo.
echo Ready to use:
echo 1. clasp login --creds [your-file] --use-project-scopes
echo 2. clasp status
echo 3. clasp push
echo 4. clasp run [function-name]
echo.

pause 