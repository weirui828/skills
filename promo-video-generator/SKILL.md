---
name: promo-video-generator
description: Automatically build a privacy-safe, voice-over synced promotional demo video and social media copy for the current project. Trigger when the user says "make a promotional video for me".
---

# Promotional Video and Voiceover Generator

Follow this procedure when the user says: "make a promotional video for me".

---

## 1. Discover and Clarify

1. Read `README.md`, `DEMO.md`, `package.json`, or `Makefile` in the repository root.
2. Find the command to start the demo app.
3. Identify 3 to 6 core features to show in the video.
4. Stop and ask the user if any of these items are not clear:
   - The command to start the demo environment.
   - The UI states to record.
5. Identify the voice configuration:
   - **Primary Engine**: Use `f5-tts-mlx` with the reference files in `~/.voice/`:
     - Reference Audio: `~/.voice/ref_voice.wav`
     - Reference Text: `~/.voice/ref_voice.txt`
     - Pre-computed Caches: `ref_voice_mel.safetensors`, `ref_voice_audio_norm.npy`, `ref_voice_pinyin.json`
   - **Fallback Engine**: Use macOS neural voice `say -v Ava -r 175` if `~/.voice/` files do not exist.

---

## 2. Write Script and Social Copy

1. Write a 3–6-scene voiceover script in `voiceover.json`.
2. Make each sentence short, punchy, and clear.
3. Write `social-copy.md` with:
   - A LinkedIn post (hook, bullet points, GitHub link).
   - An X (Twitter) thread (2 short posts).

---

## 3. Generate Audio First

1. Check the `audio-cache/` directory.
2. If a cached `.wav` file matches the segment text and speed, use that file.
3. If no match exists, generate the segment with `f5-tts-mlx`.
4. Measure the exact duration of each `.wav` file with `ffprobe`.
5. Calculate the scene video duration:
   $$\text{Scene Duration} = \text{Audio Duration} + 0.5\text{ seconds}$$
   This step prevents cut-off speech during transitions.

---

## 4. Record UI Safely

> [!CAUTION]
> **STRICT PRIVACY RULE**:
> - Do not record the full screen.
> - Do not record the desktop.
> - Record only the target application window or web viewport.

1. Start the demo application in the background and record the process IDs of processes you start.
2. Record the application:
   - **Web Application**: Run a headless Playwright script with a fixed viewport (for example, 1080 × 1350 or 1920 × 1080).
   - **Native macOS Application**:
     1. Query `CGWindowListCopyWindowInfo` to find the exact window ID (`kCGWindowNumber`).
     2. Record only that window:
        ```bash
        screencapture -l <window_id> -x frame.png
        ```
3. Put the recorded frames onto a dark background canvas.
4. Add scene title headers and captions.
5. Set the duration of each scene to match Step 3.

---

## 5. Merge and Complete

1. Merge the video scenes and audio tracks with `ffmpeg`:
   ```bash
   ffmpeg -i video_track.mp4 -i audio_track.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k promo-final.mp4
   ```
2. Play back `promo-final.mp4` and verify that narration matches each scene and no speech is cut off. Fix any issues before completing.
3. Stop only the demo processes you started, using the recorded process IDs.
4. Show the path to `promo-final.mp4`.
5. Display the text of `social-copy.md` to the user.
