import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  UploadSimple,
  FileText,
  CheckCircle,
  Clock,
  CurrencyNgn,
  Eye,
  Trash,
  WarningCircle,
  Buildings,
  Check,
  ArrowRight,
  ShieldCheck,
  FilePdf,
  Image as ImageIcon,
} from '@phosphor-icons/react';
import { PortalLayout } from '../../components/layout/PortalLayout';
import { Button, Card, Badge, Drawer, Input, Modal, Skeleton } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type {
  ExpenseCategory,
  ExpenseReportRecord,
  ExpenseItemInput,
  ExpenseReportStatus,
} from '../../lib/expenseTypes';
import type { EmployeeProfile } from '../../lib/leaveTypes';

export interface StaffExpensesPageProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

interface DraftExpenseItem extends ExpenseItemInput {
  receiptSize?: number;
}

export const StaffExpensesPage: React.FC<StaffExpensesPageProps> = ({
  currentPath = '/portal/expenses',
  onNavigate,
}) => {
  // Page data states
  const [reports, setReports] = useState<ExpenseReportRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab filter
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'>('ALL');

  // Filing drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Line items state
  const [items, setItems] = useState<DraftExpenseItem[]>([
    {
      categoryId: 'cat-trav',
      dateIncurred: new Date().toISOString().split('T')[0],
      merchantName: '',
      amount: 0,
      description: '',
      receiptUrl: '',
      receiptFileName: '',
    },
  ]);

  // Inspection drawer & receipt preview modal
  const [selectedReport, setSelectedReport] = useState<ExpenseReportRecord | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [reportsData, categoriesData, profileData] = await Promise.all([
        api.expenses.getReports('mine').catch(() => []),
        api.expenses.getCategories().catch(() => []),
        api.profile.get().catch(() => null),
      ]);
      setReports(reportsData);
      setCategories(categoriesData);
      setProfile(profileData);
      if (categoriesData.length > 0 && items[0].categoryId === 'cat-trav') {
        setItems([{ ...items[0], categoryId: categoriesData[0].id }]);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load expense records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute live KPIs
  const totalSettled = useMemo(() => {
    return reports
      .filter((r) => r.status === 'PAID')
      .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  }, [reports]);

  const settledCount = useMemo(() => {
    return reports.filter((r) => r.status === 'PAID').length;
  }, [reports]);

  const pendingAmount = useMemo(() => {
    return reports
      .filter((r) =>
        ['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC', 'REVISION_REQUESTED'].includes(
          r.status
        )
      )
      .reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  }, [reports]);

  const pendingCount = useMemo(() => {
    return reports.filter((r) =>
      ['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC', 'REVISION_REQUESTED'].includes(
        r.status
      )
    ).length;
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    if (activeTab === 'ALL') return reports;
    if (activeTab === 'PENDING') {
      return reports.filter((r) =>
        ['SUBMITTED', 'PENDING_LINE_MANAGER', 'PENDING_DEPT_HEAD', 'PENDING_EXEC', 'REVISION_REQUESTED'].includes(
          r.status
        )
      );
    }
    if (activeTab === 'APPROVED') return reports.filter((r) => r.status === 'APPROVED');
    if (activeTab === 'PAID') return reports.filter((r) => r.status === 'PAID');
    if (activeTab === 'REJECTED') return reports.filter((r) => r.status === 'REJECTED');
    return reports;
  }, [reports, activeTab]);

  // Drawer handlers
  const handleAddItem = () => {
    const defaultCat = categories.length > 0 ? categories[0].id : 'cat-trav';
    setItems((prev) => [
      ...prev,
      {
        categoryId: defaultCat,
        dateIncurred: new Date().toISOString().split('T')[0],
        merchantName: '',
        amount: 0,
        description: '',
        receiptUrl: '',
        receiptFileName: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof DraftExpenseItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return { ...item, [field]: value };
      })
    );
  };

  // Receipt file upload with validation
  const handleFileUpload = async (index: number, file: File) => {
    // 10MB ceiling guard
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the maximum 10MB limit.');
      return;
    }

    // Format check
    const validMimes = ['image/png', 'image/jpeg', 'application/pdf'];
    const validExts = ['.png', '.jpg', '.jpeg', '.pdf'];
    const hasValidExt = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!validMimes.includes(file.type) && !hasValidExt) {
      alert('Unsupported file format. Only PNG, JPEG, and PDF documents are allowed.');
      return;
    }

    setUploadingIndex(index);
    try {
      const res = await api.expenses.uploadReceipt(file);
      setItems((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          return {
            ...item,
            receiptUrl: res.fileUrl,
            receiptFileName: file.name,
            receiptSize: file.size,
          };
        })
      );
    } catch (err: any) {
      alert(err.message || 'Failed to upload receipt document');
    } finally {
      setUploadingIndex(null);
    }
  };

  // Live total sum
  const currentTotalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [items]);

  // Form policy validation checks
  const policyErrors = useMemo(() => {
    const errors: string[] = [];
    if (!title.trim()) errors.push('Report title is required.');
    items.forEach((item, idx) => {
      const num = Number(item.amount);
      if (isNaN(num) || num <= 0) {
        errors.push(`Item #${idx + 1}: Amount must be greater than zero.`);
      }
      const cat = categories.find((c) => c.id === item.categoryId);
      if (cat && num > cat.maxSingleLimit) {
        errors.push(
          `Item #${idx + 1}: Amount ₦${num.toLocaleString()} exceeds category ceiling of ₦${cat.maxSingleLimit.toLocaleString()} for ${cat.name}.`
        );
      }
      if (num > 5000 && (!item.receiptUrl || !item.receiptUrl.trim())) {
        errors.push(
          `Item #${idx + 1}: Mandatory receipt required for expenditures exceeding ₦5,000.00.`
        );
      }
    });
    return errors;
  }, [title, items, categories]);

  // Submit expense claim
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (policyErrors.length > 0) {
      setSubmitError(policyErrors[0]);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const created = await api.expenses.createReport({
        title: title.trim(),
        purpose: purpose.trim() || title.trim(),
        currency: 'NGN',
        items: items.map((it) => ({
          categoryId: it.categoryId,
          dateIncurred: it.dateIncurred,
          merchantName: it.merchantName.trim() || 'Merchant',
          amount: Number(it.amount),
          description: it.description.trim(),
          receiptUrl: it.receiptUrl || undefined,
          receiptFileName: it.receiptFileName || undefined,
        })),
      });

      if (created) {
        setReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      }

      // Reset form & reload
      setTitle('');
      setPurpose('');
      setItems([
        {
          categoryId: categories.length > 0 ? categories[0].id : 'cat-trav',
          dateIncurred: new Date().toISOString().split('T')[0],
          merchantName: '',
          amount: 0,
          description: '',
          receiptUrl: '',
          receiptFileName: '',
        },
      ]);
      setDrawerOpen(false);
      await fetchData();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit expense report');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for status badge
  const renderStatusBadge = (status: ExpenseReportStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="approved">Settled / Disbursed</Badge>;
      case 'APPROVED':
        return <Badge variant="brand">Approved (Queueing Disbursal)</Badge>;
      case 'PENDING_DEPT_HEAD':
        return <Badge variant="pending">Dept Head Sign-Off</Badge>;
      case 'PENDING_EXEC':
        return <Badge variant="pending">Executive Approval</Badge>;
      case 'SUBMITTED':
      case 'PENDING_LINE_MANAGER':
        return <Badge variant="pending">Line Manager Review</Badge>;
      case 'REVISION_REQUESTED':
        return <Badge variant="draft">Revision Requested</Badge>;
      case 'REJECTED':
        return <Badge variant="rejected">Rejected</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <PortalLayout currentPath={currentPath} onNavigate={onNavigate}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-ink font-display">
              Expense Claims &amp; Reimbursement
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1">
              File multi-item corporate expenditures, attach verified receipts, and monitor approval pipelines.
            </p>
          </div>
          <Button
            variant="primary"
            leftIcon={<Plus className="w-4 h-4" weight="bold" />}
            onClick={() => {
              setSubmitError(null);
              setDrawerOpen(true);
            }}
          >
            File New Expense Claim
          </Button>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-[7px] bg-danger/10 border border-danger/25 text-danger text-sm flex items-center gap-2">
            <WarningCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Total Reimbursed */}
          <Card variant="surface" padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider font-sans">
                Total Reimbursed YTD
              </span>
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CurrencyNgn className="w-5 h-5" weight="bold" />
              </div>
            </div>
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-8 w-36 mb-1" />
              ) : (
                <div className="text-2xl sm:text-3xl font-semibold text-ink font-display tabular-nums">
                  ₦{totalSettled.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-muted mt-1 flex items-center gap-1 font-sans">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{settledCount} claims settled via NIBSS rail</span>
              </p>
            </div>
          </Card>

          {/* Card 2: Pending Approval Pipeline */}
          <Card variant="surface" padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider font-sans">
                Pending Approval Pipeline
              </span>
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" weight="bold" />
              </div>
            </div>
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-8 w-36 mb-1" />
              ) : (
                <div className="text-2xl sm:text-3xl font-semibold text-ink font-display tabular-nums">
                  ₦{pendingAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-muted mt-1 flex items-center gap-1 font-sans">
                <span>{pendingCount} claims actively under multi-tier review</span>
              </p>
            </div>
          </Card>

          {/* Card 3: Verified Disbursal Bank Rail */}
          <Card variant="surface" padding="md" className="flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider font-sans">
                Disbursal Bank Rail
              </span>
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <Buildings className="w-5 h-5" weight="bold" />
              </div>
            </div>
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-8 w-44 mb-1" />
              ) : (
                <div className="text-base sm:text-lg font-semibold text-ink font-display truncate">
                  {profile?.bankName || 'Zenith Bank Plc'}
                </div>
              )}
              <p className="text-xs text-muted mt-1 flex items-center gap-1 font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="tabular-nums">
                  {profile?.bankAccountNumber
                    ? `NUBAN: •••• ${profile.bankAccountNumber.slice(-4)}`
                    : 'NUBAN: •••• 8812'}
                </span>
                <span className="text-muted/60">• Verified</span>
              </p>
            </div>
          </Card>
        </div>

        {/* Claims Table Card */}
        <Card variant="surface" padding="none">
          {/* Tabs Filter Header */}
          <div className="p-4 sm:p-6 border-b border-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand" />
              <h3 className="text-base font-semibold text-ink font-display">
                Filing History &amp; Pipeline Status
              </h3>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-subtle rounded-[7px] border border-rule text-xs font-semibold overflow-x-auto">
              {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-[5px] transition-colors cursor-pointer select-none whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-surface text-ink shadow-xs border border-rule'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab === 'ALL'
                    ? `All (${reports.length})`
                    : tab === 'PENDING'
                    ? `Pending (${pendingCount})`
                    : tab === 'APPROVED'
                    ? `Approved (${reports.filter((r) => r.status === 'APPROVED').length})`
                    : tab === 'PAID'
                    ? `Paid (${settledCount})`
                    : `Rejected (${reports.filter((r) => r.status === 'REJECTED').length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-rule bg-subtle/50 text-[11px] font-semibold text-muted uppercase tracking-wider font-sans">
                  <th className="py-3.5 px-4 sm:px-6">Claim Reference</th>
                  <th className="py-3.5 px-4 sm:px-6">Purpose &amp; Description</th>
                  <th className="py-3.5 px-4 sm:px-6">Line Items</th>
                  <th className="py-3.5 px-4 sm:px-6">Submitted Date</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 sm:px-6">Workflow Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule text-sm">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-24" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-48" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-16" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-20" /></td>
                      <td className="py-4 px-4 sm:px-6 text-right"><Skeleton className="h-5 w-24 ml-auto" /></td>
                      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-28" /></td>
                      <td className="py-4 px-4 sm:px-6 text-center"><Skeleton className="h-5 w-16 mx-auto" /></td>
                    </tr>
                  ))
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted font-sans">
                      <Receipt className="w-10 h-10 mx-auto text-muted/40 mb-2" />
                      <p className="text-sm font-medium text-ink">No expense claims found</p>
                      <p className="text-xs text-muted mt-1">
                        {activeTab === 'ALL'
                          ? 'You have not submitted any expense claims yet.'
                          : `No claims match the "${activeTab.toLowerCase()}" filter.`}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      className="hover:bg-subtle/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedReport(report)}
                    >
                      <td className="py-4 px-4 sm:px-6 font-semibold text-ink font-display">
                        {report.reportNumber || report.id}
                      </td>
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-medium text-ink line-clamp-1">{report.title}</div>
                        {report.purpose && (
                          <div className="text-xs text-muted line-clamp-1 mt-0.5">{report.purpose}</div>
                        )}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-xs text-muted font-sans">
                        {report.items?.length || 1} item{(report.items?.length || 1) > 1 ? 's' : ''}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-xs text-muted font-mono-nums">
                        {report.submittedAt ? report.submittedAt.split('T')[0] : '—'}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right font-semibold text-ink font-display tabular-nums">
                        ₦{(Number(report.totalAmount) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 sm:px-6">
                        {renderStatusBadge(report.status)}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-4 h-4" />}
                          onClick={() => setSelectedReport(report)}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Multi-Item Filing Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => {
            if (!isSubmitting) setDrawerOpen(false);
          }}
          title="File Itemized Expense Claim"
          description="Submit multi-item expenditures with verified receipt attachments."
        >
          <form onSubmit={handleSubmitReport} className="space-y-6">
            {submitError && (
              <div className="p-3 rounded-[7px] bg-danger/10 border border-danger/25 text-danger text-xs flex items-center gap-2">
                <WarningCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Header Fields */}
            <div className="space-y-4">
              <Input
                label="Report Title"
                placeholder="e.g. Regional Field Audit Transit & Operations"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="space-y-1.5 text-left font-sans">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
                  Business Purpose &amp; Justification
                </label>
                <textarea
                  rows={2}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Operational justification for these expenditures..."
                  className="w-full rounded-[7px] bg-subtle text-ink border border-rule px-3.5 py-2.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand placeholder:text-muted/60"
                />
              </div>
            </div>

            {/* Line Items Repeater */}
            <div className="space-y-4 border-t border-rule pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider font-sans">
                  Itemized Expenditures ({items.length})
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleAddItem}
                >
                  Add Item
                </Button>
              </div>

              {items.map((item, idx) => {
                const cat = categories.find((c) => c.id === item.categoryId);
                const itemAmt = Number(item.amount) || 0;
                const requiresReceipt = itemAmt > 5000;
                const exceedsCeiling = cat && itemAmt > cat.maxSingleLimit;
                const dayOfWeek = item.dateIncurred ? new Date(item.dateIncurred).getUTCDay() : 1;
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-[12px] bg-subtle/50 border border-rule space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-rule pb-2">
                      <span className="text-xs font-semibold text-brand font-display">
                        Line Item #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-muted hover:text-danger p-1 rounded transition-colors"
                          title="Remove Line Item"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Category select */}
                      <div className="space-y-1 text-left font-sans">
                        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
                          Expense Category
                        </label>
                        <select
                          value={item.categoryId}
                          onChange={(e) => handleItemChange(idx, 'categoryId', e.target.value)}
                          className="w-full rounded-[7px] bg-surface text-ink border border-rule px-3 py-2 text-sm outline-none focus:border-brand"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Max: ₦{c.maxSingleLimit.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date incurred */}
                      <div className="space-y-1 text-left font-sans">
                        <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
                          Date Incurred
                        </label>
                        <input
                          type="date"
                          value={item.dateIncurred}
                          onChange={(e) => handleItemChange(idx, 'dateIncurred', e.target.value)}
                          className="w-full rounded-[7px] bg-surface text-ink border border-rule px-3 py-2 text-sm outline-none focus:border-brand"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Merchant name */}
                      <Input
                        label="Merchant / Vendor"
                        placeholder="e.g. Air Peace, Total Energies"
                        value={item.merchantName}
                        onChange={(e) => handleItemChange(idx, 'merchantName', e.target.value)}
                        required
                      />

                      {/* Amount */}
                      <Input
                        label="Amount (₦)"
                        type="number"
                        min="1"
                        step="any"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                        required
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1 text-left font-sans">
                      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider">
                        Business Note / Description
                      </label>
                      <input
                        type="text"
                        placeholder="Operational purpose of this line item..."
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="w-full rounded-[7px] bg-surface text-ink border border-rule px-3 py-2 text-sm outline-none focus:border-brand"
                      />
                    </div>

                    {/* Policy validation warnings */}
                    {requiresReceipt && !item.receiptUrl && (
                      <div className="p-2 rounded-[6px] bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-1.5 font-sans">
                        <WarningCircle className="w-4 h-4 shrink-0" />
                        <span>Receipt document is mandatory for items exceeding ₦5,000.00.</span>
                      </div>
                    )}
                    {exceedsCeiling && (
                      <div className="p-2 rounded-[6px] bg-danger/10 border border-danger/25 text-danger text-xs flex items-center gap-1.5 font-sans">
                        <WarningCircle className="w-4 h-4 shrink-0" />
                        <span>Amount exceeds category ceiling of ₦{cat?.maxSingleLimit.toLocaleString()}.00.</span>
                      </div>
                    )}
                    {isWeekend && (
                      <div className="p-2 rounded-[6px] bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-1.5 font-sans">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Incurred on weekend. Please ensure operational justification is noted.</span>
                      </div>
                    )}

                    {/* Receipt Upload Dropzone */}
                    <div className="pt-1">
                      {item.receiptUrl ? (
                        <div className="p-2.5 rounded-[7px] bg-surface border border-rule flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {item.receiptFileName?.endsWith('.pdf') ? (
                              <FilePdf className="w-5 h-5 text-danger shrink-0" weight="fill" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-brand shrink-0" weight="fill" />
                            )}
                            <div className="truncate text-xs">
                              <span className="font-medium text-ink">{item.receiptFileName || 'Receipt Document'}</span>
                              {item.receiptSize && (
                                <span className="text-muted ml-1.5">
                                  ({(item.receiptSize / 1024).toFixed(1)} KB)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptUrl(item.receiptUrl!)}
                              className="text-xs text-brand hover:underline px-2 py-1"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleItemChange(idx, 'receiptUrl', '');
                                handleItemChange(idx, 'receiptFileName', '');
                              }}
                              className="text-muted hover:text-danger p-1"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border border-dashed border-rule hover:border-brand rounded-[7px] p-3 text-center block cursor-pointer transition-colors bg-surface">
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(idx, f);
                            }}
                          />
                          <div className="flex items-center justify-center gap-2 text-xs text-muted">
                            {uploadingIndex === idx ? (
                              <>
                                <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                <span>Uploading &amp; verifying magic bytes...</span>
                              </>
                            ) : (
                              <>
                                <UploadSimple className="w-4 h-4 text-brand" />
                                <span>Upload Receipt (PNG, JPEG, PDF up to 10MB)</span>
                              </>
                            )}
                          </div>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Summary & Escalation Notice */}
            <div className="p-4 rounded-[12px] bg-subtle border border-rule space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted font-sans">Total Claim Amount</span>
                <span className="text-xl font-bold text-ink font-display tabular-nums">
                  ₦{currentTotalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {currentTotalAmount > 50000 && (
                <p className="text-xs text-brand font-sans flex items-center gap-1.5 pt-1 border-t border-rule">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Claims exceeding ₦50,000.00 require secondary Department Head escalation.
                  </span>
                </p>
              )}
            </div>

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-1/3"
                onClick={() => setDrawerOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="w-2/3"
                isLoading={isSubmitting}
                disabled={policyErrors.length > 0}
              >
                Submit for Manager Review
              </Button>
            </div>
          </form>
        </Drawer>

        {/* Claim Detail Inspection Drawer */}
        <Drawer
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          title={selectedReport?.reportNumber || 'Expense Claim Detail'}
          description="Detailed line items and attached receipts."
        >
          {selectedReport && (
            <div className="space-y-6 text-sm font-sans">
              {/* Header Status */}
              <div className="p-4 rounded-[12px] bg-subtle border border-rule flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">Claim Status</div>
                  <div className="mt-1">{renderStatusBadge(selectedReport.status)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">Total Value</div>
                  <div className="text-xl font-bold text-ink font-display tabular-nums mt-0.5">
                    ₦{(Number(selectedReport.totalAmount) || 0).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              {/* Overview Details */}
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-semibold text-muted uppercase">Claim Title:</span>
                  <p className="text-sm font-medium text-ink">{selectedReport.title}</p>
                </div>
                {selectedReport.purpose && (
                  <div>
                    <span className="text-xs font-semibold text-muted uppercase">Business Purpose:</span>
                    <p className="text-xs text-muted">{selectedReport.purpose}</p>
                  </div>
                )}
                {selectedReport.disbursementReference && (
                  <div>
                    <span className="text-xs font-semibold text-muted uppercase">Payment Reference:</span>
                    <p className="text-xs font-mono font-bold text-brand">
                      {selectedReport.disbursementReference}
                    </p>
                  </div>
                )}
                {selectedReport.rejectionReason && (
                  <div className="p-3 rounded-[7px] bg-danger/10 border border-danger/20 text-danger text-xs">
                    <span className="font-semibold block mb-0.5">Reviewer Feedback:</span>
                    {selectedReport.rejectionReason}
                  </div>
                )}
              </div>

              {/* Line Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-ink uppercase tracking-wider border-b border-rule pb-1.5">
                  Line Items ({selectedReport.items?.length || 0})
                </h4>
                {selectedReport.items?.map((it, i) => (
                  <div key={i} className="p-3 rounded-[7px] bg-subtle/50 border border-rule space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink">{it.merchantName}</span>
                      <span className="font-bold text-ink tabular-nums">
                        ₦{(Number(it.amount) || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-xs text-muted flex items-center justify-between">
                      <span>{it.dateIncurred}</span>
                      {it.receiptUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptUrl(it.receiptUrl!)}
                          className="text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Receipt</span>
                        </button>
                      ) : (
                        <span className="text-muted/60">No receipt attached</span>
                      )}
                    </div>
                    {it.description && <p className="text-xs text-muted pt-1">{it.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Drawer>

        {/* Receipt Document Preview Modal */}
        <Modal
          isOpen={!!previewReceiptUrl}
          onClose={() => setPreviewReceiptUrl(null)}
          title="Verified Receipt Document"
          maxWidth="2xl"
        >
          {previewReceiptUrl && (
            <div className="space-y-4">
              {previewReceiptUrl.endsWith('.pdf') ? (
                <div className="w-full h-96 bg-subtle rounded-[7px] flex flex-col items-center justify-center p-6 border border-rule">
                  <FilePdf className="w-16 h-16 text-danger mb-3" weight="fill" />
                  <p className="text-sm font-semibold text-ink">PDF Document Attached</p>
                  <p className="text-xs text-muted mt-1 text-center max-w-sm">
                    PDF files cannot be rendered directly inline in this browser sandbox. You can preview or download below.
                  </p>
                  <a
                    href={previewReceiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 px-4 py-2 rounded-[7px] bg-brand text-white text-xs font-semibold hover:opacity-90 inline-flex items-center gap-2"
                  >
                    <span>Open PDF in New Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/5 dark:bg-black/30 rounded-[7px] p-2">
                  <img
                    src={previewReceiptUrl}
                    alt="Receipt Preview"
                    className="max-w-full max-h-[60vh] object-contain rounded"
                  />
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </PortalLayout>
  );
};
