"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  clearMockPassword,
  getEffectiveProfile,
  getStoredPasswordHash,
  saveMockProfile,
} from "@/lib/services/mock-user-profile";
import type { UserRole } from "@/types/models";

type Props = {
  role: UserRole;
  open: boolean;
  onClose: () => void;
};

export const UserProfileSettingsModal = ({ role, open, onClose }: Props) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasCustomPassword, setHasCustomPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    const p = getEffectiveProfile(role);
    setName(p.name);
    setEmail(p.email);
    setAvatarDataUrl(p.avatarDataUrl);
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setHasCustomPassword(!!getStoredPasswordHash(role));
  }, [open, role]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  const onPickFile = (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return;
      if (result.length > 400_000) {
        setError("รูปใหญ่เกินไป ลองบีบอัดหรือใช้ขนาดเล็กลง");
        return;
      }
      setAvatarDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await saveMockProfile(role, {
        name,
        email,
        avatarDataUrl,
        newPassword,
        confirmPassword,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setHasCustomPassword(!!getStoredPasswordHash(role));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    void onSubmit(e);
  };

  return (
    <Modal
      title="แก้ไขโปรไฟล์"
      open={open}
      onClose={onClose}
      panelClassName="max-w-xl max-h-[min(90dvh,720px)] overflow-y-auto"
    >
      <form onSubmit={handleFormSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            {avatarDataUrl ? (
              <Image
                src={avatarDataUrl}
                alt=""
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-600 to-indigo-700 text-3xl font-bold text-white">
                {initial}
              </div>
            )}
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
            <label className="text-sm font-medium text-slate-700">รูปโปรไฟล์</label>
            <Input
              type="file"
              accept="image/*"
              className="cursor-pointer border-slate-300 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-800"
              onChange={(ev) => onPickFile(ev.target.files?.[0] ?? null)}
            />
            {avatarDataUrl ? (
              <Button type="button" variant="secondary" className="w-fit border-slate-200" onClick={() => setAvatarDataUrl(null)}>
                ลบรูป (ใช้ตัวอักษรแทน)
              </Button>
            ) : null}
            <p className="text-xs text-slate-500">เก็บในเบราว์เซอร์เท่านั้น (โหมดจำลอง) — เมื่อเชื่อม Auth จริงจะอัปโหลดไปยังเซิร์ฟเวอร์</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label htmlFor={`profile-name-${role}`} className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อที่แสดง
            </label>
            <Input
              id={`profile-name-${role}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-slate-300"
              autoComplete="name"
            />
          </div>
          <div className="sm:col-span-1">
            <label htmlFor={`profile-email-${role}`} className="mb-1 block text-sm font-medium text-slate-700">
              อีเมล
            </label>
            <Input
              id={`profile-email-${role}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-slate-300"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-900">เปลี่ยนรหัสผ่าน (จำลอง)</p>
          <p className="mt-1 text-xs text-slate-500">
            ถ้ากรอกรหัสใหม่ ระบบจะบันทึกแบบเข้ารหัสในเครื่องคุณ และหน้าเข้าสู่ระบบจะตรวจรหัสตามที่ตั้งไว้สำหรับบทบาทนี้
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`profile-np-${role}`} className="mb-1 block text-xs font-medium text-slate-600">
                รหัสผ่านใหม่
              </label>
              <Input
                id={`profile-np-${role}`}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="border-slate-300"
                autoComplete="new-password"
                placeholder="เว้นว่างถ้าไม่เปลี่ยน"
              />
            </div>
            <div>
              <label htmlFor={`profile-cp-${role}`} className="mb-1 block text-xs font-medium text-slate-600">
                ยืนยันรหัสผ่าน
              </label>
              <Input
                id={`profile-cp-${role}`}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-slate-300"
                autoComplete="new-password"
                placeholder="เว้นว่างถ้าไม่เปลี่ยน"
              />
            </div>
          </div>
          {hasCustomPassword ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="border-slate-200 text-xs"
                onClick={() => {
                  clearMockPassword(role);
                  setHasCustomPassword(false);
                }}
              >
                รีเซ็ตรหัสผ่านจำลอง (เข้าได้ด้วยรหัสใดก็ได้เหมือนเดิม)
              </Button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" className="border-slate-200" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="submit" disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
