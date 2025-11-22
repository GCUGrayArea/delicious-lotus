import json
import os
from typing import Any

from fastapi import APIRouter, HTTPException, status
from openai import OpenAI
from pydantic import ValidationError

from app.api.schemas.prompts import VideoPromptRequest, VideoPromptResponse

router = APIRouter(prefix="/prompts", tags=["prompts"])

# System prompt for the video clip generator
SYSTEM_PROMPT = """You are a Video Clip Prompt Generator that transforms user ideas into structured prompts for AI video generation.

## Your Task
Convert the user's concept into 3-6 video clips (default 5 seconds each) that form a cohesive 15-30 second commercial. All clips will be stitched together into a single video, so maintain consistent visual style, tone, and theme throughout.

## Rules
1. Output ONLY valid JSON - no explanations, no markdown, no additional text
2. Each clip needs both a video_prompt (for motion/action) and image_prompt (for initial frame generation)
3. Maintain CONSISTENT visual style across all clips (same color palette, lighting style, mood, aesthetic)
4. Ensure smooth narrative flow and visual continuity between clips
5. Default clip length is 5 seconds unless user specifies otherwise
6. Optimize prompts for AI generators (clear subjects, actions, camera angles, lighting)
7. Keep prompts concise but descriptive (aim for 15-25 words per prompt)

## Consistency Guidelines
- **Color Palette**: Keep colors consistent (e.g., if clip 1 uses "warm golden tones", maintain throughout)
- **Lighting Style**: Use same lighting approach (e.g., "soft natural light" or "dramatic high contrast")
- **Mood/Tone**: Maintain consistent emotional tone (e.g., "energetic and bold" vs "calm and minimal")
- **Visual Style**: Stick to one aesthetic (e.g., "cinematic", "lifestyle", "modern minimalist", "vibrant pop")
- **Time of Day**: Keep consistent if relevant (e.g., all sunset, all morning light)

## Prompt Structure
- **image_prompt**: Describes the static starting frame - composition, subject placement, lighting, colors, scene setup
- **video_prompt**: Describes the motion, camera movement, and action that will animate from the starting frame

## Output Format
```json
{
  "success": "Successfully created [N] video prompts",
  "content": [
    {
      "video_prompt": "Description of motion, camera movement, and dynamic action",
      "image_prompt": "Description of the initial static frame composition, lighting, and scene setup",
      "length": 5
    }
  ]
}
```

## Error Format (if user input is unclear or invalid)
```json
{
  "success": "Error: [brief explanation of what's missing or unclear]",
  "content": []
}
```

## Best Practices
- **Image Prompt**: Focus on composition, framing, subject positioning, lighting setup, color palette, and static scene elements
- **Video Prompt**: Focus on what moves/changes - camera motion, subject action, environmental dynamics
- Establish visual style in first clip and carry it through all subsequent clips
- Ensure image and video prompts complement each other (the video should logically flow from the image)
- Ensure clips build a story arc: hook → development → climax/call-to-action
"""

from app.config import settings

@router.post(
    "/generate-video-clips",
    response_model=VideoPromptResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate video clips prompts",
    description="Generate structured video and image prompts for AI video generation using OpenAI GPT-4o",
)
async def generate_video_clips(request: VideoPromptRequest) -> VideoPromptResponse:
    api_key = settings.openai_api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )

    client = OpenAI(api_key=api_key)

    user_content = f"User: \"{request.prompt}\""
    if request.num_clips:
        user_content += f"\nPlease generate exactly {request.num_clips} clips."
    if request.clip_length:
        user_content += f"\nEach clip should be {request.clip_length} seconds long."

    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )

        content_str = completion.choices[0].message.content
        if not content_str:
            raise ValueError("Empty response from OpenAI")

        data = json.loads(content_str)
        
        # Validate against schema
        return VideoPromptResponse(**data)

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to parse OpenAI response as JSON",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI response validation failed: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenAI API error: {str(e)}",
        )
