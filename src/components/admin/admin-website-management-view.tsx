"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Customer, Website } from "@/types/models";
import { getHostname } from "@/lib/utils/url";
import { primarySiteUrl } from "@/lib/utils/website-urls";
import { WebsiteLogo } from "@/components/ui/website-logo";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { PageHeader } from "@/components/layout/page-header";
import { createWebsiteAction, renewWebsiteContractAction, updateWebsiteAction } from "@/app/admin/websites/actions";
import { ADMIN_ALERTS_CHANGED_EVENT } from "@/lib/admin-events";
import type { WebsiteAlertStats } from "@/lib/utils/website-alert-stats";
import { isContractExpiringWithinDays } from "@/lib/utils/website-alert-stats";
import { websitesUrlStateToSearchParams, type WebsitesUrlState } from "@/lib/utils/websites-page-url";

interface AdminWebsiteManagementViewProps {
  websites: Website[];
  customers: Customer[];
  /** true = ข้อมูลจาก Supabase, สร้าง/แก้ไขบันทึกลง DB */
  fromDatabase?: boolean;
  pageTitle?: string;
  subtitle?: string;
  /** จาก query string — bookmark ได้ */
  initialUrlState: WebsitesUrlState;
  /** แจ้งเตือนที่ยังไม่ปิดเรื่อง ต่อเว็บ */
  alertStatsByWebsiteId?: Record<string, WebsiteAlertStats>;
}

const formatThDate = (iso: string) =>
  new Date(iso).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });

const formatAlertShort = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** ค่าเริ่มต้นต่อสัญญา: +1 ปี จากวันหมดอายุปัจจุบัน หรือจากวันนี้ */
function defaultRenewalDate(currentYmd: string | null | undefined): string {
  const ymd = currentYmd?.trim().slice(0, 10) ?? "";
  const base =
    /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T12:00:00.000Z`) : new Date();
  const d = new Date(base.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const escapeCsv = (value: string) => {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

export const AdminWebsiteManagementView = ({
  websites: initialWebsites,
  customers,
  fromDatabase = false,
  pageTitle = "ข้อมูลเว็บไซต์",
  subtitle = "ตารางนี้ใช้สำหรับจัดการข้อมูลเว็บไซต์ของลูกค้า",
  initialUrlState,
  alertStatsByWebsiteId = {},
}: AdminWebsiteManagementViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const [query, setQuery] = useState(initialUrlState.q);
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">(initialUrlState.statusFilter);
  const [contractFilter, setContractFilter] = useState<"all" | "active" | "inactive">(initialUrlState.contractFilter);
  const [customerFilter, setCustomerFilter] = useState<string>(initialUrlState.customerFilter);
  const [providerFilter, setProviderFilter] = useState<string>(initialUrlState.providerFilter);
  const [sortBy, setSortBy] = useState<"name" | "createdAt" | "domain" | "expiry">(initialUrlState.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialUrlState.sortDir);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(initialUrlState.pageSize);
  const [expiringOnly, setExpiringOnly] = useState(initialUrlState.expiringOnly);

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [localSites, setLocalSites] = useState<Website[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Website>>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [detailSite, setDetailSite] = useState<Website | null>(null);
  const [editSite, setEditSite] = useState<Website | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [createWebsiteError, setCreateWebsiteError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [editWebsiteError, setEditWebsiteError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [renewSite, setRenewSite] = useState<Website | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [renewSaving, setRenewSaving] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [createIncludeFrontend, setCreateIncludeFrontend] = useState(true);
  const [createIncludeBackend, setCreateIncludeBackend] = useState(true);
  const [editIncludeFrontend, setEditIncludeFrontend] = useState(true);
  const [editIncludeBackend, setEditIncludeBackend] = useState(true);

  useEffect(() => {
    setQuery(initialUrlState.q);
    setStatusFilter(initialUrlState.statusFilter);
    setContractFilter(initialUrlState.contractFilter);
    setCustomerFilter(initialUrlState.customerFilter);
    setProviderFilter(initialUrlState.providerFilter);
    setSortBy(initialUrlState.sortBy);
    setSortDir(initialUrlState.sortDir);
    setPageSize(initialUrlState.pageSize);
    setExpiringOnly(initialUrlState.expiringOnly);
  }, [initialUrlState]);

  const replaceWebsitesUrl = useCallback(
    (s: WebsitesUrlState) => {
      const p = websitesUrlStateToSearchParams(s);
      const qs = p.toString();
      if (qs === searchParamsString) return;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      replaceWebsitesUrl({
        q: query.trim(),
        statusFilter,
        contractFilter,
        customerFilter,
        providerFilter,
        sortBy,
        sortDir,
        pageSize,
        expiringOnly,
      });
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce เฉพาะช่องค้นหา ไม่ต้อง re-run เมื่อตัวกรองอื่นเปลี่ยน
  }, [query, replaceWebsitesUrl]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!actionMenuId) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-row-menu]") || t.closest("[data-row-menu-trigger]")) return;
      setActionMenuId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [actionMenuId]);

  const customerName = useCallback(
    (id: string) => customers.find((c) => c.id === id)?.name ?? "—",
    [customers],
  );

  const allSites = useMemo(
    () => (fromDatabase ? initialWebsites : [...initialWebsites, ...localSites]),
    [fromDatabase, initialWebsites, localSites],
  );

  const mergedSites = useMemo(() => {
    if (fromDatabase) return allSites;
    return allSites.map((w) => ({ ...w, ...edits[w.id] }));
  }, [fromDatabase, allSites, edits]);

  const displaySummary = useMemo(() => {
    const total = mergedSites.length;
    const activeContract = mergedSites.filter((w) => w.contractStatus === "active").length;
    const inactiveContract = mergedSites.filter((w) => w.contractStatus === "inactive").length;
    return { total, activeContract, inactiveContract };
  }, [mergedSites]);

  const providerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const w of mergedSites) set.add(w.provider);
    return [...set].sort();
  }, [mergedSites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = mergedSites.filter((w) => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (contractFilter !== "all" && w.contractStatus !== contractFilter) return false;
      if (customerFilter !== "all" && w.customerId !== customerFilter) return false;
      if (providerFilter !== "all" && w.provider !== providerFilter) return false;
      if (expiringOnly && !isContractExpiringWithinDays(w.contractExpiryDate, w.contractStatus, 14)) return false;
      if (!q) return true;
      const primary = primarySiteUrl(w);
      const host = getHostname(primary).toLowerCase();
      const cust = customerName(w.customerId).toLowerCase();
      return (
        w.name.toLowerCase().includes(q) ||
        host.includes(q) ||
        (w.frontendUrl || "").toLowerCase().includes(q) ||
        (w.backendUrl || "").toLowerCase().includes(q) ||
        (w.contractExpiryDate ?? "").toLowerCase().includes(q) ||
        cust.includes(q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "th") * dir;
      if (sortBy === "domain")
        return getHostname(primarySiteUrl(a)).localeCompare(getHostname(primarySiteUrl(b)), "th") * dir;
      if (sortBy === "expiry") {
        const ta = a.contractExpiryDate ? new Date(a.contractExpiryDate).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.contractExpiryDate ? new Date(b.contractExpiryDate).getTime() : Number.POSITIVE_INFINITY;
        return (ta - tb) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
    return list;
  }, [
    mergedSites,
    query,
    statusFilter,
    contractFilter,
    customerFilter,
    providerFilter,
    expiringOnly,
    sortBy,
    sortDir,
    customerName,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startItem = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, filtered.length);

  const exportCsvRows = (list: Website[]) => {
    const headers = [
      "ชื่อเว็บไซต์",
      "โดเมน",
      "ลูกค้า",
      "สถานะเชื่อมต่อ",
      "สถานะ",
      "ผู้ให้บริการ",
      "ประเภทโฮสต์",
      "วันที่สร้าง",
      "หมดอายุสัญญา (เว็บ)",
      "แจ้งเตือนค้าง",
      "เหตุล่าสุด",
    ];
    const lines = [
      headers.join(","),
      ...list.map((w) => {
        const st = alertStatsByWebsiteId[w.id];
        return [
          escapeCsv(w.name),
          escapeCsv(getHostname(primarySiteUrl(w))),
          escapeCsv(customerName(w.customerId)),
          escapeCsv(w.status === "online" ? "ออนไลน์" : "ออฟไลน์"),
          escapeCsv(w.contractStatus === "active" ? "ใช้งาน" : "ไม่ใช้งาน"),
          escapeCsv(w.provider),
          escapeCsv(w.hostingType),
          escapeCsv(formatThDate(w.createdAt)),
          escapeCsv(w.contractExpiryDate ? formatThDate(`${w.contractExpiryDate}T00:00:00.000Z`) : "—"),
          escapeCsv(st && st.open > 0 ? String(st.open) : "0"),
          escapeCsv(st?.latestAt ? formatAlertShort(st.latestAt) : "—"),
        ].join(",");
      }),
    ];
    const blob = new Blob(["\ufeff", lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `websites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => exportCsvRows(filtered);

  const exportSelectedCsv = () => {
    const list = filtered.filter((w) => selectedIds.has(w.id));
    if (list.length === 0) return;
    exportCsvRows(list);
  };

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setContractFilter("all");
    setCustomerFilter("all");
    setProviderFilter("all");
    setSortBy("createdAt");
    setSortDir("desc");
    setPageSize(10);
    setExpiringOnly(false);
    setPage(1);
    setSelectedIds(new Set());
    replaceWebsitesUrl({
      q: "",
      statusFilter: "all",
      contractFilter: "all",
      customerFilter: "all",
      providerFilter: "all",
      sortBy: "createdAt",
      sortDir: "desc",
      pageSize: 10,
      expiringOnly: false,
    });
  };

  const [createForm, setCreateForm] = useState({
    name: "",
    frontendUrl: "",
    backendUrl: "",
    customerId: customers[0]?.id ?? "",
    provider: "Cloudflare",
    hostingType: "Cloud",
    status: "online" as Website["status"],
    contractStatus: "active" as Website["contractStatus"],
    contractExpiryDate: "",
  });

  const submitCreate = async () => {
    const name = createForm.name.trim();
    const fe = createForm.frontendUrl.trim();
    const be = createForm.backendUrl.trim();

    if (!name || !createForm.customerId) {
      const parts: string[] = [];
      if (!name) parts.push("ชื่อเว็บไซต์");
      if (!createForm.customerId) parts.push("ลูกค้า");
      setCreateWebsiteError(`กรุณากรอก: ${parts.join(" · ")}`);
      return;
    }
    if (!createIncludeFrontend && !createIncludeBackend) {
      setCreateWebsiteError("เลือกอย่างน้อยหนึ่ง URL: หน้าบ้านหรือหลังบ้าน");
      return;
    }
    if (createIncludeFrontend && !fe) {
      setCreateWebsiteError("กรุณากรอก URL หน้าบ้าน");
      return;
    }
    if (createIncludeBackend && !be) {
      setCreateWebsiteError("กรุณากรอก URL หลังบ้าน");
      return;
    }

    if (fromDatabase) {
      setCreateWebsiteError(null);
      setCreateSaving(true);
      const res = await createWebsiteAction({
        customerId: createForm.customerId,
        name,
        includeFrontend: createIncludeFrontend,
        includeBackend: createIncludeBackend,
        frontendUrl: createForm.frontendUrl,
        backendUrl: createForm.backendUrl,
        provider: createForm.provider,
        hostingType: createForm.hostingType,
        status: createForm.status,
        contractStatus: createForm.contractStatus,
        contractExpiryDate: createForm.contractExpiryDate.trim() || null,
      });
      setCreateSaving(false);
      if (!res.ok) {
        setCreateWebsiteError(res.message);
        return;
      }
      setCreateOpen(false);
      setCreateIncludeFrontend(true);
      setCreateIncludeBackend(true);
      setCreateForm({
        name: "",
        frontendUrl: "",
        backendUrl: "",
        customerId: customers[0]?.id ?? "",
        provider: "Cloudflare",
        hostingType: "Cloud",
        status: "online",
        contractStatus: "active",
        contractExpiryDate: "",
      });
      setPage(1);
      router.refresh();
      return;
    }

    const normFe = (s: string) => (s.startsWith("http") ? s : `https://${s}`);
    const nw: Website = {
      id: `local-${Date.now()}`,
      customerId: createForm.customerId,
      name,
      frontendUrl: createIncludeFrontend ? normFe(fe) : "",
      backendUrl: createIncludeBackend ? normFe(be) : "",
      provider: createForm.provider.trim() || "—",
      hostingType: createForm.hostingType.trim() || "—",
      status: createForm.status,
      contractStatus: createForm.contractStatus,
      contractExpiryDate: createForm.contractExpiryDate.trim() || null,
      createdAt: new Date().toISOString(),
      apiKeyMasked: "—",
    };
    setLocalSites((s) => [...s, nw]);
    setCreateOpen(false);
    setCreateIncludeFrontend(true);
    setCreateIncludeBackend(true);
    setCreateForm({
      name: "",
      frontendUrl: "",
      backendUrl: "",
      customerId: customers[0]?.id ?? "",
      provider: "Cloudflare",
      hostingType: "Cloud",
      status: "online",
      contractStatus: "active",
      contractExpiryDate: "",
    });
    setPage(1);
  };

  const [editForm, setEditForm] = useState<Partial<Website>>({});

  useEffect(() => {
    if (!editSite) return;
    setEditForm({ ...editSite });
    const fe = editSite.frontendUrl?.trim();
    const be = editSite.backendUrl?.trim();
    if (!fe && !be) {
      setEditIncludeFrontend(true);
      setEditIncludeBackend(true);
    } else {
      setEditIncludeFrontend(Boolean(fe));
      setEditIncludeBackend(Boolean(be));
    }
  }, [editSite]);

  const submitEdit = async () => {
    if (!editSite) return;

    const editName = (editForm.name ?? editSite.name).trim();
    const editFe = (editForm.frontendUrl ?? editSite.frontendUrl).trim();
    const editBe = (editForm.backendUrl ?? editSite.backendUrl).trim();

    if (!editName) {
      setEditWebsiteError("กรุณากรอกชื่อเว็บไซต์");
      return;
    }
    if (!editIncludeFrontend && !editIncludeBackend) {
      setEditWebsiteError("เลือกอย่างน้อยหนึ่ง URL: หน้าบ้านหรือหลังบ้าน");
      return;
    }
    if (editIncludeFrontend && !editFe) {
      setEditWebsiteError("กรุณากรอก URL หน้าบ้าน");
      return;
    }
    if (editIncludeBackend && !editBe) {
      setEditWebsiteError("กรุณากรอก URL หลังบ้าน");
      return;
    }

    if (fromDatabase) {
      setEditWebsiteError(null);
      setEditSaving(true);
      const res = await updateWebsiteAction({
        id: editSite.id,
        name: editForm.name?.trim() || editSite.name,
        includeFrontend: editIncludeFrontend,
        includeBackend: editIncludeBackend,
        frontendUrl: editForm.frontendUrl ?? editSite.frontendUrl,
        backendUrl: editForm.backendUrl ?? editSite.backendUrl,
        provider: editForm.provider?.trim() || editSite.provider,
        hostingType: editForm.hostingType?.trim() || editSite.hostingType,
        status: editForm.status ?? editSite.status,
        contractStatus: editForm.contractStatus ?? editSite.contractStatus,
        contractExpiryDate: (editForm.contractExpiryDate ?? editSite.contractExpiryDate ?? "").toString().trim() || null,
      });
      setEditSaving(false);
      if (!res.ok) {
        setEditWebsiteError(res.message);
        return;
      }
      setEditSite(null);
      setActionMenuId(null);
      router.refresh();
      return;
    }

    const normFe = (s: string) => (s.startsWith("http") ? s : `https://${s}`);
    setEdits((prev) => ({
      ...prev,
      [editSite.id]: {
        name: editForm.name?.trim() || editSite.name,
        frontendUrl: editIncludeFrontend ? normFe(editFe) : "",
        backendUrl: editIncludeBackend ? normFe(editBe) : "",
        provider: editForm.provider?.trim() || editSite.provider,
        hostingType: editForm.hostingType?.trim() || editSite.hostingType,
        status: editForm.status ?? editSite.status,
        contractStatus: editForm.contractStatus ?? editSite.contractStatus,
        contractExpiryDate:
          (editForm.contractExpiryDate ?? editSite.contractExpiryDate ?? "").toString().trim() || null,
      },
    }));
    setEditSite(null);
    setActionMenuId(null);
  };

  const submitRenew = async () => {
    if (!renewSite || !fromDatabase) return;
    setRenewError(null);
    setRenewSaving(true);
    const res = await renewWebsiteContractAction({
      websiteId: renewSite.id,
      newExpiryDate: renewDate,
    });
    setRenewSaving(false);
    if (!res.ok) {
      setRenewError(res.message);
      return;
    }
    setRenewSite(null);
    window.dispatchEvent(new CustomEvent(ADMIN_ALERTS_CHANGED_EVENT));
    router.refresh();
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((w) => selectedIds.has(w.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filtered.map((w) => w.id)));
  };

  const toggleRowSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Websites"
        title={pageTitle}
        subtitle={subtitle}
        crumbs={[{ href: "/admin/dashboard", label: "Admin" }, { label: "เว็บไซต์" }]}
        actions={
          <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="relative min-w-0 flex-1 basis-[200px] sm:flex-initial sm:basis-auto">
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
                placeholder="ค้นหาเว็บไซต์ โดเมน หรือลูกค้า…"
                className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2 sm:w-72"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateIncludeFrontend(true);
                setCreateIncludeBackend(true);
                setCreateWebsiteError(null);
                setCreateOpen(true);
              }}
              className="h-10 shrink-0 whitespace-nowrap rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              + สร้างเว็บไซต์
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              ส่งออก CSV ทั้งหมด
            </button>
            <button
              type="button"
              onClick={exportSelectedCsv}
              disabled={!someSelected}
              className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              ส่งออกเฉพาะที่เลือก
            </button>
            <Link
              href="/admin/monitor"
              className="h-10 inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Monitor
            </Link>
            <Link
              href="/admin/automation"
              className="h-10 inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Automation
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            const v = e.target.value as typeof statusFilter;
            setStatusFilter(v);
            setPage(1);
            replaceWebsitesUrl({
              q: query.trim(),
              statusFilter: v,
              contractFilter,
              customerFilter,
              providerFilter,
              sortBy,
              sortDir,
              pageSize,
              expiringOnly,
            });
          }}
          className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 min-w-[140px]"
          aria-label="กรองสถานะเชื่อมต่อ"
        >
          <option value="all">สถานะเชื่อมต่อทั้งหมด</option>
          <option value="online">ออนไลน์</option>
          <option value="offline">ออฟไลน์</option>
        </select>
        <select
          value={contractFilter}
          onChange={(e) => {
            const v = e.target.value as typeof contractFilter;
            setContractFilter(v);
            setPage(1);
            replaceWebsitesUrl({
              q: query.trim(),
              statusFilter,
              contractFilter: v,
              customerFilter,
              providerFilter,
              sortBy,
              sortDir,
              pageSize,
              expiringOnly,
            });
          }}
          className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 min-w-[140px]"
          aria-label="กรองสัญญา"
        >
          <option value="all">สัญญาทั้งหมด</option>
          <option value="active">สัญญาใช้งาน</option>
          <option value="inactive">ไม่ใช้งาน</option>
        </select>
        <select
          value={customerFilter}
          onChange={(e) => {
            const v = e.target.value;
            setCustomerFilter(v);
            setPage(1);
            replaceWebsitesUrl({
              q: query.trim(),
              statusFilter,
              contractFilter,
              customerFilter: v,
              providerFilter,
              sortBy,
              sortDir,
              pageSize,
              expiringOnly,
            });
          }}
          className="h-10 min-w-0 max-w-full shrink rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 sm:max-w-[240px]"
          aria-label="กรองลูกค้า"
        >
          <option value="all">ลูกค้าทั้งหมด</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={providerFilter}
          onChange={(e) => {
            const v = e.target.value;
            setProviderFilter(v);
            setPage(1);
            replaceWebsitesUrl({
              q: query.trim(),
              statusFilter,
              contractFilter,
              customerFilter,
              providerFilter: v,
              sortBy,
              sortDir,
              pageSize,
              expiringOnly,
            });
          }}
          className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2 min-w-[140px]"
          aria-label="กรองผู้ให้บริการ"
        >
          <option value="all">ผู้ให้บริการทั้งหมด</option>
          {providerOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => {
              const v = e.target.value as typeof sortBy;
              const dir = v === "createdAt" ? "desc" : "asc";
              setSortBy(v);
              setSortDir(dir);
              setPage(1);
              replaceWebsitesUrl({
                q: query.trim(),
                statusFilter,
                contractFilter,
                customerFilter,
                providerFilter,
                sortBy: v,
                sortDir: dir,
                pageSize,
                expiringOnly,
              });
            }}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            aria-label="เรียงตาม"
          >
            <option value="createdAt">เรียงตามวันที่สร้าง</option>
            <option value="expiry">เรียงตามหมดอายุสัญญา</option>
            <option value="name">เรียงตามชื่อ</option>
            <option value="domain">เรียงตามโดเมน</option>
          </select>
          <button
            type="button"
            onClick={() => {
              const next = sortDir === "asc" ? "desc" : "asc";
              setSortDir(next);
              replaceWebsitesUrl({
                q: query.trim(),
                statusFilter,
                contractFilter,
                customerFilter,
                providerFilter,
                sortBy,
                sortDir: next,
                pageSize,
                expiringOnly,
              });
            }}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title={sortDir === "asc" ? "จากน้อยไปมาก" : "จากมากไปน้อย"}
          >
            {sortDir === "asc" ? "↑ น้อย→มาก" : "↓ มาก→น้อย"}
          </button>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={(e) => {
                const v = e.target.checked;
                setExpiringOnly(v);
                setPage(1);
                replaceWebsitesUrl({
                  q: query.trim(),
                  statusFilter,
                  contractFilter,
                  customerFilter,
                  providerFilter,
                  sortBy,
                  sortDir,
                  pageSize,
                  expiringOnly: v,
                });
              }}
              className="h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
            />
            สัญญาใกล้หมด ≤14 วัน
          </label>
          <select
            value={pageSize}
            onChange={(e) => {
              const v = Number(e.target.value) as 10 | 25 | 50;
              setPageSize(v);
              setPage(1);
              replaceWebsitesUrl({
                q: query.trim(),
                statusFilter,
                contractFilter,
                customerFilter,
                providerFilter,
                sortBy,
                sortDir,
                pageSize: v,
                expiringOnly,
              });
            }}
            className="h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-indigo-500 focus:ring-2"
            aria-label="จำนวนต่อหน้า"
          >
            <option value={10}>10 ต่อหน้า</option>
            <option value={25}>25 ต่อหน้า</option>
            <option value={50}>50 ต่อหน้า</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="h-10 shrink-0 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:bg-white"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">เว็บไซต์ทั้งหมด</p>
            <p className="text-lg font-semibold text-slate-900">{displaySummary.total} รายการ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">สัญญาใช้งาน</p>
            <p className="text-lg font-semibold text-slate-900">{displaySummary.activeContract} รายการ</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800" aria-hidden>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-slate-500">สัญญาไม่ใช้งาน</p>
            <p className="text-lg font-semibold text-slate-900">{displaySummary.inactiveContract} รายการ</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="scrollbar-none overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold text-slate-600">
              <tr>
                <th className="w-10 px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allFilteredSelected;
                    }}
                    onChange={toggleSelectAllFiltered}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    aria-label="เลือกทั้งหมดตามตัวกรอง"
                  />
                </th>
                <th className="whitespace-nowrap px-4 py-3" title="ลำดับในตารางตามการเรียง/ตัวกรองปัจจุบัน ไม่ใช่รหัสจากฐานข้อมูล">
                  ลำดับ
                </th>
                <th className="whitespace-nowrap px-4 py-3">เชื่อมต่อ</th>
                <th className="whitespace-nowrap px-4 py-3">โลโก้</th>
                <th className="whitespace-nowrap px-4 py-3">ชื่อเว็บไซต์</th>
                <th className="whitespace-nowrap px-4 py-3">ลูกค้า</th>
                <th className="whitespace-nowrap px-4 py-3">โดเมน</th>
                <th className="whitespace-nowrap px-4 py-3">เชื่อมต่อจริง</th>
                <th className="whitespace-nowrap px-4 py-3">แจ้งเตือนค้าง</th>
                <th className="whitespace-nowrap px-4 py-3">เหตุล่าสุด</th>
                <th className="whitespace-nowrap px-4 py-3">วันที่สร้าง</th>
                <th className="whitespace-nowrap px-4 py-3" title="ใช้กับแดชบอร์ดและแผงต่ออายุ — ว่างได้">
                  หมดอายุสัญญา
                </th>
                <th className="whitespace-nowrap px-4 py-3">สถานะ</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-sm text-slate-500">
                    ไม่พบเว็บไซต์ตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRowSelected(row.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`เลือก ${row.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{(page - 1) * pageSize + index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        {primarySiteUrl(row) ? (
                          <a
                            href={primarySiteUrl(row)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex w-fit items-center justify-center rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                          >
                            เข้าสู่เว็บไซต์
                          </a>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-500">
                            ไม่มี URL
                          </span>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.frontendUrl.trim() ? (
                            <a
                              href={row.frontendUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
                            >
                              หน้าบ้าน
                            </a>
                          ) : null}
                          {row.backendUrl.trim() ? (
                            <a
                              href={row.backendUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
                            >
                              หลังบ้าน
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <WebsiteLogo
                        instanceId={row.id}
                        name={row.name}
                        frontendUrl={row.frontendUrl}
                        backendUrl={row.backendUrl}
                        logoUrl={row.logoUrl}
                        className="shadow-sm"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="max-w-[min(240px,28vw)] truncate px-4 py-3 text-slate-700" title={customerName(row.customerId)}>
                      <Link href={`/admin/customers`} className="text-indigo-700 hover:underline">
                        {customerName(row.customerId)}
                      </Link>
                    </td>
                    <td className="max-w-[min(320px,32vw)] truncate px-4 py-3 text-slate-600" title={primarySiteUrl(row) || undefined}>
                      {primarySiteUrl(row) ? getHostname(primarySiteUrl(row)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        label={row.status === "online" ? "ออนไลน์" : "ออฟไลน์"}
                        tone={row.status === "online" ? "success" : "danger"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const st = alertStatsByWebsiteId[row.id];
                        const open = st?.open ?? 0;
                        if (open === 0) {
                          return <span className="text-sm text-slate-400">—</span>;
                        }
                        const urgent = st && st.newCount > 0;
                        return (
                          <Link
                            href={`/admin/alerts?websiteId=${encodeURIComponent(row.id)}`}
                            className="inline-flex flex-wrap items-center gap-1.5"
                          >
                            <span
                              className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                urgent ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {open} ค้าง
                            </span>
                            <span className="text-xs font-semibold text-indigo-700 hover:underline">เปิด</span>
                          </Link>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatAlertShort(alertStatsByWebsiteId[row.id]?.latestAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatThDate(row.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600" title={row.contractExpiryDate ?? undefined}>
                      {row.contractExpiryDate ? formatThDate(`${row.contractExpiryDate}T00:00:00.000Z`) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-800">
                        <span
                          className={`h-2 w-2 rounded-full ${row.contractStatus === "active" ? "bg-indigo-500" : "bg-amber-500"}`}
                          aria-hidden
                        />
                        {row.contractStatus === "active" ? "ใช้งาน" : "ไม่ใช้งาน"}
                      </span>
                    </td>
                    <td className="relative px-2 py-3 text-center">
                      <button
                        type="button"
                        data-row-menu-trigger
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="เมนูการทำงาน"
                        aria-expanded={actionMenuId === row.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuId((id) => (id === row.id ? null : row.id));
                        }}
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {actionMenuId === row.id ? (
                        <div
                          data-row-menu
                          className="absolute right-2 top-full z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setDetailSite(row);
                              setActionMenuId(null);
                            }}
                          >
                            ดูรายละเอียด
                          </button>
                          {fromDatabase ? (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                              onClick={() => {
                                setRenewDate(defaultRenewalDate(row.contractExpiryDate));
                                setRenewError(null);
                                setRenewSite(row);
                                setActionMenuId(null);
                              }}
                            >
                              ต่อสัญญา
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => {
                              setEditSite(row);
                              setActionMenuId(null);
                            }}
                          >
                            {fromDatabase ? "แก้ไข" : "แก้ไข (จำลอง)"}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
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
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>

      <Modal
        title={fromDatabase ? "สร้างเว็บไซต์" : "สร้างเว็บไซต์ (จำลอง)"}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateWebsiteError(null);
        }}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อเว็บไซต์</label>
            <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น พอร์ทัลใหม่" />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="mb-2 text-[11px] font-medium text-slate-600">URL เว็บไซต์ — เลือกได้ว่าจะมีหน้าบ้าน หลังบ้าน หรือทั้งคู่ (อย่างน้อยหนึ่งรายการ)</p>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={createIncludeFrontend}
                onChange={(e) => setCreateIncludeFrontend(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              ระบุ URL หน้าบ้าน
            </label>
            <Input
              disabled={!createIncludeFrontend}
              value={createForm.frontendUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, frontendUrl: e.target.value }))}
              placeholder="https://example.com"
              className={!createIncludeFrontend ? "opacity-60" : undefined}
            />
            <label className="mb-2 mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={createIncludeBackend}
                onChange={(e) => setCreateIncludeBackend(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              ระบุ URL หลังบ้าน
            </label>
            <Input
              disabled={!createIncludeBackend}
              value={createForm.backendUrl}
              onChange={(e) => setCreateForm((f) => ({ ...f, backendUrl: e.target.value }))}
              placeholder="https://admin.example.com"
              className={!createIncludeBackend ? "opacity-60" : undefined}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">ลูกค้า</label>
            <select
              value={createForm.customerId}
              onChange={(e) => setCreateForm((f) => ({ ...f, customerId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring-2"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ผู้ให้บริการ</label>
              <Input value={createForm.provider} onChange={(e) => setCreateForm((f) => ({ ...f, provider: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ประเภทโฮสต์</label>
              <Input value={createForm.hostingType} onChange={(e) => setCreateForm((f) => ({ ...f, hostingType: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">สถานะเชื่อมต่อ</label>
              <select
                value={createForm.status}
                onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value as Website["status"] }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="online">ออนไลน์</option>
                <option value="offline">ออฟไลน์</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">สถานะ</label>
              <select
                value={createForm.contractStatus}
                onChange={(e) => setCreateForm((f) => ({ ...f, contractStatus: e.target.value as Website["contractStatus"] }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">หมดอายุสัญญา (เว็บ)</label>
            <input
              type="date"
              value={createForm.contractExpiryDate}
              onChange={(e) => setCreateForm((f) => ({ ...f, contractExpiryDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 focus:ring-2"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              ใช้กับแดชบอร์ด &quot;ใกล้หมดอายุ&quot; และแผงต่ออายุ — ว่างได้
            </p>
          </div>
          {createWebsiteError ? (
            <p className="text-sm text-rose-600" role="alert">
              {createWebsiteError}
            </p>
          ) : null}
          {customers.length === 0 && fromDatabase ? (
            <p className="text-sm text-amber-700">ยังไม่มีลูกค้าในระบบ — ไปเพิ่มที่เมนูลูกค้าก่อน</p>
          ) : null}
          <p className="text-xs text-slate-500">
            {fromDatabase
              ? "บันทึกลงฐานข้อมูล Supabase (ต้องล็อกอินและมีสิทธิ์ตาม RLS)"
              : "บันทึกเฉพาะในเบราว์เซอร์นี้ (รีเฟรชแล้วหาย)"}
          </p>
          <Button
            className="w-full"
            disabled={createSaving || (fromDatabase && customers.length === 0)}
            onClick={() => void submitCreate()}
          >
            {createSaving ? "กำลังสร้าง…" : "สร้าง"}
          </Button>
        </div>
      </Modal>

      <Modal title="รายละเอียดเว็บไซต์" open={!!detailSite} onClose={() => setDetailSite(null)}>
        {detailSite ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ชื่อ</dt>
              <dd className="font-medium text-slate-900">{detailSite.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ลูกค้า</dt>
              <dd className="text-slate-800">{customerName(detailSite.customerId)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">หน้าบ้าน</dt>
              <dd className="max-w-[60%] truncate text-right text-sm">
                {detailSite.frontendUrl.trim() ? (
                  <a href={detailSite.frontendUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                    {detailSite.frontendUrl}
                  </a>
                ) : (
                  <span className="text-slate-400">ไม่ระบุ</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">หลังบ้าน</dt>
              <dd className="max-w-[60%] truncate text-right text-sm">
                {detailSite.backendUrl.trim() ? (
                  <a href={detailSite.backendUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                    {detailSite.backendUrl}
                  </a>
                ) : (
                  <span className="text-slate-400">ไม่ระบุ</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">หมดอายุสัญญา</dt>
              <dd className="text-slate-800">
                {detailSite.contractExpiryDate
                  ? formatThDate(`${detailSite.contractExpiryDate}T00:00:00.000Z`)
                  : "ไม่ระบุ"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ผู้ให้บริการ</dt>
              <dd className="text-slate-800">{detailSite.provider}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">โฮสต์</dt>
              <dd className="text-slate-800">{detailSite.hostingType}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">สถานะ</dt>
              <dd>
                <StatusChip
                  label={detailSite.status === "online" ? "ออนไลน์" : "ออฟไลน์"}
                  tone={detailSite.status === "online" ? "success" : "danger"}
                />
              </dd>
            </div>
            {fromDatabase ? (
              <div className="border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    const s = detailSite;
                    setDetailSite(null);
                    setRenewDate(defaultRenewalDate(s.contractExpiryDate));
                    setRenewError(null);
                    setRenewSite(s);
                  }}
                >
                  ต่อสัญญา…
                </Button>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Modal>

      <Modal
        title={fromDatabase ? "แก้ไขเว็บไซต์" : "แก้ไขเว็บไซต์ (จำลอง)"}
        open={!!editSite}
        onClose={() => {
          setEditSite(null);
          setEditWebsiteError(null);
        }}
      >
        {editSite ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อเว็บไซต์</label>
              <Input value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <p className="mb-2 text-[11px] font-medium text-slate-600">URL — เลือกอย่างน้อยหนึ่งรายการ</p>
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={editIncludeFrontend}
                  onChange={(e) => setEditIncludeFrontend(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                ระบุ URL หน้าบ้าน
              </label>
              <Input
                disabled={!editIncludeFrontend}
                value={editForm.frontendUrl ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, frontendUrl: e.target.value }))}
                className={!editIncludeFrontend ? "opacity-60" : undefined}
              />
              <label className="mb-2 mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={editIncludeBackend}
                  onChange={(e) => setEditIncludeBackend(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                ระบุ URL หลังบ้าน
              </label>
              <Input
                disabled={!editIncludeBackend}
                value={editForm.backendUrl ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, backendUrl: e.target.value }))}
                className={!editIncludeBackend ? "opacity-60" : undefined}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">ผู้ให้บริการ</label>
                <Input value={editForm.provider ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, provider: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">ประเภทโฮสต์</label>
                <Input value={editForm.hostingType ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, hostingType: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">เชื่อมต่อ</label>
                <select
                  value={editForm.status ?? "online"}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as Website["status"] }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="online">ออนไลน์</option>
                  <option value="offline">ออฟไลน์</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">สถานะ</label>
                <select
                  value={editForm.contractStatus ?? "active"}
                  onChange={(e) => setEditForm((f) => ({ ...f, contractStatus: e.target.value as Website["contractStatus"] }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ไม่ใช้งาน</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">หมดอายุสัญญา (เว็บ)</label>
              <input
                type="date"
                value={(editForm.contractExpiryDate ?? editSite.contractExpiryDate ?? "").toString().slice(0, 10)}
                onChange={(e) => setEditForm((f) => ({ ...f, contractExpiryDate: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 focus:ring-2"
              />
            </div>
            {editWebsiteError ? (
              <p className="text-sm text-rose-600" role="alert">
                {editWebsiteError}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              {fromDatabase ? "บันทึกลงฐานข้อมูล Supabase" : "การแก้ไขเก็บในเซสชันนี้เท่านั้น"}
            </p>
            <Button className="w-full" disabled={editSaving} onClick={() => void submitEdit()}>
              {editSaving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="ต่อสัญญา"
        open={!!renewSite}
        onClose={() => {
          setRenewSite(null);
          setRenewError(null);
        }}
      >
        {renewSite ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              เว็บ <span className="font-semibold text-slate-900">{renewSite.name}</span> · ลูกค้า {customerName(renewSite.customerId)}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">วันหมดอายุสัญญาใหม่</label>
              <input
                type="date"
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-indigo-500 focus:ring-2"
              />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              ระบบจะตั้งสถานะสัญญาเป็น «ใช้งาน» สร้างแจ้งเตือนในระบบ และส่งข้อความไป Discord / LINE / Teams / Webhook ตามที่เปิดใช้ใน Integrations
            </p>
            {renewError ? (
              <p className="text-sm text-rose-600" role="alert">
                {renewError}
              </p>
            ) : null}
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={renewSaving} onClick={() => void submitRenew()}>
              {renewSaving ? "กำลังบันทึก…" : "ยืนยันต่อสัญญา"}
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
