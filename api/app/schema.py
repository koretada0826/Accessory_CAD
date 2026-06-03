"""
構造JSON(AccessoryDesign)の Pydantic スキーマ。

フロント(TypeScript)の `web/src/types/accessory.ts` と対応する。
カテゴリ拡張に強くするため `extra='allow'` で未知フィールドを許容し、
バックエンドは必要な部分だけを厳密に読む方針。
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow")


class ManufacturingRules(_Base):
    minWallThickness: float = 0.8
    minHoleDiameter: float = 1.0
    minBandThickness: float = 1.0
    minConnectorWidth: float = 0.9


class Stone(_Base):
    id: str
    cut: str = "round"
    setting: str = "prong"
    diameter: float = 3.0
    height: float = 1.5
    color: str = "#bfe9ff"
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})


class Hole(_Base):
    id: str
    role: str = "decoration"
    diameter: float = 1.0
    position: Dict[str, float] = Field(default_factory=lambda: {"x": 0, "y": 0})


class AccessoryDesign(_Base):
    """フロントの AccessoryDesign を緩く受ける。params は category により形が変わる。"""

    id: str
    name: str = "accessory"
    category: str
    unit: str = "mm"
    params: Dict[str, Any]
    components: List[Dict[str, Any]] = Field(default_factory=list)
    materialId: str = "silver"
    stones: List[Stone] = Field(default_factory=list)
    holes: List[Hole] = Field(default_factory=list)
    patterns: List[Dict[str, Any]] = Field(default_factory=list)
    engraving: List[Dict[str, Any]] = Field(default_factory=list)
    symmetry: Dict[str, Any] = Field(default_factory=dict)
    manufacturingRules: ManufacturingRules = Field(default_factory=ManufacturingRules)
    warnings: List[Dict[str, Any]] = Field(default_factory=list)
    schemaVersion: int = 1


class Warning(_Base):
    id: str
    severity: Literal["error", "warning", "info"]
    title: str
    detail: str
    target: Optional[str] = None
    suggestion: Optional[str] = None


class ManufacturingReport(_Base):
    warnings: List[Warning]
    weightGram: float
    costYen: int
    volumeMm3: float
    printable: bool


class DetectedFeatures(_Base):
    aspectRatio: float
    avgBrightness: float
    estimatedCategory: str
    symmetric: bool
    features: List[str]


class AnalyzeResult(_Base):
    design: AccessoryDesign
    confidence: float
    detected: DetectedFeatures
