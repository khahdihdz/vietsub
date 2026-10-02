# AI Vietsub & Dubbing Extension

Chrome/Brave Manifest V3 extension for AI-assisted Vietnamese subtitles. OpenRouter is used for contextual translation.

## Install
1. Open `chrome://extensions` or `brave://extensions/`.
2. Enable Developer mode.
3. Load unpacked.
4. Select the `extension/` folder.
5. Open Options and configure an OpenRouter API key and model.

## Automated builds
GitHub Actions packages the extension on every push to `main` that changes `extension/**`, and publishes a rolling GitHub Release named `extension-latest`.

## Automatic updates
A manually installed **Load unpacked** Chrome/Brave extension cannot silently replace its own files. True automatic browser updates require Chrome Web Store/Brave distribution or enterprise/policy deployment. This repository automates every build/release so the latest package is always available.

Never commit an OpenRouter API key.