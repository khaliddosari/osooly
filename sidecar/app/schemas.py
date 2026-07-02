from typing import Literal, Optional

from pydantic import BaseModel, Field


ProblemType = Literal["regression", "classification"]
RunStatus = Literal["uploaded", "queued", "running", "succeeded", "failed"]


class StartRunRequest(BaseModel):
    target: str = Field(..., description="Name of the target column the user picked.")


class RunResult(BaseModel):
    run_id: str
    status: RunStatus
    target: Optional[str] = None
    problem_type: Optional[ProblemType] = None
    accuracy_score: Optional[float] = None
    score_metric: Optional[str] = None
    plot_path: Optional[str] = None
    justification: Optional[str] = None
    error: Optional[str] = None
