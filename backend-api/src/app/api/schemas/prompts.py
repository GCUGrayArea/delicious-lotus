from typing import List, Optional
from pydantic import BaseModel, Field

class VideoClip(BaseModel):
    video_prompt: str = Field(..., description="Description of motion, camera movement, and dynamic action")
    image_prompt: str = Field(..., description="Description of the initial static frame composition, lighting, and scene setup")
    length: int = Field(default=5, description="Duration of the clip in seconds")

class VideoPromptRequest(BaseModel):
    prompt: str = Field(..., description="The user's concept or idea for the video")
    num_clips: Optional[int] = Field(default=5, ge=3, le=10, description="Number of clips to generate (default 5)")
    clip_length: Optional[int] = Field(default=5, description="Default length for each clip in seconds")

class VideoPromptResponse(BaseModel):
    success: str = Field(..., description="Success message")
    content: List[VideoClip] = Field(..., description="List of generated video clips")
