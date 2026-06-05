import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Flag,
  Loader2,
  Search,
  Ban,
  Trash2,
  ExternalLink,
} from "lucide-react";
import reportService, {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
} from "../services/reportService";
import adminService from "../services/adminService";
import pageService from "../services/pageService";
import type { Report, ReportStatus } from "../types/models";
import { buildS3Url } from "../utils/s3";

const STATUS_TABS: { value: ReportStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "RESOLVED", label: "Đã xử lý" },
  { value: "DISMISSED", label: "Đã bỏ qua" },
];

const statusBadge: Record<ReportStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DISMISSED: "bg-slate-100 text-slate-600 ring-slate-200",
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString("vi-VN") +
      " " +
      d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "—";
  }
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ReportStatus | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [live, setLive] = useState(false);
  const [detail, setDetail] = useState<Report | null>(null);

  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await reportService.getReports(
        tab === "all" ? undefined : tab,
      );
      setReports(data);
    } catch {
      toast.error("Không tải được danh sách báo cáo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Realtime: lắng nghe báo cáo mới / cập nhật qua SSE
  useEffect(() => {
    const es = new EventSource("/api/admin/reports/stream", {
      withCredentials: true,
    });

    es.addEventListener("connected", () => setLive(true));
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);

    // Báo cáo mới được gửi tới
    es.addEventListener("report", (e) => {
      try {
        const r = JSON.parse((e as MessageEvent).data) as Report;
        const activeTab = tabRef.current;
        // Báo cáo mới luôn ở trạng thái PENDING
        if (activeTab !== "all" && activeTab !== "PENDING") return;
        setReports((prev) =>
          prev.some((p) => p.id === r.id) ? prev : [r, ...prev],
        );
        toast("🚩 Có báo cáo mới", { duration: 3000 });
      } catch {
        /* bỏ qua bản ghi lỗi định dạng */
      }
    });

    // Báo cáo được xử lý ở nơi khác -> đồng bộ trạng thái
    es.addEventListener("report-updated", (e) => {
      try {
        const r = JSON.parse((e as MessageEvent).data) as Report;
        const activeTab = tabRef.current;
        setReports((prev) => {
          const exists = prev.some((p) => p.id === r.id);
          // Nếu không còn khớp tab hiện tại thì loại khỏi danh sách
          if (activeTab !== "all" && r.status !== activeTab) {
            return prev.filter((p) => p.id !== r.id);
          }
          if (exists) return prev.map((p) => (p.id === r.id ? r : p));
          return [r, ...prev];
        });
        setDetail((d) => (d && d.id === r.id ? r : d));
      } catch {
        /* ignore */
      }
    });

    return () => es.close();
  }, []);

  const stats = useMemo(
    () => ({
      total: reports.length,
      pending: reports.filter((r) => r.status === "PENDING").length,
      resolved: reports.filter((r) => r.status === "RESOLVED").length,
      dismissed: reports.filter((r) => r.status === "DISMISSED").length,
    }),
    [reports],
  );

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return reports;
    return reports.filter((r) =>
      [
        r.targetName,
        r.reporterName,
        REPORT_REASON_LABELS[r.reason],
        r.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(k),
    );
  }, [reports, keyword]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Flag className="text-rose-500" size={24} />
            Quản lý báo cáo
          </h1>
          <p className="text-sm text-slate-500">
            Tiếp nhận và xử lý báo cáo từ người dùng về tài khoản và trang.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            live
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`}
          />
          {live ? "Realtime" : "Ngoại tuyến"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Tổng (đang xem)"
          value={stats.total}
          icon={AlertCircle}
          color="text-slate-600"
        />
        <StatTile
          label="Chờ xử lý"
          value={stats.pending}
          icon={Flag}
          color="text-amber-600"
        />
        <StatTile
          label="Đã xử lý"
          value={stats.resolved}
          icon={CheckCircle2}
          color="text-emerald-600"
        />
        <StatTile
          label="Đã bỏ qua"
          value={stats.dismissed}
          icon={XCircle}
          color="text-slate-500"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.value
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo đối tượng, người báo cáo, lý do..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-80"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Không có báo cáo nào.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Đối tượng</th>
                <th className="px-4 py-3 font-semibold">Lý do</th>
                <th className="px-4 py-3 font-semibold">Người báo cáo</th>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {r.targetAvatarUrl ? (
                        <img
                          src={buildS3Url(r.targetAvatarUrl) || undefined}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          {r.targetType === "PAGE" ? "P" : "U"}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-800">
                          {r.targetName || `#${r.targetId}`}
                        </p>
                        <span className="text-xs text-slate-400">
                          {r.targetType === "PAGE" ? "Trang" : "Tài khoản"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                      {REPORT_REASON_LABELS[r.reason]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.reporterName || `#${r.reporterId}`}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(r.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadge[r.status]}`}
                    >
                      {REPORT_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDetail(r)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Xem & xử lý
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detail && (
        <ReportDetailModal
          report={detail}
          onClose={() => setDetail(null)}
          onUpdated={(r) => {
            setReports((prev) => {
              if (tab !== "all" && r.status !== tab)
                return prev.filter((p) => p.id !== r.id);
              return prev.map((p) => (p.id === r.id ? r : p));
            });
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Flag;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <Icon size={18} className={color} />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal chi tiết + xử lý báo cáo                                      */
/* ------------------------------------------------------------------ */

function ReportDetailModal({
  report,
  onClose,
  onUpdated,
}: {
  report: Report;
  onClose: () => void;
  onUpdated: (r: Report) => void;
}) {
  const [note, setNote] = useState(report.adminNote || "");
  const [busy, setBusy] = useState(false);
  const isPending = report.status === "PENDING";

  const handle = async (status: "RESOLVED" | "DISMISSED") => {
    setBusy(true);
    try {
      const updated = await reportService.handleReport(
        report.id,
        status,
        note.trim() || undefined,
      );
      toast.success(
        status === "RESOLVED" ? "Đã đánh dấu xử lý" : "Đã bỏ qua báo cáo",
      );
      onUpdated(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không thể xử lý báo cáo");
    } finally {
      setBusy(false);
    }
  };

  // Hành động trực tiếp lên đối tượng, sau đó tự đánh dấu báo cáo là đã xử lý
  const takeAction = async () => {
    setBusy(true);
    try {
      if (report.targetType === "USER") {
        await adminService.lockUser(
          report.targetId,
          `Vi phạm bị báo cáo: ${REPORT_REASON_LABELS[report.reason]}`,
        );
        toast.success("Đã khoá tài khoản bị báo cáo");
      } else {
        await pageService.deletePage(report.targetId);
        toast.success("Đã xoá trang bị báo cáo");
      }
      const actionNote =
        (note.trim() ? note.trim() + " — " : "") +
        (report.targetType === "USER" ? "Đã khoá tài khoản." : "Đã xoá trang.");
      const updated = await reportService.handleReport(
        report.id,
        "RESOLVED",
        actionNote,
      );
      onUpdated(updated);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Không thực hiện được hành động",
      );
    } finally {
      setBusy(false);
    }
  };

  const targetPath =
    report.targetType === "PAGE" ? `/pages/${report.targetId}` : `/users`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Flag size={18} className="text-rose-500" />
            Chi tiết báo cáo #{report.id}
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-600"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {/* Target */}
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            {report.targetAvatarUrl ? (
              <img
                src={buildS3Url(report.targetAvatarUrl) || undefined}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                {report.targetType === "PAGE" ? "P" : "U"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800">
                {report.targetName || `#${report.targetId}`}
              </p>
              <p className="text-xs text-slate-500">
                {report.targetType === "PAGE" ? "Trang" : "Tài khoản"} · ID{" "}
                {report.targetId}
              </p>
            </div>
            <a
              href={targetPath}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-white"
            >
              <ExternalLink size={13} /> Xem
            </a>
          </div>

          <Field label="Lý do">
            <span className="rounded-md bg-rose-50 px-2 py-0.5 text-sm font-medium text-rose-600">
              {REPORT_REASON_LABELS[report.reason]}
            </span>
          </Field>

          {report.description && (
            <Field label="Mô tả từ người báo cáo">
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                {report.description}
              </p>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Người báo cáo">
              <p className="text-sm text-slate-700">
                {report.reporterName || `#${report.reporterId}`}
              </p>
            </Field>
            <Field label="Thời gian">
              <p className="text-sm text-slate-700">
                {formatDate(report.createdAt)}
              </p>
            </Field>
          </div>

          {!isPending && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-700">
                Đã {report.status === "RESOLVED" ? "xử lý" : "bỏ qua"} bởi{" "}
                {report.handledByName || "Admin"}
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(report.handledAt)}
              </p>
              {report.adminNote && (
                <p className="mt-1 text-slate-600">
                  Ghi chú: {report.adminNote}
                </p>
              )}
            </div>
          )}

          {isPending && (
            <Field label="Ghi chú xử lý (tuỳ chọn)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Ghi lại quyết định / lý do xử lý..."
                className="w-full resize-none rounded-lg border border-slate-200 p-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </Field>
          )}
        </div>

        {isPending && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
            <button
              onClick={takeAction}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {report.targetType === "USER" ? (
                <Ban size={15} />
              ) : (
                <Trash2 size={15} />
              )}
              {report.targetType === "USER" ? "Khoá tài khoản" : "Xoá trang"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handle("DISMISSED")}
                disabled={busy}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Bỏ qua
              </button>
              <button
                onClick={() => handle("RESOLVED")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Đánh dấu đã xử lý
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}
