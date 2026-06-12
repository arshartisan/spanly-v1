import { redirect } from "next/navigation";

// /settings → default to the General tab (doc 11).
export default function SettingsIndex() {
  redirect("/settings/general");
}
