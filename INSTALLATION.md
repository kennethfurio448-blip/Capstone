# Installing MedTrack

MedTrack remains available at `https://www.medtrackmanagement.com` and can also be installed as a Windows desktop application or a browser-managed PWA.

## Windows installer

1. Download `MedTrack-Setup-1.0.0.exe`.
2. Open the installer and choose the installation folder.
3. Keep the Desktop and Start Menu shortcut options enabled.
4. Launch MedTrack and connect to the internet for the first sign-in on that device.
5. Sign in with an authorized Admin or Staff account. Administrators must complete MFA before their offline enrollment is approved.

The installer is not code-signed. Windows SmartScreen may therefore identify the publisher as unknown. Verify that the file came from the authorized MedTrack project before running it.

## Windows or Android PWA

1. Open `https://www.medtrackmanagement.com/login/login.html` in Microsoft Edge or Google Chrome.
2. Select **Install MedTrack App** when the button is available, or use the browser menu and choose **Install app** / **Add to Home screen**.
3. Launch MedTrack from the desktop, Start Menu, or Android home screen.
4. Complete one successful online sign-in on that browser profile before testing offline login.

## Offline operation

- Offline login works only after the account has completed secure enrollment on that device and browser profile.
- The device stores a salted password verifier, not the plaintext password.
- Admin offline enrollment requires a previously completed MFA session.
- Cached dashboards and locally available records can be opened offline.
- Supported inventory, emergency-response, Trash Bin, and synchronization operations are queued locally and uploaded after reconnection.
- Account administration, permanent Trash deletion, cloud audit retrieval, and other server-only administrative operations still require internet access.
- Do not clear the application's browser data, IndexedDB, or site storage; doing so removes the local offline enrollment and cached records.
- Updates to the hosted MedTrack interface are downloaded when connectivity is available. Installing a newer Windows wrapper does not remove the persistent local application profile.

## Android limitation

The supported Android delivery is the installable PWA. An APK is not included because this repository does not contain an Android SDK, signing key, or managed mobile release pipeline. The PWA uses the same production origin, authentication, offline cache, and synchronization implementation as the web and Windows versions.
