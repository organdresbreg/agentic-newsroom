from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class SourceBase(BaseModel):
    name: str
    type: str
    subtype: Optional[str] = None
    config: Dict[str, Any]
    icon: Optional[str] = None
    health_status: str = "OK"
    active: bool = True

class SourceCreate(SourceBase):
    pass

class SourceResponse(SourceBase):
    id: int

    class Config:
        from_attributes = True

class EntityBase(BaseModel):
    name: str
    type: str

class EntityCreate(EntityBase):
    source_ids: List[int] = []
    aliases: List[str] = []

class EntityResponse(EntityBase):
    id: int
    is_ignored: bool = False
    aliases: List[str] = []
    sources: List[SourceResponse] = []

    class Config:
        from_attributes = True

class EntitySimpleResponse(BaseModel):
    id: int
    name: str
    type: str
    is_ignored: bool = False

    class Config:
        from_attributes = True

class TagBase(BaseModel):
    name: str
    color: str = "blue"
    description: Optional[str] = None

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int

    class Config:
        from_attributes = True

class NewsItemBase(BaseModel):
    title: str
    url: str
    published_date: Optional[str] = None
    status: str = "DISCOVERED"

class NewsItemCreate(NewsItemBase):
    source_id: int

class NewsItemResponse(NewsItemBase):
    id: int
    source_id: int
    source: Optional[SourceResponse] = None
    created_at: datetime
    language: Optional[str] = None
    content_snippet: Optional[str] = None
    title_es: Optional[str] = None
    content_es: Optional[str] = None
    tags: List[TagResponse] = []
    entities: List[EntitySimpleResponse] = []

    class Config:
        from_attributes = True

class NewsItemStatusUpdate(BaseModel):
    status: str

class AgentConfigBase(BaseModel):
    key: str
    value: str

class AgentConfigCreate(AgentConfigBase):
    pass

class AgentConfigResponse(AgentConfigBase):
    class Config:
        from_attributes = True

class BatchIdRequest(BaseModel):
    ids: List[int]

class AIConfigSettings(BaseModel):
    api_key: Optional[str] = None
    system_prompt: Optional[str] = None

class InterestTopicBase(BaseModel):
    subject: str
    scope: str
    keywords: str
    exclusions: Optional[str] = None
    relevance_level: str
    context_tags: Optional[str] = None

class InterestTopicCreate(InterestTopicBase):
    pass

class InterestTopicResponse(InterestTopicBase):
    id: int

    class Config:
        from_attributes = True


class EntityTypeBase(BaseModel):
    name: str
    color: str

class EntityTypeCreate(EntityTypeBase):
    pass

class EntityTypeResponse(EntityTypeBase):
    id: int

    class Config:
        from_attributes = True

