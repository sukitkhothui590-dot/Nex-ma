"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer, ServiceSubscription, Website } from "@/types/models";
import { createCustomerAction } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { primarySiteUrl } from "@/lib/utils/website-urls";

export interface AdminCustomerManagementViewProps {
  customers: Customer[];
  websites: Website[];
  subscriptions: ServiceSubscription[];
  /** true = ข้อมูลจาก Supabase, เพิ่มลูกค้าบันทึกลง DB */
  fromDatabase?: boolean;
}

const pageSize = 10;

const serviceTypeLabel: Record<ServiceSubscription["serviceType"], string> = {
  domain: "โดเมน",
  hosting: "โฮสติ้ง",
  cloud: "คลาวด์",
  ma: "MA / ดูแล",
};

const formatThDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

export const AdminCustomerManagementView = ({
  customers: initialCustomers,
  websites,
  subscriptions,
  fromDatabase = false,
}: AdminCustomerManagementViewProps) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [localRows, setLocalRows] = useState<Customer[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "inactive">("active");
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const allCustomers = useMemo(
    () => (fromDatabase ? initialCustomers : [...initialCustomers, ...localRows]),
    [fromDatabase, initialCustomers, localRows],
  );

  const countsByCustomer = useMemo(() => {
    const map = new Map<string, { sites: number; subs: number }>();
    for (const c of allCustomers) {
      map.set(c.id, { sites: 0, subs: 0 });
    }
    for (const w of websites) {
      const cur = map.get(w.customerId);
      if (cur) cur.sites += 1;
    }
    for (const s of subscriptions) {
      const cur = map.get(s.customerId);
      if (cur) cur.subs += 1;
    }
    return map;
  }, [allCustomers, websites, subscriptions]);

  const summary = useMemo(() => {
    const total = allCustomers.length;
    const active = allCustomers.filter((c) => c.status === "active").length;
    const inactive = allCustomers.filter((c) => c.status === "inactive").length;
    return { total, active, inactive };
  }, [allCustomers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCustomers.filter((item) => {
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      if (!q) return statusOk;
      const textOk =
        item.name.toLowerCase().includes(q) ||
        item.contactEmail.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      return textOk && statusOk;
    });
  }, [allCustomers, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const startItem = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, filtered.length);

  const detailWebsites = useMemo(() => {
    if (!detailCustomer) return [];
    return websites.filter((w) => w.customerId === detailCustomer.id);
  }, [detailCustomer, websites]);

  const detailSubscriptions = useMemo(() => {
    if (!detailCustomer) return [];
    return subscriptions.filter((s) => s.customerId === detailCustomer.id);
  }, [detailCustomer, subscriptions]);

  const handleAddCustomer = async () => {
    const name = newName.trim();
    const email = newEmail.trim();
    if (!name || !email) return;

    if (fromDatabase) {
      setAddCustomerError(null);
      setAddSaving(true);
      const res = await createCustomerAction({ name, contactEmail: email, status: newStatus });
      setAddSaving(false);
      if (!res.ok) {
        setAddCustomerError(res.message);
        return;
      }
      setNewName("");
      setNewEmail("");
      setNewStatus("active");
      setOpenModal(false);
      setPage(1);
      router.refresh();
      return;
    }

    setLocalRows((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        name,
        contactEmail: email,
        status: newStatus,
      },
    ]);
    setNewName("");
    setNewEmail("");
    setNewStatus("active");
    setOpenModal(false);
    setPage(1);
  };

  return (
    <div className="page-shell">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0 shrink-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">ลูกค้า</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fromDatabase
              ? "รายชื่อลูกค้า การติดต่อ จำนวนเว็บไซต์และบริการ — ดึงจากฐานข้อมูล Supabase"
              : "รายชื่อลูกค้า การติดต่อ จำนวนเว็บไซต์และบริการ — ข้อมูลจำลองสำหรับ UX"}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-2 lg:w-auto lg:max-w-none lg:flex-nowrap lg:justify-end">
          <div className="relative min-w-0 flex-1 basis-[200px] lg:flex-initial lg:basis-auto">
            <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาชื่อ อีเมล หรือรหัส…"
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2 lg:w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              setPage(1);
            }}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 min-w-[152px]"
            aria-label="กรองตามสถานะ"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="active">ใช้งาน</option>
            <option value="inactive">ไม่ใช้งาน</option>
          </select>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="h-10 shrink-0 whitespace-nowrap rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            + เพิ่มลูกค้า
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">ลูกค้าทั้งหมด</p>
            <p className="text-lg font-semibold text-slate-900">{summary.total} รายการ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">ใช้งาน</p>
            <p className="text-lg font-semibold text-slate-900">{summary.active} รายการ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">ไม่ใช้งาน</p>
            <p className="text-lg font-semibold text-slate-900">{summary.inactive} รายการ</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="scrollbar-none overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">ลูกค้า</th>
                <th className="px-4 py-3">อีเมลติดต่อ</th>
                <th className="hidden px-4 py-3 sm:table-cell">เว็บไซต์</th>
                <th className="hidden px-4 py-3 md:table-cell">บริการ</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-right">การทำงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    ไม่พบลูกค้าตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { sites, subs } = countsByCustomer.get(row.id) ?? { sites: 0, subs: 0 };
                  return (
                    <tr key={row.id} className="transition hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailCustomer(row)}
                          className="text-left font-medium text-slate-900 hover:text-indigo-800 hover:underline"
                        >
                          {row.name}
                        </button>
                        <p className="text-xs text-slate-400 sm:hidden">{sites} เว็บ · {subs} บริการ</p>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={row.contactEmail}>
                        {row.contactEmail}
                      </td>
                      <td className="hidden px-4 py-3 tabular-nums text-slate-700 sm:table-cell">{sites}</td>
                      <td className="hidden px-4 py-3 tabular-nums text-slate-700 md:table-cell">{subs}</td>
                      <td className="px-4 py-3">
                        <StatusChip
                          label={row.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                          tone={row.status === "active" ? "success" : "neutral"}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailCustomer(row)}
                            className="text-xs font-semibold text-indigo-700 hover:underline"
                          >
                            รายละเอียด
                          </button>
                          <Link
                            href={`/admin/websites?q=${encodeURIComponent(row.name)}`}
                            className="text-xs font-semibold text-slate-600 hover:underline"
                          >
                            เว็บไซต์
                          </Link>
                          <a
                            href={`mailto:${row.contactEmail}`}
                            className="text-xs font-semibold text-slate-600 hover:underline"
                          >
                            อีเมล
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            แสดง {startItem}-{endItem} จาก {filtered.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      <Modal
        title="รายละเอียดลูกค้า"
        open={detailCustomer !== null}
        onClose={() => setDetailCustomer(null)}
        panelClassName="scrollbar-none max-w-2xl max-h-[min(90dvh,720px)] overflow-y-auto"
      >
        {detailCustomer ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-900">{detailCustomer.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="text-slate-400">รหัส:</span> {detailCustomer.id}
                  </p>
                </div>
                <StatusChip
                  label={detailCustomer.status === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                  tone={detailCustomer.status === "active" ? "success" : "neutral"}
                />
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-slate-500">อีเมลติดต่อ</dt>
                  <dd className="mt-0.5">
                    <a href={`mailto:${detailCustomer.contactEmail}`} className="font-medium text-indigo-700 hover:underline">
                      {detailCustomer.contactEmail}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">สรุป</dt>
                  <dd className="mt-0.5 tabular-nums text-slate-700">
                    {detailWebsites.length} เว็บไซต์ · {detailSubscriptions.length} บริการ
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/admin/websites?q=${encodeURIComponent(detailCustomer.name)}`}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  ดูเว็บไซต์ในระบบ
                </Link>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">เว็บไซต์ ({detailWebsites.length})</h3>
              {detailWebsites.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">ยังไม่มีเว็บไซต์ในระบบสำหรับลูกค้ารายนี้</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {detailWebsites.map((w) => (
                    <li key={w.id} className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{w.name}</p>
                        <p className="truncate text-xs text-slate-500">{primarySiteUrl(w) || "—"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusChip
                          label={w.status === "online" ? "ออนไลน์" : "ออฟไลน์"}
                          tone={w.status === "online" ? "success" : "danger"}
                        />
                        <StatusChip
                          label={w.contractStatus === "active" ? "สัญญาใช้งาน" : "สัญญาไม่ใช้งาน"}
                          tone={w.contractStatus === "active" ? "success" : "neutral"}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">บริการที่สมัคร ({detailSubscriptions.length})</h3>
              {detailSubscriptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">ไม่มีรายการบริการในระบบ</p>
              ) : (
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {detailSubscriptions.map((s) => (
                    <li key={s.id} className="flex flex-col gap-0.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-slate-800">{serviceTypeLabel[s.serviceType]}</span>
                      <span className="text-sm tabular-nums text-slate-600">หมดอายุ {formatThDate(s.expiryDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={fromDatabase ? "เพิ่มลูกค้า" : "เพิ่มลูกค้า (จำลอง)"}
        open={openModal}
        onClose={() => {
          setOpenModal(false);
          setAddCustomerError(null);
        }}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="cust-name" className="mb-1 block text-xs font-medium text-slate-600">
              ชื่อลูกค้า
            </label>
            <Input id="cust-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น บริษัท ตัวอย่าง จำกัด" />
          </div>
          <div>
            <label htmlFor="cust-email" className="mb-1 block text-xs font-medium text-slate-600">
              อีเมลติดต่อ
            </label>
            <Input
              id="cust-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>
          <div>
            <label htmlFor="cust-status" className="mb-1 block text-xs font-medium text-slate-600">
              สถานะ
            </label>
            <Select
              id="cust-status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as "active" | "inactive")}
              className="rounded-xl border-slate-200"
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </Select>
          </div>
          {addCustomerError ? (
            <p className="text-sm text-rose-600" role="alert">
              {addCustomerError}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">
            {fromDatabase
              ? "บันทึกลงฐานข้อมูล Supabase (ต้องล็อกอินและมีสิทธิ์ตาม RLS)"
              : "บันทึกเฉพาะในเซสชันเบราว์เซอร์นี้ (รีเฟรชแล้วหาย)"}
          </p>
          <Button className="w-full" disabled={addSaving} onClick={() => void handleAddCustomer()}>
            {addSaving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
