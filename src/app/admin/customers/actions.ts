"use server";

import { revalidatePath } from "next/cache";
import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateCustomerResult = { ok: true } | { ok: false; message: string };

export async function createCustomerAction(input: {
  name: string;
  contactEmail: string;
  status: "active" | "inactive";
}): Promise<CreateCustomerResult> {
  const name = input.name.trim();
  const email = input.contactEmail.trim();
  if (!name || !email) {
    return { ok: false, message: "กรุณากรอกชื่อและอีเมล" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("customers").insert({
    name,
    contact_email: email,
    status: input.status,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await writeAuditLog(supabase, {
    severity: "info",
    category: "customer",
    action: "customer.create",
    detail: `${name} · ${email}`.slice(0, 500),
    meta: { status: input.status },
    userId: user?.id ?? null,
  });

  revalidatePath("/admin/customers");
  revalidatePath("/admin/audit");
  return { ok: true };
}
