from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from typing import List
import time

import models
import schemas
from database import SessionLocal, engine
from sqlalchemy import text
from datetime import datetime
from services import ingestor, translator, extractor

models.Base.metadata.create_all(bind=engine)

# Simple migration to ensure new columns exist (for prototype robustness)
def run_migrations():
    db = SessionLocal()
    try:
        # Check if column exists by trying to select it. If error, add it.
        # SQLite doesn't support IF NOT EXISTS in ALTER TABLE ADD COLUMN directly in all versions/drivers nicely,
        # so we try-except.
        # List of columns to check and adding if missing
        columns = [
            ("language", "VARCHAR"),
            ("content_snippet", "TEXT")
        ]
        
        for col_name, col_type in columns:
            try:
                db.execute(text(f"SELECT {col_name} FROM news_items LIMIT 1"))
            except Exception:
                db.rollback()
                try:
                    db.execute(text(f"ALTER TABLE news_items ADD COLUMN {col_name} {col_type}"))
                    db.commit()
                    print(f"Migration: Added column {col_name}")
                except Exception as e:
                    db.rollback()
                    print(f"Migration error adding {col_name}: {e}")
    except Exception as e:
        print(f"Migration warning: {e}")
    finally:
        db.close()

run_migrations()

def initialize_entity_types():
    """Ensure default entity types exist in the database."""
    db = SessionLocal()
    try:
        # Check if EntityType table is empty
        count = db.query(models.EntityType).count()
        if count == 0:
            default_types = [
                {"name": "Persona", "color": "blue"},
                {"name": "Organización", "color": "purple"},
                {"name": "Lugar", "color": "green"},
                {"name": "Concepto", "color": "slate"}
            ]
            for type_data in default_types:
                entity_type = models.EntityType(**type_data)
                db.add(entity_type)
            db.commit()
            print(f"[STARTUP] Initialized {len(default_types)} default entity types")
        else:
            print(f"[STARTUP] Entity types already initialized ({count} types)")
    except Exception as e:
        print(f"[STARTUP] Error initializing entity types: {e}")
        db.rollback()
    finally:
        db.close()

initialize_entity_types()


app = FastAPI()

# Configure CORS - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/status")
async def get_status():
    return {"status": "online", "system_active": True}

@app.get("/api/dashboard-stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    sources_count = db.query(models.Source).count()
    active_news_count = db.query(models.NewsItem).filter(models.NewsItem.status == "DISCOVERED").count()
    return {
        "active_news": active_news_count,
        "sources_count": sources_count
    }

@app.get("/api/sources", response_model=List[schemas.SourceResponse])
def read_sources(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sources = db.query(models.Source).offset(skip).limit(limit).all()
    return sources

@app.post("/api/sources", response_model=schemas.SourceResponse)
def create_source(source: schemas.SourceCreate, db: Session = Depends(get_db)):
    db_source = models.Source(**source.dict())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

@app.put("/api/sources/{source_id}", response_model=schemas.SourceResponse)
def update_source(source_id: int, source: schemas.SourceCreate, db: Session = Depends(get_db)):
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    
    for key, value in source.dict().items():
        setattr(db_source, key, value)
    
    db.commit()
    db.refresh(db_source)
    return db_source

@app.delete("/api/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db)):
    db_source = db.query(models.Source).filter(models.Source.id == source_id).first()
    if db_source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(db_source)
    db.commit()
    return {"ok": True}

@app.get("/")
async def root():
    return {"message": "Agentic Newsroom Backend is running"}

@app.post("/api/scan")
def scan_sources(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Ingest RSS feeds (Synchronous)
    # We process all feeds here to give immediate feedback on count
    count, new_ids = ingestor.process_feeds(db)
    
    # 2. Trigger Parallel flows in background (Heavy lifting)
    background_tasks.add_task(auto_extract_native_background)

    if new_ids:
        background_tasks.add_task(auto_translate_background, new_ids)
    
    return {"new_items": count, "new_item_ids": new_ids}

def clean_old_invalid_entities(db: Session):
    """Temporary helper to wipe entities that start with STOP_PREFIXES after filter update."""
    from services.extractor import STOP_PREFIXES
    from models import Entity
    for prefix in STOP_PREFIXES:
        db.query(Entity).filter(Entity.name.like(f"{prefix}%")).delete(synchronize_session=False)
    db.commit()

def auto_translate_background(new_item_ids: List[int]):
    """Helper to translate items. Extraction is handled internally by translator per batch."""
    db = SessionLocal()
    try:
        print(f"[Background] Starting translation flow for {len(new_item_ids)} items")
        count = translator.process_pending_translations(db, new_item_ids)
        print(f"[Background] Flow A: Translated {count} items")
    except Exception as e:
        print(f"[Background] Error during translation flow: {e}")
    finally:
        db.close()

def auto_extract_entities_background():
    """Helper to extract entities from translated items (if any left)."""
    db = SessionLocal()
    try:
        count = extractor.process_pending_entities(db)
        if count > 0:
            print(f"[Background] Extracted entities from {count} translated items")
    except Exception as e:
        print(f"[Background] Error during batch entity extraction: {e}")
    finally:
        db.close()

def auto_extract_native_background():
    """Helper to extract entities from native Spanish items."""
    db = SessionLocal()
    try:
        count = extractor.process_native_pending(db)
        if count > 0:
            print(f"[Background] Extracted entities from {count} native ES items")
    except Exception as e:
        print(f"[Background] Error during native entity extraction: {e}")
    finally:
        db.close()

@app.get("/api/news/discovered", response_model=List[schemas.NewsItemResponse])
def get_discovered_news(db: Session = Depends(get_db)):
    return db.query(models.NewsItem).options(
        joinedload(models.NewsItem.source),
        joinedload(models.NewsItem.entities)
    ).filter(models.NewsItem.status == "DISCOVERED").order_by(models.NewsItem.published_date.desc()).all()

@app.put("/api/news/{news_id}/status", response_model=schemas.NewsItemResponse)
def update_news_status(news_id: int, status_update: schemas.NewsItemStatusUpdate, db: Session = Depends(get_db)):
    item = db.query(models.NewsItem).filter(models.NewsItem.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="News item not found")
    
    item.status = status_update.status
    db.commit()
    db.refresh(item)
    return item


@app.get("/api/news/rejected", response_model=List[schemas.NewsItemResponse])
def get_rejected_news(db: Session = Depends(get_db)):
    return db.query(models.NewsItem).options(
        joinedload(models.NewsItem.source),
        joinedload(models.NewsItem.entities)
    ).filter(models.NewsItem.status == 'REJECTED').order_by(models.NewsItem.published_date.desc()).all()

@app.delete("/api/news/{news_id}")
def delete_news_item(news_id: int, db: Session = Depends(get_db)):
    item = db.query(models.NewsItem).filter(models.NewsItem.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="News item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

@app.delete("/api/news/rejected/all")
def empty_trash(db: Session = Depends(get_db)):
    db.query(models.NewsItem).filter(models.NewsItem.status == "REJECTED").delete(synchronize_session=False)
    db.commit()
    return {"ok": True}

@app.put("/api/news/{news_id}/restore", response_model=schemas.NewsItemResponse)
def restore_news_item(news_id: int, db: Session = Depends(get_db)):
    item = db.query(models.NewsItem).filter(models.NewsItem.id == news_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="News item not found")
    
    item.status = "DISCOVERED"
    db.commit()
    db.refresh(item)
    return item

@app.post("/api/news/batch/delete")
def batch_delete_news(request: schemas.BatchIdRequest, db: Session = Depends(get_db)):
    db.query(models.NewsItem).filter(models.NewsItem.id.in_(request.ids)).delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "count": len(request.ids)}

@app.post("/api/news/batch/restore")
def batch_restore_news(request: schemas.BatchIdRequest, db: Session = Depends(get_db)):
    db.query(models.NewsItem).filter(models.NewsItem.id.in_(request.ids)).update({models.NewsItem.status: "DISCOVERED"}, synchronize_session=False)
    db.commit()
    return {"ok": True, "count": len(request.ids)}




@app.post("/api/extract-entities")
def extract_entities(db: Session = Depends(get_db)):
    """
    Manual trigger for entity extraction.
    Uses the new Extractor service with Groq (Spanish).
    """
    try:
        count = extractor.process_pending_entities(db)
        return {"extracted_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Entity Type Endpoints

@app.get("/api/entity-types", response_model=List[schemas.EntityTypeResponse])
def read_entity_types(db: Session = Depends(get_db)):
    """Get all entity types for dropdown population."""
    entity_types = db.query(models.EntityType).all()
    return entity_types

@app.post("/api/entity-types", response_model=schemas.EntityTypeResponse)
def create_entity_type(entity_type: schemas.EntityTypeCreate, db: Session = Depends(get_db)):
    """Create a new custom entity type."""
    # Check if type with same name already exists (case-insensitive)
    existing = db.query(models.EntityType).filter(models.EntityType.name.ilike(entity_type.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Entity type with this name already exists")
    
    db_entity_type = models.EntityType(
        name=entity_type.name,
        color=entity_type.color
    )
    
    try:
        db.add(db_entity_type)
        db.commit()
        db.refresh(db_entity_type)
        return db_entity_type
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/entity-types/{type_id}", response_model=schemas.EntityTypeResponse)
def update_entity_type(type_id: int, entity_type: schemas.EntityTypeCreate, db: Session = Depends(get_db)):
    """Update an existing entity type."""
    db_type = db.query(models.EntityType).filter(models.EntityType.id == type_id).first()
    if not db_type:
        raise HTTPException(status_code=404, detail="Entity type not found")
    
    # Check if name is already taken by another type
    existing = db.query(models.EntityType).filter(
        models.EntityType.name.ilike(entity_type.name),
        models.EntityType.id != type_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Entity type with this name already exists")
    
    db_type.name = entity_type.name
    db_type.color = entity_type.color
    
    db.commit()
    db.refresh(db_type)
    return db_type

@app.delete("/api/entity-types/{type_id}")
def delete_entity_type(type_id: int, db: Session = Depends(get_db)):
    """Delete an entity type."""
    db_type = db.query(models.EntityType).filter(models.EntityType.id == type_id).first()
    if not db_type:
        raise HTTPException(status_code=404, detail="Entity type not found")
    
    # Optional: Prevent deletion of default types if desired, but here we'll allow it.
    db.delete(db_type)
    db.commit()
    return {"ok": True}

# Entity Endpoints

@app.get("/api/entities", response_model=List[schemas.EntityResponse])
def read_entities(skip: int = 0, limit: int = 100, include_ignored: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.Entity).options(joinedload(models.Entity.sources))
    
    if not include_ignored:
        query = query.filter(models.Entity.is_ignored == False)
    
    entities = query.offset(skip).limit(limit).all()
    return entities

@app.post("/api/entities", response_model=schemas.EntityResponse)
def create_entity(entity: schemas.EntityCreate, db: Session = Depends(get_db)):
    db_entity = models.Entity(
        name=entity.name,
        type=entity.type,
        description=entity.description
    )
    
    if entity.source_ids:
        sources = db.query(models.Source).filter(models.Source.id.in_(entity.source_ids)).all()
        db_entity.sources = sources
    
    db.add(db_entity)
    try:
        db.commit()
        db.refresh(db_entity)
        return db_entity
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/entities/{entity_id}", response_model=schemas.EntityResponse)
def update_entity(entity_id: int, entity: schemas.EntityCreate, db: Session = Depends(get_db)):
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    db_entity.name = entity.name
    db_entity.type = entity.type
    db_entity.description = entity.description
    
    if entity.source_ids is not None:
        sources = db.query(models.Source).filter(models.Source.id.in_(entity.source_ids)).all()
        db_entity.sources = sources
    
    try:
        db.commit()
        db.refresh(db_entity)
        return db_entity
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/entities/{entity_id}")
def delete_entity(entity_id: int, db: Session = Depends(get_db)):
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    db.delete(db_entity)
    db.commit()
    return {"ok": True}

@app.put("/api/entities/{entity_id}/ignore")
def toggle_ignore_entity(entity_id: int, db: Session = Depends(get_db)):
    db_entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if db_entity is None:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    # Toggle the is_ignored status
    db_entity.is_ignored = not db_entity.is_ignored
    db.commit()
    db.refresh(db_entity)
    
    return {"ok": True, "is_ignored": db_entity.is_ignored}

# --- System Backup & Restore ---

@app.get("/api/system/export")
def export_system(db: Session = Depends(get_db)):
    """Export configuration tables: Source, InterestTopic, Entity, Tag, EntityType, AgentConfig"""
    try:
        sources = db.query(models.Source).all()

        entities = db.query(models.Entity).options(joinedload(models.Entity.sources)).all()

        entity_types = db.query(models.EntityType).all()
        configs = db.query(models.AgentConfig).all()
        
        # Format sources
        sources_data = []
        for s in sources:
            sources_data.append({
                "id": s.id,
                "name": s.name,
                "type": s.type,
                "subtype": s.subtype,
                "config": s.config,
                "icon": s.icon,
                "health_status": s.health_status,
                "active": s.active
            })
            
        # Format entities and their relationship to sources
        entities_data = []
        for e in entities:
            entities_data.append({
                "id": e.id,
                "name": e.name,
                "type": e.type,
                "description": e.description,
                "is_ignored": e.is_ignored,
                "source_ids": [s.id for s in e.sources]
            })
            
            
            
        # Format entity types
        entity_types_data = []
        for et in entity_types:
            entity_types_data.append({
                "id": et.id,
                "name": et.name,
                "color": et.color
            })
            
        # Format configs
        configs_data = []
        for c in configs:
            configs_data.append({
                "key": c.key,
                "value": c.value
            })
            
        return {
            "sources": sources_data,
            "entities": entities_data,

            "entity_types": entity_types_data,

            "agent_config": configs_data,
            "version": "1.0",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.post("/api/system/import")
async def import_system(data: dict, db: Session = Depends(get_db)):
    """Wipe config tables and restore from JSON. Preserve NewsItems."""
    try:
        # 1. Wipe Config Tables (Order matters due to FKs if any, though here it's mostly secondary tables)

        db.execute(text("DELETE FROM news_entities")) # We wipe news-entity associations
        db.execute(text("DELETE FROM entity_sources"))
        db.query(models.Source).delete()
        db.query(models.Entity).delete()

        db.query(models.EntityType).delete()

        db.query(models.AgentConfig).delete()
        db.commit()
        
        # 2. Restore Entity Types (must be before entities since entities reference types)
        for et_data in data.get("entity_types", []):
            new_entity_type = models.EntityType(
                name=et_data["name"],
                color=et_data["color"]
            )
            db.add(new_entity_type)
        db.flush()
        
            
        # 4. Restore Sources
        source_map = {} # old_id -> new_source_obj
        for s_data in data.get("sources", []):
            old_id = s_data.get("id")
            new_source = models.Source(
                name=s_data["name"],
                type=s_data["type"],
                subtype=s_data.get("subtype"),
                config=s_data["config"],
                icon=s_data.get("icon"),
                health_status=s_data.get("health_status", "OK"),
                active=s_data.get("active", True)
            )
            db.add(new_source)
            db.flush()
            source_map[old_id] = new_source
            
        # 5. Restore Entities
        for e_data in data.get("entities", []):
            new_entity = models.Entity(
                name=e_data["name"],
                type=e_data["type"],
                description=e_data.get("description"),
                is_ignored=e_data.get("is_ignored", False)
            )
            # Restore relationships to sources
            if "source_ids" in e_data:
                related_sources = []
                for sid in e_data["source_ids"]:
                    if sid in source_map:
                        related_sources.append(source_map[sid])
                new_entity.sources = related_sources
            db.add(new_entity)
            
            
        # 7. Restore AgentConfig
        for c_data in data.get("agent_config", []):
            new_config = models.AgentConfig(
                key=c_data["key"],
                value=c_data["value"]
            )
            db.add(new_config)
            
        db.commit()
        return {"ok": True, "message": "System configuration restored successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
