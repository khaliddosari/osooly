from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Sidecar configuration (PRD 3.7). Values come from sidecar/.env locally
    and from the host's environment in production."""

    # LLM for the fine-tuning loop + justification prose. Same OpenRouter /
    # DeepSeek pairing the Osooly agent layer uses (PRD 3.6/3.8); optional,
    # the pipeline degrades to a static justification without it.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "deepseek/deepseek-v4-flash"
    openrouter_referer: str = "http://localhost:3000"
    openrouter_app_title: str = "Osooly Namtheg"

    # Scratch disk for bulky per-run binaries (dataset.csv, engineered.csv,
    # model.joblib, y_*.npy). Run state and results live in D1, not here.
    data_dir: Path = Path("./storage")
    log_level: str = "INFO"

    # ── Shared D1 (replaces Namtheg's storage.py) ──────────────────────────
    # Local dev: point d1_local_sqlite at wrangler's miniflare D1 file, or
    # leave empty to auto-discover it under ../.wrangler relative to this
    # package. Production: set the three cloudflare_* values to use the D1
    # HTTP API instead.
    d1_local_sqlite: str = ""
    cloudflare_account_id: str = ""
    cloudflare_d1_database_id: str = ""
    cloudflare_api_token: str = ""

    # Shared secret for server-to-server calls (the run_automl agent tool).
    # Requests carrying X-Osooly-Internal-Token equal to this value plus an
    # X-Osooly-User-Id header act on behalf of that user without a cookie.
    # Empty disables the internal path entirely.
    namtheg_internal_token: str = ""

    # Session cookie names NextAuth v5 issues (http vs https).
    session_cookie_names: tuple[str, ...] = (
        "authjs.session-token",
        "__Secure-authjs.session-token",
    )

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
