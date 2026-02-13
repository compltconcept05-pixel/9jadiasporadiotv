@echo off
echo ========================================
echo Java 17 Direct Download and Install
echo ========================================
echo.

REM Check if Java is already installed
java -version >nul 2>&1
if %errorlevel% == 0 (
    echo Java is already installed!
    goto :build
)

echo Downloading Java 17 (OpenJDK Temurin)...
echo This may take a few minutes...
echo.

REM Download Java 17 MSI installer
powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_windows_hotspot_17.0.13_11.msi' -OutFile '%TEMP%\jdk17.msi'}"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Download failed!
    echo Please download Java manually from: https://adoptium.net/temurin/releases/
    pause
    exit /b 1
)

echo.
echo Installing Java 17...
echo Please follow the installation wizard.
echo.

REM Install Java silently
msiexec /i "%TEMP%\jdk17.msi" /qn ADDLOCAL=FeatureMain,FeatureEnvironment,FeatureJarFileRunWith,FeatureJavaHome INSTALLDIR="C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot\"

if %errorlevel% neq 0 (
    echo.
    echo Trying interactive installation...
    start /wait msiexec /i "%TEMP%\jdk17.msi"
)

echo.
echo Java installation complete!
echo Refreshing environment...
echo.
echo IMPORTANT: You may need to close and reopen this terminal for Java to be recognized.
echo.

:build
echo.
echo ========================================
echo Building Android APK...
echo ========================================
echo.

cd android
call gradlew.bat assembleDebug

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build failed!
    echo If Java was just installed, please:
    echo 1. Close this window
    echo 2. Open a NEW terminal window
    echo 3. Run this script again
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! APK built successfully!
echo ========================================
echo.
echo APK Location: android\app\build\outputs\apk\debug\app-debug.apk
echo.
pause
