import { Container } from "@cloudflare/containers";

/**
 * The Namtheg FastAPI sidecar (../../sidecar), run as a Cloudflare Container.
 * Cold-starts on first request, sleeps after 10 minutes idle (PRD 3.5a
 * free-tier posture: AutoML runs are occasional, not steady traffic).
 */
export class NamthegSidecar extends Container {
  defaultPort = 8000;
  sleepAfter = "10m";
  enableInternet = true;
}

interface Env {
  SIDECAR: DurableObjectNamespace<NamthegSidecar>;
  OPENROUTER_API_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  NAMTHEG_INTERNAL_TOKEN?: string;
}

/**
 * One global instance (getByName("singleton")): concurrent AutoML runs
 * queue behind each other on the same "basic" container rather than paying
 * for parallel instances. Acceptable for v1 volume; revisit with
 * getByName(runId) if usage grows.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = env.SIDECAR.getByName("singleton");
    await container.startAndWaitForPorts({
      startOptions: {
        envVars: {
          OPENROUTER_API_KEY: env.OPENROUTER_API_KEY ?? "",
          CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN ?? "",
          CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID ?? "",
          CLOUDFLARE_D1_DATABASE_ID: env.CLOUDFLARE_D1_DATABASE_ID ?? "",
          NAMTHEG_INTERNAL_TOKEN: env.NAMTHEG_INTERNAL_TOKEN ?? "",
        },
      },
    });
    return container.fetch(request);
  },
};
