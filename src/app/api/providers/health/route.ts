import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
import { providerHealthSnapshot } from "@/lib/provider-health";
export async function GET() {
  try {
    await workspaceContext();
    return json({
      scope: "current-server-instance",
      observed: providerHealthSnapshot(),
      limitation:
        "Absence is not proof of availability. Instances reset; use platform landos_provider_health logs for operational history.",
    });
  } catch (error) {
    return apiError(error);
  }
}
