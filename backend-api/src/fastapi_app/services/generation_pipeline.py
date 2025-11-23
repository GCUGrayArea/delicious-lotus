
import logging
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from fastapi_app.core.config import settings
from fastapi_app.models.schemas import GenerationRequest, GenerationStatus, GenerationResponse
from fastapi_app.services.replicate_service import replicate_service

# Conditional imports for AI services
try:
    from ai.services.prompt_analysis_service import PromptAnalysisService
    from ai.services.brand_analysis_service import BrandAnalysisService
    from ai.services.micro_prompt_builder_service import MicroPromptBuilderService
    from ai.models.prompt_analysis import AnalysisRequest
    from ai.models.micro_prompt import MicroPromptRequest
    from ai.models.scene_decomposition import SceneDecompositionRequest, decompose_video_scenes
    from ai.models.brand_style_vector import create_default_style_vector
    
    AI_SERVICES_AVAILABLE = True
except ImportError:
    AI_SERVICES_AVAILABLE = False
    # Define dummies to prevent runtime errors in type hints if not used
    PromptAnalysisService = None
    BrandAnalysisService = None
    MicroPromptBuilderService = None

logger = logging.getLogger(__name__)

class GenerationPipelineService:
    def __init__(self):
        self.ai_services_available = AI_SERVICES_AVAILABLE

    async def analyze_and_prepare(self, generation_request: GenerationRequest, generation_id: str) -> Dict[str, Any]:
        """
        Performs prompt analysis, brand analysis, scene decomposition, and micro-prompt generation.
        Returns a dictionary containing the generated metadata (analysis, brand_config, scenes, micro_prompts).
        """
        prompt_analysis = None
        brand_config = None
        scenes = None
        micro_prompts = None

        if self.ai_services_available:
            try:
                # --- Step 1: Prompt Analysis ---
                logger.info(f"[PIPELINE] Step 1: Prompt Analysis - Start")
                
                if not settings.openai_api_key:
                    logger.warning("OpenAI API key not configured - skipping analysis")
                    raise HTTPException(
                        status_code=503, 
                        detail="AI Video Generation is currently unavailable due to missing server configuration (OpenAI API Key). Please contact the administrator."
                    )

                analysis_service = PromptAnalysisService(openai_api_key=settings.openai_api_key, use_mock=False)
                analysis_request = AnalysisRequest(prompt=generation_request.prompt)
                analysis_response = await analysis_service.analyze_prompt(analysis_request)
                prompt_analysis = analysis_response.analysis.dict()
                logger.info(f"[PIPELINE] Step 1: Prompt Analysis - Complete (confidence: {prompt_analysis.get('confidence_score', 0):.2f})")

                # --- Step 1b: Brand Analysis ---
                if generation_request.parameters.brand:
                    logger.info(f"[PIPELINE] Step 1b: Brand Analysis - Start")
                    brand_service = BrandAnalysisService(openai_api_key=settings.openai_api_key, use_mock=False)
                    brand_config = await brand_service.analyze_brand(
                        analysis_response.analysis,
                        generation_request.parameters.brand
                    )
                    logger.info(f"[PIPELINE] Step 1b: Brand Analysis - Complete (Brand: {brand_config.name})")
                elif prompt_analysis.get('product_focus'):
                    logger.info(f"[PIPELINE] Step 1b: Implicit Brand Analysis - Start")
                    brand_service = BrandAnalysisService(openai_api_key=settings.openai_api_key, use_mock=False)
                    brand_config = await brand_service.analyze_brand(analysis_response.analysis)
                    if brand_config.name == "Corporate Brand":
                        brand_config = None
                    logger.info(f"[PIPELINE] Step 1b: Implicit Brand Analysis - Complete (Brand: {brand_config.name if brand_config else 'None'})")

                # --- Step 2: Scene Decomposition ---
                logger.info(f"[PIPELINE] Step 2: Scene Decomposition - Start")
                scene_request = SceneDecompositionRequest(
                    video_type="ad",
                    total_duration=generation_request.parameters.duration_seconds,
                    prompt_analysis=prompt_analysis,
                    brand_config=brand_config.dict() if brand_config else None
                )
                scene_response = decompose_video_scenes(scene_request)
                scenes = [scene.dict() for scene in scene_response.scenes]
                logger.info(f"[PIPELINE] Step 2: Scene Decomposition - Complete ({len(scenes)} scenes)")

                # --- Step 3: Micro-Prompt Generation ---
                logger.info(f"[PIPELINE] Step 3: Micro-Prompt Generation - Start")
                
                brand_style_vector = None
                if brand_config:
                    brand_style_vector = create_default_style_vector("good_brand_adaptation")
                    brand_style_vector.brand_name = brand_config.name
                    brand_style_vector.content_description = generation_request.prompt[:100]

                micro_prompt_request = MicroPromptRequest(
                    generation_id=generation_id,
                    scenes=scenes,
                    prompt_analysis=prompt_analysis,
                    brand_config=brand_config.dict() if brand_config else None,
                    brand_style_vector=brand_style_vector.dict() if brand_style_vector else None
                )
                
                prompt_builder = MicroPromptBuilderService()
                micro_prompt_response = await prompt_builder.build_micro_prompts(micro_prompt_request)
                micro_prompts = [mp.dict() for mp in micro_prompt_response.micro_prompts]
                logger.info(f"[PIPELINE] Step 3: Micro-Prompt Generation - Complete ({len(micro_prompts)} prompts)")

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"[PIPELINE] AI Service Error: {str(e)}", exc_info=True)
                import traceback
                logger.error(f"[PIPELINE] Traceback: {traceback.format_exc()}")
                raise HTTPException(status_code=500, detail=f"AI processing failed: {str(e)}. Check logs for traceback.")
        else:
            logger.warning("AI services not available, proceeding without analysis")

        return {
            "prompt_analysis": prompt_analysis,
            "brand_config": brand_config,
            "scenes": scenes,
            "micro_prompts": micro_prompts
        }

    async def generate_videos(
        self, 
        generation_id: str, 
        scenes: List[Dict], 
        micro_prompts: List[Any], 
        generation_request: GenerationRequest,
        webhook_base_url: Optional[str]
    ) -> List[Dict]:
        """
        Triggers the video generation process using ReplicateService.
        """
        if not (scenes and micro_prompts and len(scenes) == len(micro_prompts)):
            logger.warning(f"[VIDEO_GENERATION] Skipping generation: Scenes/Prompts mismatch or empty. Scenes: {len(scenes) if scenes else 0}, Prompts: {len(micro_prompts) if micro_prompts else 0}")
            return []

        parallelize = generation_request.options.parallelize_generations if generation_request.options else False
        aspect_ratio = (
            str(generation_request.parameters.aspect_ratio.value)
            if hasattr(generation_request.parameters.aspect_ratio, "value")
            else str(generation_request.parameters.aspect_ratio)
        )

        logger.info(f"[VIDEO_GENERATION] Starting generation for {len(micro_prompts)} clips. Parallel: {parallelize}, AR: {aspect_ratio}")

        # Extract prompt_text
        micro_prompt_texts: List[str] = []
        for mp in micro_prompts:
            if isinstance(mp, dict):
                prompt_text = mp.get("prompt_text", "")
                if not prompt_text:
                    prompt_text = mp.get("prompt", "") or str(mp)
                micro_prompt_texts.append(prompt_text)
            else:
                micro_prompt_texts.append(getattr(mp, "prompt_text", str(mp)))

        try:
            video_results = await replicate_service.generate_video_clips(
                scenes=scenes,
                micro_prompts=micro_prompt_texts,
                generation_id=generation_id,
                aspect_ratio=aspect_ratio,
                parallelize=parallelize,
                webhook_base_url=webhook_base_url
            )
            
            if not video_results and not replicate_service.api_token:
                 raise HTTPException(status_code=503, detail="Video generation unavailable: Replicate API token not configured")
            
            return video_results

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[VIDEO_GENERATION] Service call failed: {e}", exc_info=True)
            # Return empty list so we don't crash the whole response, but log the error
            # The caller should handle the empty results
            return []

# Global instance
generation_pipeline = GenerationPipelineService()

