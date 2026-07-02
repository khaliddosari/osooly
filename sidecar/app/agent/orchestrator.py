import logging

from app import storage_d1 as storage

log = logging.getLogger(__name__)


def run_agent(run_id: str, target: str) -> dict:
    """Drive the six-step pipeline for one run, then the fine-tuning loop.

    Direct Python orchestration (same as upstream Namtheg): the step order is
    fixed, so calling the pipeline functions beats burning LLM tokens on a
    tool-calling agent that would pick the same order. The LLM earns its keep
    in run_fine_tuning_loop (hyperparameter suggestions + the justification).
    """
    storage.write_status(run_id, "running", target=target)
    try:
        from app.pipeline import profile
        log.info("Pipeline %s: profiling dataset...", run_id)
        profile.profile_dataset(run_id)

        from app.pipeline import detect
        log.info("Pipeline %s: detecting problem type...", run_id)
        detection = detect.detect_problem_type(run_id, target)
        problem_type = detection.get("problem_type", "classification")

        from app.pipeline import eda
        log.info("Pipeline %s: running EDA...", run_id)
        eda.run_eda(run_id, target)

        from app.pipeline import feature_engineering
        log.info("Pipeline %s: engineering features...", run_id)
        feature_engineering.feature_engineer(run_id, target)

        from app.pipeline import train
        log.info("Pipeline %s: training model candidates...", run_id)
        metrics = train.train_model(run_id, target, problem_type)
        accuracy_score = metrics.get("score", 0.0)
        score_metric = metrics.get("score_metric", "accuracy")

        from app.pipeline import visualize
        log.info("Pipeline %s: generating plots...", run_id)
        viz_info = visualize.generate_visualization(run_id, target, problem_type)
        plot_path = viz_info.get("plot_path", "")

        from app.agent.optimization import run_fine_tuning_loop
        log.info("Pipeline %s: running optimization fine-tuning loop...", run_id)
        optimized = run_fine_tuning_loop(
            run_id=run_id,
            target=target,
            problem_type=problem_type,
            baseline_results={
                "model_name": metrics.get("model_name"),
                "score": accuracy_score,
                "score_metric": score_metric,
                "extra": metrics.get("extra", {}),
            }
        )

        final = {
            "run_id": run_id,
            "status": "succeeded",
            "target": target,
            "problem_type": problem_type,
            "accuracy_score": optimized.get("score"),
            "score_metric": score_metric,
            "plot_path": plot_path,
            "justification": (
                (optimized.get("justification") or "").replace("\u2014", "-").replace("\u2013", "-")
                or f"{optimized.get('model_name', 'The champion model')} achieved the strongest "
                   f"cross-validation performance ({optimized.get('score', 0):.4f} {score_metric}) "
                   f"among all candidates and was selected as champion."
            ),
            "model_name": optimized.get("model_name"),
            "extra": optimized.get("extra", {}),
        }
        storage.write_json(run_id, "result.json", final)
        storage.write_status(run_id, "succeeded")
        log.info("Pipeline %s: completed successfully.", run_id)
        return final
    except Exception as e:
        log.exception("Agent run failed for %s", run_id)
        err = {
            "run_id": run_id,
            "status": "failed",
            "target": target,
            "error": str(e),
        }
        try:
            storage.write_json(run_id, "result.json", err)
            storage.write_status(run_id, "failed", error=str(e))
        except Exception:
            log.exception("Could not persist failure for run %s", run_id)
        return err
