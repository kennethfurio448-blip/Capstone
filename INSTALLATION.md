# Installing MedTrack

MedTrack remains available at `https://www.medtrackmanagement.com` and can be installed safely as a browser-managed PWA.

## Public Windows installation

The unsigned `.exe` is no longer offered through the MedTrack website. This prevents users from being encouraged to run an application that Windows cannot verify. A Windows installer may be restored later after it is digitally signed with a trusted Authenticode certificate.

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
