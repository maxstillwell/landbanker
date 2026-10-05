import { workspaceContext } from "@/lib/workspace";
import { apiError, json } from "@/lib/api";
export async function GET() {
  try {
    const { client, workspaceId } = await workspaceContext();
    const [p, o, l, v] = await Promise.all([
      client
        .from("land_parcels")
        .select("*")
        .eq("workspace_id", workspaceId)
        .limit(1000),
      client
        .from("field_observations")
        .select("*,field_observation_media(*)")
        .eq("workspace_id", workspaceId)
        .order("observed_at", { ascending: false })
        .limit(500),
      client
        .from("spatial_layers")
        .select("*")
        .eq("workspace_id", workspaceId)
        .limit(100),
      client
        .from("saved_views")
        .select("id,name,view")
        .eq("workspace_id", workspaceId)
        .limit(100),
    ]);
    for (const r of [p, o, l, v]) if (r.error) throw r.error;
    const observations = await Promise.all(
      (o.data || []).map(async (item) => ({
        ...item,
        field_observation_media: await Promise.all(
          item.field_observation_media.map(
            async (m: {
              storage_path: string | null;
              upload_status: string;
            }) => {
              if (!m.storage_path || m.upload_status !== "uploaded") return m;
              const { data } = await client.storage
                .from("field-media")
                .createSignedUrl(m.storage_path, 300);
              return { ...m, url: data?.signedUrl };
            },
          ),
        ),
      })),
    );
    return json({
      parcels: p.data,
      observations,
      layers: l.data,
      savedViews: v.data,
    });
  } catch (e) {
    return apiError(e);
  }
}
