"""
Conflict Resolver root export module.
"""
from app.services.conflict_resolver import (
    conflict_resolver,
    ConflictResolverService,
    CONFLICT_LOCATION_TOLERANCE_KM,
    CONFLICT_CONDITION_SCORE_TOLERANCE,
    SOURCE_SYSTEM_RECENCY_ORDER
)
