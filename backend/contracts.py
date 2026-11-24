from datetime import date, datetime, timezone
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Key = Annotated[str, Field(min_length=1, max_length=128)]
Text = Annotated[str, Field(max_length=2000)]
Mode = Literal["Explicar", "Orientar", "Praticar", "Revisar"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Fact(Input):
    id: Key
    kind: Literal[
        "task",
        "assessment",
        "goal",
        "activity",
        "session",
        "start",
        "review",
        "reflection",
        "concept",
        "card",
    ]
    subject: str = Field(default="", max_length=128)
    concept: str = Field(default="", max_length=128)
    goal: str = Field(default="", max_length=128)
    name: str = Field(default="", max_length=160)
    prerequisite: str = Field(default="", max_length=128)
    due: date | None = None
    at: datetime | None = None

    @field_validator("at")
    @classmethod
    def timezone_required(cls, v):
        if v and not v.tzinfo:
            raise ValueError("Instante sem fuso horário.")
        return v.astimezone(timezone.utc) if v else v

    done: bool = False
    correct: bool | None = None
    duration_ms: int = Field(default=0, ge=0, le=8640000000000000)


class Snapshot(Input):
    revision: int = Field(ge=0)
    facts: list[Fact] = Field(max_length=15000)

    @model_validator(mode="after")
    def unique(self):
        if len({(f.kind, f.id) for f in self.facts}) != len(self.facts):
            raise ValueError("Registros repetidos")
        return self


class Preferences(Input):
    tutor_enabled: bool = True
    enabled: bool = True
    categories: list[Literal["prazos", "prática", "planejamento", "progresso"]] = [
        "prazos",
        "prática",
        "planejamento",
        "progresso",
    ]
    quiet_start: int = Field(default=22, ge=0, le=23)
    quiet_end: int = Field(default=7, ge=0, le=23)
    timezone: str = "America/Bahia"
    frequency_hours: int = Field(default=24, ge=1, le=168)
    retention_days: int = Field(default=90, ge=7, le=365)
    horizon: int = Field(default=7, ge=1, le=30)
    errors: int = Field(default=2, ge=1, le=10)
    daily_capacity: int = Field(default=3, ge=1, le=30)

    @field_validator("timezone")
    @classmethod
    def zone(cls, v):
        try:
            ZoneInfo(v)
        except (KeyError, ValueError):
            raise ValueError("Fuso inválido")
        return v


class Thread(Input):
    subject: Key
    concept: str = Field(default="", max_length=128)
    docs: list[UUID] = Field(min_length=1, max_length=8)


class Question(Input):
    question: str = Field(min_length=2, max_length=2000)
    mode: Mode = "Explicar"
    objective: Text = ""
    concept_name: Text = ""
    subject_name: Text = ""
    complexity: Literal["Inicial", "Intermediária", "Avançada"] = "Inicial"
    general: bool = False
    solution: bool = False


class Answer(Input):
    sufficient: bool = True
    answer: str = Field(default="", max_length=6000)
    citations: list[UUID] = Field(max_length=6)
    question: str = Field(default="", max_length=500)
    expected: Text = ""
    choices: list[Annotated[str, Field(max_length=500)]] = Field(
        default_factory=list, max_length=5
    )

    @model_validator(mode="after")
    def require_supported_text(self):
        if self.sufficient and not self.answer.strip():
            raise ValueError("Uma resposta fundamentada precisa de texto.")
        return self


class Decision(Input):
    status: Literal["lida", "aceita", "ignorada", "concluída"]
