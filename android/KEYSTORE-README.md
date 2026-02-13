# CRITICAL - Keep This File Secure!

## Keystore Information
- **File**: `ndr-release-key.keystore`
- **Location**: `android/app/ndr-release-key.keystore`
- **Alias**: `ndr-key-alias`
- **Store Password**: `NDR2026SecureKey!`
- **Key Password**: `NDR2026SecureKey!`
- **Validity**: 10,000 days (~27 years)

## IMPORTANT SECURITY NOTES

⚠️ **NEVER COMMIT THIS FILE TO GIT**
⚠️ **BACKUP THIS FILE SECURELY** - If you lose it, you cannot update your app on Play Store
⚠️ **KEEP PASSWORDS SECURE** - Store them in a password manager

## Backup Instructions
1. Copy `ndr-release-key.keystore` to a secure location (USB drive, encrypted cloud storage)
2. Save the passwords in a password manager
3. Add `*.keystore` to `.gitignore` to prevent accidental commits

## If You Lose This Keystore
- You CANNOT update your existing app on Google Play
- You will have to publish a completely new app with a new package name
- All existing users will need to uninstall and reinstall

## For Production Use
Consider using Google Play App Signing (recommended):
- Upload your keystore to Google Play Console
- Google manages the signing key
- You keep an "upload key" for uploading new versions
