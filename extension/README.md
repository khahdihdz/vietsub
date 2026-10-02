# AI Vietsub & Dubbing
Manifest V3 extension for Chrome/Brave.

## Features
- Import SRT/VTT.
- Context-aware batch translation through OpenRouter.
- Shadow DOM subtitle overlay synchronized to HTML5 video time.
- Vietnamese browser TTS dubbing.
- Local API/model/prompt settings.
- Automatic GitHub Actions packaging.

## Install
Open chrome://extensions or brave://extensions, enable Developer mode, Load unpacked, choose extension/.

## Update
Each commit touching extension/ triggers GitHub Actions and publishes the latest ZIP. Load-unpacked installations still require Reload; silent browser updates require Web Store/enterprise distribution.

## Security
Never commit an API key. It is stored locally in the extension.