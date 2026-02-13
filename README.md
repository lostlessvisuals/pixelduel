# PixelDuel

PixelDuel is an open source Windows-focused Tauri app for inspecting, comparing, and exporting video files via bundled ffmpeg.

## Download
- Download the latest installer/exe from **GitHub Releases** (Assets).

## Features

- Load two videos via file picker or drag-and-drop (auto-probe on load).
- Side-by-side previews with synchronized play/pause/reset controls.
- Single comparison table: left-aligned field labels with centered values for each input.
- Export modes: Input A only, Input B only, or side-by-side.
- Export controls:
  - Container: mp4/mov/mkv
  - Codec: H.264 / H.265
  - CRF
  - Resize with aspect lock
  - Target FPS
  - Trim start/end frame
  - Copy audio or re-encode AAC
- Progress and status updates during export.
- Output folder reveal after export.
- Automatic output filename de-duplication (adds `(1)`, `(2)`, etc.).

