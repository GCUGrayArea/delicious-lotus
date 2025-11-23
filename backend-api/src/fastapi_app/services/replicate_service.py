import os
import uuid
import asyncio
import logging
import json
from datetime import datetime, UTC
from typing import List, Dict, Any, Optional

# Try to import replicate, handle if missing
try:
    import replicate
except ImportError:
    replicate = None

from workers.redis_pool import get_redis_connection

logger = logging.getLogger(__name__)

class ReplicateService:
    def __init__(self):
        self.api_token = os.getenv("REPLICATE_API_TOKEN")
        if not self.api_token:
            logger.warning("REPLICATE_API_TOKEN not set")
        
        # Set env var for the library
        if self.api_token:
            os.environ["REPLICATE_API_TOKEN"] = self.api_token

    async def generate_video_clips(
        self,
        scenes: List[Dict[str, Any]],
        micro_prompts: List[str],
        generation_id: str,
        aspect_ratio: str = "16:9",
        parallelize: bool = False,
        webhook_base_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate video clips using Replicate.
        Ported from legacy app/api/v1/replicate.py
        """
        if not self.api_token or not replicate:
            logger.error("Replicate not configured or installed")
            return []

        results = []
        
        # Determine webhook URL
        webhook_url = None
        if webhook_base_url:
            # Point to the NEW API's webhook handler
            webhook_url = f"{webhook_base_url}/api/v1/webhooks/replicate"

        async def _process_single_clip(prompt: str, index: int) -> Dict[str, Any]:
            clip_id = f"clip_{index+1}_{uuid.uuid4().hex[:8]}"
            scene_id = scenes[index].get("id") if index < len(scenes) else None
            
            try:
                logger.info(f"Starting generation for clip {clip_id}", extra={"prompt": prompt[:50]})
                
                # Wan Video 2.5 T2V parameters
                size = "1280*720" if aspect_ratio == "16:9" else "720*1280"
                
                # Prepare arguments
                prediction_args = {
                    "model": "wan-video/wan-2.5-t2v",
                    "input": {
                        "prompt": prompt,
                        "aspect_ratio": aspect_ratio,
                        "size": size,
                        "duration": 5,
                        "negative_prompt": "",
                        "enable_prompt_expansion": True
                    }
                }

                # Only add webhook args if webhook_url is present
                if webhook_url:
                    prediction_args["webhook"] = webhook_url
                    prediction_args["webhook_events_filter"] = ["completed"]
                
                # Run blocking call in thread
                prediction = await asyncio.to_thread(
                    replicate.predictions.create,
                    **prediction_args
                )

                # Store mapping for webhooks
                self._store_prediction_mapping(prediction.id, generation_id, clip_id, scene_id)
                
                return {
                    "clip_id": clip_id,
                    "prediction_id": prediction.id,
                    "status": "queued",
                    "status_url": f"https://replicate.com/p/{prediction.id}",
                    "scene_id": scene_id
                }
                
            except Exception as e:
                logger.exception(f"Failed to generate clip {clip_id}: {e}")
                return {
                    "clip_id": clip_id,
                    "status": "failed",
                    "error": str(e),
                    "scene_id": scene_id
                }

        # Execute
        if parallelize:
            tasks = [_process_single_clip(p, i) for i, p in enumerate(micro_prompts)]
            results = await asyncio.gather(*tasks)
        else:
            for i, prompt in enumerate(micro_prompts):
                results.append(await _process_single_clip(prompt, i))
                
        return results

    def _store_prediction_mapping(self, prediction_id: str, generation_id: str, clip_id: str, scene_id: Optional[str]):
        """Store mapping in Redis so webhook knows which clip this is"""
        try:
            redis_conn = get_redis_connection()
            mapping = {
                "generation_id": generation_id,
                "clip_id": clip_id,
                "scene_id": scene_id or ""
            }
            # 24 hour TTL
            redis_conn.setex(f"prediction_mapping:{prediction_id}", 86400, json.dumps(mapping))
        except Exception as e:
            logger.error(f"Failed to store prediction mapping: {e}")

# Global instance
replicate_service = ReplicateService()

