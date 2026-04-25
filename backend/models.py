from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

news_tags = Table('news_tags', Base.metadata,
    Column('news_id', Integer, ForeignKey('news_items.id')),
    Column('tag_id', Integer, ForeignKey('tags.id'))
)

entity_sources = Table('entity_sources', Base.metadata,
    Column('entity_id', Integer, ForeignKey('entities.id')),
    Column('source_id', Integer, ForeignKey('sources.id'))
)

news_entities = Table('news_entities', Base.metadata,
    Column('news_id', Integer, ForeignKey('news_items.id')),
    Column('entity_id', Integer, ForeignKey('entities.id'))
)

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    color = Column(String, default="blue")
    description = Column(String, nullable=True)

    news_items = relationship("NewsItem", secondary=news_tags, back_populates="tags")

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String)  # RSS, WEBSITE, SOCIAL, API, VIDEO, DOCUMENT
    subtype = Column(String, nullable=True) # TWITTER, YOUTUBE, etc.
    config = Column(JSON) # { "url": "...", "headers": "..." }
    icon = Column(String, nullable=True)
    health_status = Column(String, default="OK")
    active = Column(Boolean, default=True)

    entities = relationship("Entity", secondary=entity_sources, back_populates="sources")

class Entity(Base):
    __tablename__ = "entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    type = Column(String)  # PERSON, ORGANIZATION, LOCATION, CONCEPT
    is_ignored = Column(Boolean, default=False)
    aliases = Column(JSON, default=list)

    sources = relationship("Source", secondary=entity_sources, back_populates="entities")
    news_items = relationship("NewsItem", secondary=news_entities, back_populates="entities")

class NewsItem(Base):
    __tablename__ = "news_items"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), index=True)
    title = Column(String, index=True)
    url = Column(String, unique=True, index=True)
    published_date = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="DISCOVERED")  # DISCOVERED, APPROVED, REJECTED
    language = Column(String, nullable=True)
    content_snippet = Column(String, nullable=True)
    full_content = Column(Text, nullable=True)
    
    # Spanish translations
    title_es = Column(String, nullable=True)
    content_es = Column(Text, nullable=True)
    
    # Processing flags
    entities_extracted = Column(Boolean, default=False)
    
    source = relationship("Source")
    tags = relationship("Tag", secondary=news_tags, back_populates="news_items")
    entities = relationship("Entity", secondary=news_entities, back_populates="news_items")

class AgentConfig(Base):
    __tablename__ = "agent_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class InterestTopic(Base):
    __tablename__ = "interest_topics"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, index=True)  # Asunto
    scope = Column(String)  # Alcance
    keywords = Column(String)  # Comma-separated
    exclusions = Column(String)  # Comma-separated
    relevance_level = Column(String)  # High, Medium, Low
    context_tags = Column(String)  # Comma-separated tags

class EntityType(Base):
    __tablename__ = "entity_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)  # e.g., "PERSON", "WEAPON"
    color = Column(String, nullable=False)  # e.g., "blue", "red", "amber"
