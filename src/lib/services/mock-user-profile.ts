"use client";

import { users } from "@/lib/mock-data/fixtures";
import type { User, UserRole } from "@/types/models";

const STORAGE_KEY = "mock_user_profile_v1";

export const MOCK_PROFILE_UPDATED_EVENT = "mock-profile-updated";

type RoleProfilePatch = {
  name?: string;
  email?: string;
  avatarDataUrl?: string;
  passwordSha256Hex?: string;
};

type StoredShape = Partial<Record<UserRole, RoleProfilePatch>>;

function readStored(): StoredShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredShape;
  } catch {
    return {};
  }
}

function writeStored(data: StoredShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function notifyUpdated() {
  window.dispatchEvent(new Event(MOCK_PROFILE_UPDATED_EVENT));
}

export function getFixtureUser(role: UserRole): User {
  const match = users.find((u) => u.role === role);
  return match ?? users[0];
}

export type EffectiveProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarDataUrl: string | null;
};

export function getEffectiveProfile(role: UserRole): EffectiveProfile {
  const base = getFixtureUser(role);
  const patch = readStored()[role];
  const name = (patch?.name ?? base.name).trim() || base.name;
  const email = (patch?.email ?? base.email).trim() || base.email;
  const avatar =
    patch?.avatarDataUrl && patch.avatarDataUrl.length > 0 ? patch.avatarDataUrl : null;
  return {
    id: base.id,
    name,
    email,
    role,
    avatarDataUrl: avatar,
  };
}

/** โปรไฟล์จาก fixture เท่านั้น — ใช้เป็นค่าเริ่มต้นตอน SSR/ไฮเดรตเพื่อไม่ให้ไม่ตรงกับ localStorage */
export function getBaselineProfile(role: UserRole): EffectiveProfile {
  const base = getFixtureUser(role);
  return {
    id: base.id,
    name: base.name,
    email: base.email,
    role,
    avatarDataUrl: null,
  };
}

export function getStoredPasswordHash(role: UserRole): string | null {
  const h = readStored()[role]?.passwordSha256Hex;
  return h && /^[a-f0-9]{64}$/i.test(h) ? h.toLowerCase() : null;
}

export async function sha256Hex(plain: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function clearMockPassword(role: UserRole) {
  const data = readStored();
  const prev = data[role];
  if (!prev) return;
  const { passwordSha256Hex, ...rest } = prev;
  void passwordSha256Hex;
  let next: StoredShape;
  if (Object.keys(rest).length === 0) {
    const { [role]: _removed, ...restData } = data;
    void _removed;
    next = restData;
  } else {
    next = { ...data, [role]: rest };
  }
  if (Object.keys(next).length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    writeStored(next);
  }
  notifyUpdated();
}

const MAX_AVATAR_CHARS = 400_000;

export type SaveProfileInput = {
  name: string;
  email: string;
  avatarDataUrl: string | null;
  newPassword: string;
  confirmPassword: string;
};

export async function saveMockProfile(
  role: UserRole,
  input: SaveProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  const email = input.email.trim();
  if (!name) return { ok: false, error: "กรุณากรอกชื่อ" };
  if (!email) return { ok: false, error: "กรุณากรอกอีเมล" };

  const np = input.newPassword;
  const cp = input.confirmPassword;
  if (np || cp) {
    if (np.length < 8) return { ok: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" };
    if (np !== cp) return { ok: false, error: "รหัสผ่านยืนยันไม่ตรงกัน" };
  }

  if (input.avatarDataUrl && input.avatarDataUrl.length > MAX_AVATAR_CHARS) {
    return { ok: false, error: "รูปโปรไฟล์ใหญ่เกินไป ลองใช้ไฟล์ที่เล็กลง" };
  }

  const data = readStored();
  const prev = data[role] ?? {};
  const nextPatch: RoleProfilePatch = {
    ...prev,
    name,
    email,
  };

  if (input.avatarDataUrl === null) {
    delete nextPatch.avatarDataUrl;
  } else if (input.avatarDataUrl) {
    nextPatch.avatarDataUrl = input.avatarDataUrl;
  }

  if (np && cp) {
    nextPatch.passwordSha256Hex = await sha256Hex(np);
  }

  writeStored({ ...data, [role]: nextPatch });
  notifyUpdated();
  return { ok: true };
}
