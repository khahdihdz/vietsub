# AI Vietsub & Dubbing

Chrome/Brave Manifest V3 extension for contextual Vietnamese subtitles and browser TTS dubbing.

## Features
- Import SRT/VTT.
- Context-aware translation through OpenRouter.
- Shadow DOM subtitle overlay synchronized to HTML5 video.
- Vietnamese browser TTS dubbing.
- Local API/model/prompt settings.
- GitHub Actions packaging.

## Install
Open chrome://extensions or brave://extensions, enable Developer mode, choose **Load unpacked**, then select this repository root.

## Update
Each commit touching the extension source triggers GitHub Actions and publishes the latest ZIP. Load-unpacked installations still require Reload; silent browser updates require Web Store/enterprise distribution.

## Security
Never commit an API key. It is stored locally in the extension.