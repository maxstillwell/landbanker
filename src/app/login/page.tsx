import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/config";
export default function Page() {
  return <AuthForm mode="login" enabled={configured()} />;
}
