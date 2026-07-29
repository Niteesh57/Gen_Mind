"""Brief-driven media pipeline using official genblaze PyPI SDK (SyncProvider & Pipeline) reading configuration dynamically from .env without external openai dependency."""
from __future__ import annotations

import asyncio
import io
import json
import os
import re
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import edge_tts
from dotenv import load_dotenv
from PIL import Image, ImageDraw
from moviepy import AudioFileClip, ImageClip, concatenate_audioclips, concatenate_videoclips

from genblaze import Asset, Modality, Pipeline, Step
from genblaze_core.providers.base import ProviderCapabilities, SyncProvider
from genblaze_core.runnable.config import RunnableConfig
from app.core.media_interfaces import IStorageBackend

# Load .env configuration
base_dir = Path(__file__).resolve().parent.parent.parent
env_path = base_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

AZURE_VOICES = [
    {"id": "en-US-JennyNeural", "label": "Jenny — US English (Female)", "language": "en-US"},
    {"id": "en-US-GuyNeural", "label": "Guy — US English (Male)", "language": "en-US"},
    {"id": "en-US-AriaNeural", "label": "Aria — US English (Female)", "language": "en-US"},
    {"id": "en-US-ChristopherNeural", "label": "Christopher — US English (Male)", "language": "en-US"},
    {"id": "en-IN-NeerjaNeural", "label": "Neerja — Indian English (Female)", "language": "en-IN"},
    {"id": "en-IN-PrabhatNeural", "label": "Prabhat — Indian English (Male)", "language": "en-IN"},
    {"id": "hi-IN-SwaraNeural", "label": "Swara — Hindi (Female)", "language": "hi-IN"},
    {"id": "hi-IN-MadhurNeural", "label": "Madhur — Hindi (Male)", "language": "hi-IN"},
    {"id": "es-ES-ElviraNeural", "label": "Elvira — Spanish (Female)", "language": "es-ES"},
    {"id": "es-ES-AlvaroNeural", "label": "Alvaro — Spanish (Male)", "language": "es-ES"},
]

class ProviderUnavailable(RuntimeError): pass

class DashScopeGenblazeProvider(SyncProvider):
    """Native GenBlaze SyncProvider adapter reading API key, model, and widescreen parameters from .env without openai dependency."""
    name = "dashscope_provider"
    capabilities = ProviderCapabilities(supported_modalities=[Modality.TEXT, Modality.IMAGE])

    def generate(self, step: Step, config: RunnableConfig | None = None) -> Step:
        api_key = os.getenv("DASHSCOPE_API_KEY", "")
        base_url = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
        image_url = os.getenv("DASHSCOPE_IMAGE_URL", "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation")
        text_model = os.getenv("DASHSCOPE_TEXT_MODEL", "qwen3.5-flash")
        image_model = os.getenv("DASHSCOPE_IMAGE_MODEL", "z-image-turbo")
        image_size = os.getenv("DASHSCOPE_IMAGE_SIZE", "1280*720")

        if step.modality == Modality.TEXT:
            model_name = step.model if step.model and step.model != "default" else text_model
            chat_url = f"{base_url.rstrip('/')}/chat/completions"
            payload = {
                "model": model_name,
                "messages": [{"role": "user", "content": step.prompt}]
            }
            req = urllib.request.Request(
                chat_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"]
                step.metadata["output_text"] = text
                step.assets.append(Asset(url="", media_type="text/plain"))
            except Exception as exc:
                step.metadata["output_text"] = ""
                step.metadata["error"] = str(exc)
        elif step.modality == Modality.IMAGE:
            payload = {
                "model": image_model,
                "input": {"messages": [{"role": "user", "content": [{"text": step.prompt[:1200]}]}]},
                "parameters": {"prompt_extend": False, "size": image_size} # 16:9 PC Widescreen from .env
            }
            req = urllib.request.Request(
                image_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                img_url = data["output"]["choices"][0]["message"]["content"][0]["image"]
                img_req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(img_req, timeout=30) as img_resp:
                    img_bytes = img_resp.read()
                # Store base64 encoded string in metadata so genblaze_core canonical hash won't crash on bytes
                import base64
                step.metadata["img_b64"] = base64.b64encode(img_bytes).decode("utf-8")
                step.metadata["img_url"] = img_url
                step.assets.append(Asset(url=img_url, media_type="image/png"))
            except Exception as exc:
                step.metadata["img_b64"] = None
                step.metadata["error"] = str(exc)
        return step

class EdgeTtsSpeechAgent:
    """Free Microsoft Edge neural voice synthesis."""
    def synthesize(self, text: str, voice: str) -> bytes:
        if not text.strip():
            text = "Welcome to NotebookLM Gen Media."
        async def make_audio() -> bytes:
            audio = bytearray()
            communicate = edge_tts.Communicate(" ".join(text.split()), voice=voice, rate="+0%")
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio.extend(chunk["data"])
            return bytes(audio)
        try:
            return asyncio.run(make_audio())
        except Exception as exc:
            raise ProviderUnavailable(f"Microsoft Edge TTS failed: {exc}") from exc

@dataclass
class StudioBrief:
    project_id: str
    topic: str
    image_count: int  # Range 5 to 15
    image_style: str  # Pre-existing style or custom style input
    language: str
    output_mode: str  # "video" or "conversation"
    voice: str
    podcast_tone: str = "friendly"  # "friendly", "serious", "deep_dive"
    participant_count: int = 2  # 1 to 4 speakers
    participant_voices: Optional[List[str]] = None
    source_urls: Optional[List[str]] = None
    source_assets: Optional[List[str]] = None
    source_context: Optional[List[str]] = None

class LearningStudioPipeline:
    def __init__(self, storage: IStorageBackend):
        self.storage = storage
        self.speech = EdgeTtsSpeechAgent()
        self.dashscope_provider = DashScopeGenblazeProvider()

    @staticmethod
    def _render_styled_frame(title: str, text: str, index: int, total: int, style: str, topic: str) -> bytes:
        width, height = 1280, 720
        style_lower = style.lower()

        if "minimalist" in style_lower or "light" in style_lower or "white" in style_lower:
            bg_color = (248, 250, 252)
            text_dark = (15, 23, 42)
            accent_color = (2, 132, 199)
            sub_text = (100, 116, 139)
        elif "cinematic" in style_lower or "dark" in style_lower:
            bg_color = (15, 23, 42)
            text_dark = (248, 250, 252)
            accent_color = (56, 189, 248)
            sub_text = (148, 163, 184)
        else:
            bg_color = (255, 255, 255)
            text_dark = (30, 41, 59)
            accent_color = (79, 70, 229)
            sub_text = (100, 116, 139)

        img = Image.new("RGB", (width, height), color=bg_color)
        draw = ImageDraw.Draw(img)

        draw.rectangle([50, 50, 62, 670], fill=accent_color)
        draw.rectangle([50, 50, 1230, 54], fill=accent_color)

        draw.text((90, 80), f"NOTEBOOK GEN MEDIA · SCENE {index} OF {total} ({style.title()})", fill=sub_text)
        draw.text((90, 120), f"Topic: {topic[:60]}", fill=accent_color)
        draw.text((90, 190), title[:65], fill=text_dark)

        words = text.split()
        lines = []
        curr = ""
        for w in words:
            if len(curr) + len(w) + 1 > 52:
                lines.append(curr)
                curr = w
            else:
                curr = (curr + " " + w).strip()
        if curr:
            lines.append(curr)

        y_pos = 280
        for line in lines[:9]:
            draw.text((90, y_pos), line, fill=text_dark)
            y_pos += 36

        draw.text((90, 630), "Synthesized via official genblaze PyPI SDK (16:9 PC Widescreen)", fill=sub_text)

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()

    def _build_script(self, brief: StudioBrief) -> List[Dict[str, Any]]:
        sources_text = "\n".join(brief.source_context or [])
        clean_context = sources_text[:6000] if sources_text else brief.topic
        text_model = os.getenv("DASHSCOPE_TEXT_MODEL", "qwen3.5-flash")

        if brief.output_mode == "conversation":
            speaker_voices = brief.participant_voices or [
                "en-US-JennyNeural", "en-US-GuyNeural", "en-US-AriaNeural", "en-US-ChristopherNeural"
            ][:brief.participant_count]

            try:
                p = Pipeline("script_generation")
                prompt = (
                    f"Create a natural {brief.podcast_tone} audio podcast script about '{brief.topic}' "
                    f"with {brief.participant_count} speaker(s).\n"
                    f"Background context:\n{clean_context}\n\n"
                    "Return JSON ONLY: an array of objects. Each object MUST have:\n"
                    '{"index": int, "speaker_index": int (0 to N-1), "speaker_name": string, "narration": string}\n'
                    "Generate 8 to 14 engaging, continuous dialogue turns."
                )
                p.step(self.dashscope_provider, model=text_model, prompt=prompt, modality=Modality.TEXT)
                res = p.run(raise_on_failure=False)
                raw = res.run.steps[0].metadata.get("output_text", "")
                clean_json = re.sub(r"^```json\s*", "", raw, flags=re.I).strip()
                clean_json = re.sub(r"```$", "", clean_json).strip()
                parsed = json.loads(clean_json)

                if isinstance(parsed, list) and len(parsed) > 0:
                    turns = []
                    for item in parsed:
                        spk_idx = int(item.get("speaker_index", 0)) % len(speaker_voices)
                        voice = speaker_voices[spk_idx]
                        turns.append({
                            "index": len(turns) + 1,
                            "speaker_index": spk_idx,
                            "speaker_name": str(item.get("speaker_name", f"Speaker {spk_idx + 1}")),
                            "voice": voice,
                            "narration": str(item.get("narration", ""))
                        })
                    return turns
            except Exception:
                pass

            turns_count = {"friendly": 8, "serious": 12, "deep_dive": 16}.get(brief.podcast_tone, 10)
            turns = []
            for i in range(turns_count):
                spk_idx = i % len(speaker_voices)
                spk_name = f"Host {spk_idx + 1}" if spk_idx == 0 else f"Expert {spk_idx + 1}"
                text = f"Exploring key aspect {i + 1} of {brief.topic}. Building upon our core research findings."
                turns.append({
                    "index": i + 1,
                    "speaker_index": spk_idx,
                    "speaker_name": spk_name,
                    "voice": speaker_voices[spk_idx],
                    "narration": text
                })
            return turns

        else:
            # VIDEO EXPLANATION MODE (5 to 15 Images)
            count = max(5, min(15, brief.image_count))
            try:
                p = Pipeline("video_script_gen")
                prompt = (
                    f"Create an educational script for a {count}-scene video explanation about '{brief.topic}'.\n"
                    f"Background context:\n{clean_context}\n\n"
                    f"Return JSON ONLY: an array of exactly {count} scene objects in sequence. "
                    "Each scene object MUST have:\n"
                    '{"index": int (1 to N), "title": string, "narration": string}\n'
                    "Keep narration informative, engaging, and clear."
                )
                p.step(self.dashscope_provider, model=text_model, prompt=prompt, modality=Modality.TEXT)
                res = p.run(raise_on_failure=False)
                raw = res.run.steps[0].metadata.get("output_text", "")
                clean_json = re.sub(r"^```json\s*", "", raw, flags=re.I).strip()
                clean_json = re.sub(r"```$", "", clean_json).strip()
                parsed = json.loads(clean_json)

                if isinstance(parsed, list) and len(parsed) >= count:
                    scenes = []
                    for idx, item in enumerate(parsed[:count]):
                        scenes.append({
                            "index": idx + 1,
                            "title": str(item.get("title", f"Scene {idx + 1}")),
                            "narration": str(item.get("narration", ""))
                        })
                    return scenes
            except Exception:
                pass

            scenes = []
            for i in range(count):
                idx = i + 1
                scenes.append({
                    "index": idx,
                    "title": f"Section {idx}: {brief.topic[:30]}",
                    "narration": f"Examining component {idx} of {brief.topic} based on extracted source research."
                })
            return scenes

    def run(self, brief: StudioBrief) -> Dict[str, Any]:
        stages = ["Sources ingested", "GenBlaze Pipeline initialized from .env"]
        items = self._build_script(brief)
        image_model = os.getenv("DASHSCOPE_IMAGE_MODEL", "z-image-turbo")

        if brief.output_mode == "conversation":
            voice_tracks = []
            temp_audio_files = []

            for turn in items:
                v = turn["voice"]
                txt = turn["narration"]
                aud_bytes = self.speech.synthesize(txt, v)

                public_dir = Path(__file__).resolve().parent.parent.parent / "static" / "public"
                public_dir.mkdir(parents=True, exist_ok=True)
                t_name = f"temp_aud_{uuid.uuid4().hex[:6]}.mp3"
                t_path = public_dir / t_name
                with open(t_path, "wb") as f:
                    f.write(aud_bytes)
                temp_audio_files.append(str(t_path))

                track_url = self.storage.upload_asset(aud_bytes, f"turn_{turn['index']}.mp3", "audio/mpeg")
                voice_tracks.append({
                    "index": turn["index"],
                    "speaker": turn["speaker_name"],
                    "voice": v,
                    "narration": txt,
                    "url": track_url
                })

            try:
                audio_clips = [AudioFileClip(p) for p in temp_audio_files]
                combined = concatenate_audioclips(audio_clips)
                public_dir = Path(__file__).resolve().parent.parent.parent / "static" / "public"
                public_dir.mkdir(parents=True, exist_ok=True)
                master_filename = f"podcast_{uuid.uuid4().hex[:8]}.mp3"
                master_path = public_dir / master_filename
                combined.write_audiofile(str(master_path), logger=None)

                for clip in audio_clips:
                    clip.close()

                master_url = f"/static/public/{master_filename}"
                stages.append(f"Compiled podcast with {len(items)} dialogue turns")
            except Exception as exc:
                master_url = voice_tracks[0]["url"] if voice_tracks else None
                stages.append(f"Podcast assembly note: {exc}")
            finally:
                for p in temp_audio_files:
                    if os.path.exists(p):
                        try: os.remove(p)
                        except OSError: pass

            full_script = "\n\n".join(f"{t['speaker_name']}: {t['narration']}" for t in items)
            return {
                "brief": brief.__dict__,
                "mode": "conversation",
                "turns": items,
                "voice_tracks": voice_tracks,
                "output_url": master_url,
                "narration": full_script,
                "stages": stages
            }

        else:
            # VIDEO EXPLANATION PIPELINE (GenBlaze 16:9 PC Widescreen z-image-turbo AI Images)
            images_meta = []
            video_clips = []
            temp_files = []

            for scene in items:
                idx = scene["index"]
                narration = scene["narration"]
                title = scene["title"]

                prompt_text = f"{title}: {narration}. Visual style: {brief.image_style}. Widescreen 16:9 PC composition, highly detailed."
                img_bytes = None
                image_source = f"GenBlaze Pipeline ({image_model} 16:9 Widescreen)"

                try:
                    import base64
                    img_p = Pipeline("image_gen_step")
                    img_p.step(self.dashscope_provider, model=image_model, prompt=prompt_text, modality=Modality.IMAGE)
                    img_res = img_p.run(raise_on_failure=False)
                    img_b64 = img_res.run.steps[0].metadata.get("img_b64")
                    if img_b64:
                        img_bytes = base64.b64decode(img_b64)
                except Exception:
                    img_bytes = None

                if not img_bytes:
                    img_bytes = self._render_styled_frame(title, narration, idx, len(items), brief.image_style, brief.topic)
                    image_source = "Pillow Graphic Frame"

                img_url = self.storage.upload_asset(img_bytes, f"frame_{idx}.png", "image/png")
                images_meta.append({"index": idx, "title": title, "url": img_url, "source": image_source})

                public_dir = Path(__file__).resolve().parent.parent.parent / "static" / "public"
                public_dir.mkdir(parents=True, exist_ok=True)
                t_img_path = public_dir / f"temp_img_{uuid.uuid4().hex[:6]}.png"
                with open(t_img_path, "wb") as f:
                    f.write(img_bytes)
                temp_files.append(str(t_img_path))

                audio_bytes = self.speech.synthesize(narration, brief.voice)
                t_aud_path = public_dir / f"temp_aud_{uuid.uuid4().hex[:6]}.mp3"
                with open(t_aud_path, "wb") as f:
                    f.write(audio_bytes)
                temp_files.append(str(t_aud_path))

                audio_clip = AudioFileClip(str(t_aud_path))
                img_clip = ImageClip(str(t_img_path)).with_duration(audio_clip.duration).with_audio(audio_clip)
                video_clips.append((img_clip, audio_clip))

            mp4_filename = f"video_{uuid.uuid4().hex[:8]}.mp4"
            mp4_path = public_dir / mp4_filename

            try:
                final_video = concatenate_videoclips([vc[0] for vc in video_clips])
                final_video.write_videofile(str(mp4_path), fps=2, logger=None)
                output_video_url = f"/static/public/{mp4_filename}"
                stages.append(f"Successfully compiled {len(items)} GenBlaze 16:9 PC widescreen AI scene frames into MP4 video")
            except Exception as exc:
                output_video_url = images_meta[0]["url"] if images_meta else None
                stages.append(f"Video assembly note: {exc}")
            finally:
                for img_clip, aud_clip in video_clips:
                    try:
                        img_clip.close()
                        aud_clip.close()
                    except Exception: pass
                for t_path in temp_files:
                    if os.path.exists(t_path):
                        try: os.remove(t_path)
                        except OSError: pass

            full_script = " ".join(s["narration"] for s in items)
            return {
                "brief": brief.__dict__,
                "mode": "video",
                "scenes": items,
                "images": images_meta,
                "output_url": output_video_url,
                "narration": full_script,
                "stages": stages
            }
