import { redirect } from "next/navigation";

// Old experiment links now open the single supported workspace scene.
export default function Map3DPage() {
  redirect("/app/map");
}
