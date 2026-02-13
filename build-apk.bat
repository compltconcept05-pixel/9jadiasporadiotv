@echo off
echo ========================================
echo Android APK Build Script
echo ========================================
echo.

REM Check if Java is installed
java -version >nul 2>&1
if %errorlevel% == 0 (
    echo Java is already installed!
    goto :build
)

echo Java is not installed. Installing OpenJDK 17...
echo.

REM Install Java using Chocolatey
choco install openjdk17 -y

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Java installation failed!
    echo Please install Java manually from: https://adoptium.net/temurin/releases/
    echo After installing Java, run this script again.
    pause
    exit /b 1
)

echo.
echo Java installed successfully!
echo Refreshing environment variables...
call refreshenv

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
echo You can now install this APK on your Android device.
echo.
pause
