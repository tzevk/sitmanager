'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { GhostBtn, PageHeader } from '@/components/ui/PageHeader';
import { useResourcePermissions } from '@/lib/permissions-context';

interface MetaCampaignPublishLogRow {
  id: number;
  campaignId: string | null;
  campaignName: string;
  objective: string;
  publishStatus: string;
  requestedBy: number | null;
  createdAt: string;
  errorMessage: string | null;
}

const META_PUBLISH_OBJECTIVES = [
  { value: 'OUTCOME_LEADS', label: 'Leads' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness' },
  { value: 'OUTCOME_SALES', label: 'Sales' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion' },
] as const;

const META_SPECIAL_CATEGORY_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'CREDIT', label: 'Credit' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'HOUSING', label: 'Housing' },
  { value: 'ISSUES_ELECTIONS_POLITICS', label: 'Politics / Issues' },
] as const;

const META_CTA_OPTIONS = [
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'APPLY_NOW', label: 'Apply Now' },
  { value: 'CONTACT_US', label: 'Contact Us' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'BOOK_TRAVEL', label: 'Book Travel' },
] as const;

const META_BILLING_EVENT_OPTIONS = [
  { value: 'IMPRESSIONS', label: 'Impressions' },
  { value: 'LINK_CLICKS', label: 'Link Clicks' },
] as const;

const META_OPTIMIZATION_GOAL_OPTIONS = [
  { value: 'QUALITY_LEAD', label: 'Quality Lead' },
  { value: 'LEAD_GENERATION', label: 'Lead Generation' },
  { value: 'LINK_CLICKS', label: 'Link Clicks' },
  { value: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views' },
] as const;

const META_DESTINATION_TYPE_OPTIONS = [
  { value: 'ON_AD', label: 'On Ad' },
  { value: 'WEBSITE', label: 'Website' },
] as const;

const ctrl = 'bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-slate-400 transition-colors';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const raw = String(dateStr).trim();
    let d = new Date(raw);
    if (isNaN(d.getTime())) return '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return '—';
  }
}

export default function MetaOutboundPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('inquiry');
  const [publishName, setPublishName] = useState('');
  const [publishObjective, setPublishObjective] = useState<string>('OUTCOME_LEADS');
  const [publishSpecialCategory, setPublishSpecialCategory] = useState<string>('NONE');
  const [publishPageId, setPublishPageId] = useState('');
  const [publishWebsiteUrl, setPublishWebsiteUrl] = useState('');
  const [publishFormName, setPublishFormName] = useState('');
  const [publishFormPrivacyUrl, setPublishFormPrivacyUrl] = useState('');
  const [publishFormFollowUpUrl, setPublishFormFollowUpUrl] = useState('');
  const [publishFormThankYouTitle, setPublishFormThankYouTitle] = useState('Thanks for your interest');
  const [publishFormThankYouBody, setPublishFormThankYouBody] = useState('We will contact you shortly.');
  const [publishFormQuestions, setPublishFormQuestions] = useState('FULL_NAME, EMAIL, PHONE');
  const [publishCreativeName, setPublishCreativeName] = useState('');
  const [publishCreativeMessage, setPublishCreativeMessage] = useState('');
  const [publishCreativeHeadline, setPublishCreativeHeadline] = useState('');
  const [publishCreativeImageHash, setPublishCreativeImageHash] = useState('');
  const [publishCreativeImageUrl, setPublishCreativeImageUrl] = useState('');
  const [publishCreativeCta, setPublishCreativeCta] = useState<string>('SIGN_UP');
  const [publishCreativeImageFileName, setPublishCreativeImageFileName] = useState('');
  const [publishCreativeUploadBusy, setPublishCreativeUploadBusy] = useState(false);
  const [publishCreativeUploadError, setPublishCreativeUploadError] = useState('');
  const [publishAdSetName, setPublishAdSetName] = useState('');
  const [publishAdSetBudget, setPublishAdSetBudget] = useState('10000');
  const [publishAdSetCountries, setPublishAdSetCountries] = useState('IN');
  const [publishAdSetBillingEvent, setPublishAdSetBillingEvent] = useState<string>('IMPRESSIONS');
  const [publishAdSetOptimizationGoal, setPublishAdSetOptimizationGoal] = useState<string>('QUALITY_LEAD');
  const [publishAdSetDestinationType, setPublishAdSetDestinationType] = useState<string>('ON_AD');
  const [publishAdSetStartTime, setPublishAdSetStartTime] = useState('');
  const [publishAdSetEndTime, setPublishAdSetEndTime] = useState('');
  const [publishAdName, setPublishAdName] = useState('');
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');
  const [publishHistory, setPublishHistory] = useState<MetaCampaignPublishLogRow[]>([]);
  const [publishHistoryLoading, setPublishHistoryLoading] = useState(true);
  const creativeImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPublishHistory() {
      setPublishHistoryLoading(true);
      try {
        const res = await fetch('/api/meta-ads/campaigns/publish?limit=12');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to load Meta publish history');
        if (!cancelled) setPublishHistory(Array.isArray(data.rows) ? data.rows : []);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setPublishHistory([]);
        }
      } finally {
        if (!cancelled) setPublishHistoryLoading(false);
      }
    }
    fetchPublishHistory();
    return () => { cancelled = true; };
  }, []);

  const handleCreativeImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setPublishCreativeUploadError('Please choose an image file.');
      return;
    }

    setPublishCreativeUploadBusy(true);
    setPublishCreativeUploadError('');
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/meta-ads/creative-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to upload image');

      const imageUrl = String(data?.imageUrl || '').trim();
      if (!imageUrl) throw new Error('Upload succeeded but no image URL was returned');

      setPublishCreativeImageUrl(imageUrl);
      setPublishCreativeImageHash('');
      setPublishCreativeImageFileName(String(data?.fileName || file.name || '').trim());
    } catch (error: unknown) {
      setPublishCreativeUploadError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setPublishCreativeUploadBusy(false);
      if (creativeImageInputRef.current) creativeImageInputRef.current.value = '';
    }
  }, []);

  const handleCreativeImagePick = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void handleCreativeImageUpload(file);
  }, [handleCreativeImageUpload]);

  const refreshHistory = useCallback(async () => {
    const historyRes = await fetch('/api/meta-ads/campaigns/publish?limit=12');
    const historyData = await historyRes.json().catch(() => ({}));
    if (historyRes.ok) setPublishHistory(Array.isArray(historyData.rows) ? historyData.rows : []);
  }, []);

  const submitCampaignPublish = useCallback(async () => {
    if (!publishName.trim()) {
      setPublishError('Campaign name is required.');
      setPublishSuccess('');
      return;
    }

    setPublishBusy(true);
    setPublishError('');
    setPublishSuccess('');
    try {
      const specialAdCategories = publishSpecialCategory === 'NONE' ? ['NONE'] : [publishSpecialCategory];
      const questionKeys = publishFormQuestions.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
      const countries = publishAdSetCountries.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
      const res = await fetch('/api/meta-ads/campaigns/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: publishName.trim(),
          objective: publishObjective,
          status: 'PAUSED',
          specialAdCategories,
          pageId: publishPageId.trim() || null,
          websiteUrl: publishWebsiteUrl.trim() || null,
          instantForm: {
            name: publishFormName.trim(),
            privacyPolicyUrl: publishFormPrivacyUrl.trim(),
            followUpActionUrl: publishFormFollowUpUrl.trim() || null,
            thankYouTitle: publishFormThankYouTitle.trim() || null,
            thankYouBody: publishFormThankYouBody.trim() || null,
            questionKeys,
          },
          creative: {
            name: publishCreativeName.trim(),
            message: publishCreativeMessage.trim(),
            headline: publishCreativeHeadline.trim() || null,
            imageHash: publishCreativeImageHash.trim() || null,
            imageUrl: publishCreativeImageUrl.trim() || null,
            callToActionType: publishCreativeCta,
            linkUrl: publishWebsiteUrl.trim() || null,
          },
          adSet: {
            name: publishAdSetName.trim(),
            dailyBudget: Number(publishAdSetBudget || 0),
            countries,
            billingEvent: publishAdSetBillingEvent,
            optimizationGoal: publishAdSetOptimizationGoal,
            destinationType: publishAdSetDestinationType,
            startTime: publishAdSetStartTime || null,
            endTime: publishAdSetEndTime || null,
            status: 'PAUSED',
          },
          ad: {
            name: publishAdName.trim(),
            status: 'PAUSED',
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to publish Meta campaign');

      const message = String(data?.campaign?.message || '').trim();
      const campaignName = String(data?.campaign?.campaignName || publishName.trim());
      const campaignId = String(data?.campaign?.campaignId || '').trim();
      setPublishSuccess(message || (campaignId ? `${campaignName} created as ${campaignId}.` : `${campaignName} created.`));
      setPublishName('');
      setPublishObjective('OUTCOME_LEADS');
      setPublishSpecialCategory('NONE');
      setPublishPageId('');
      setPublishWebsiteUrl('');
      setPublishFormName('');
      setPublishFormPrivacyUrl('');
      setPublishFormFollowUpUrl('');
      setPublishFormThankYouTitle('Thanks for your interest');
      setPublishFormThankYouBody('We will contact you shortly.');
      setPublishFormQuestions('FULL_NAME, EMAIL, PHONE');
      setPublishCreativeName('');
      setPublishCreativeMessage('');
      setPublishCreativeHeadline('');
      setPublishCreativeImageHash('');
      setPublishCreativeImageUrl('');
      setPublishCreativeImageFileName('');
      setPublishCreativeUploadError('');
      setPublishCreativeCta('SIGN_UP');
      setPublishAdSetName('');
      setPublishAdSetBudget('10000');
      setPublishAdSetCountries('IN');
      setPublishAdSetBillingEvent('IMPRESSIONS');
      setPublishAdSetOptimizationGoal('QUALITY_LEAD');
      setPublishAdSetDestinationType('ON_AD');
      setPublishAdSetStartTime('');
      setPublishAdSetEndTime('');
      setPublishAdName('');
      await refreshHistory();
    } catch (error: unknown) {
      setPublishError(error instanceof Error ? error.message : 'Failed to publish Meta campaign');
    } finally {
      setPublishBusy(false);
    }
  }, [publishAdName, publishAdSetBillingEvent, publishAdSetBudget, publishAdSetCountries, publishAdSetDestinationType, publishAdSetEndTime, publishAdSetName, publishAdSetOptimizationGoal, publishAdSetStartTime, publishCreativeCta, publishCreativeHeadline, publishCreativeImageHash, publishCreativeImageUrl, publishCreativeMessage, publishCreativeName, publishFormFollowUpUrl, publishFormName, publishFormPrivacyUrl, publishFormQuestions, publishFormThankYouBody, publishFormThankYouTitle, publishName, publishObjective, publishPageId, publishSpecialCategory, publishWebsiteUrl, refreshHistory]);

  return (
    <div className="space-y-5">
      {permLoading ? <PermissionLoading /> : !canView ? <AccessDenied message="You do not have permission to view Meta outbound publishing." /> : (
        <>
          <PageHeader
            title="Meta Outbound"
            breadcrumbs={[{ label: 'Admission Activity' }, { label: 'Meta Leads', href: '/dashboard/meta-leads' }, { label: 'Outbound' }]}
            meta="Campaign builder"
            action={<>
              <GhostBtn href="/dashboard/meta-leads">Back To Leads</GhostBtn>
            </>}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(46,48,147,0.18),_transparent_38%),linear-gradient(135deg,_#0f172a,_#1e293b_62%,_#334155)] px-5 py-5 text-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-100/90">
                      <svg className="h-3.5 w-3.5 text-[#7dd3fc]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z"/></svg>
                      Outbound Campaign Builder
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">Build and publish the full Meta campaign stack from a dedicated page</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200/90">This page is focused only on outbound publishing so the lead table stays separate. The full stack is still submitted in paused mode for safe review inside Meta.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50/70 px-5 py-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Step 1</p>
                      <h4 className="mt-1 text-sm font-semibold text-slate-900">Campaign foundation</h4>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">Required</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
                    <label className="xl:col-span-4"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Campaign Name</span><input value={publishName} onChange={(e) => setPublishName(e.target.value)} placeholder="e.g. SIT July 2026 Lead Campaign" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                    <label className="xl:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Objective</span><select value={publishObjective} onChange={(e) => setPublishObjective(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>{META_PUBLISH_OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                    <label className="xl:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Category</span><select value={publishSpecialCategory} onChange={(e) => setPublishSpecialCategory(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>{META_SPECIAL_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                    <label className="xl:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Page ID</span><input value={publishPageId} onChange={(e) => setPublishPageId(e.target.value)} placeholder="Page ID" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                    <label className="xl:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Website URL</span><input value={publishWebsiteUrl} onChange={(e) => setPublishWebsiteUrl(e.target.value)} placeholder="https://…" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm shadow-violet-100/40">
                    <div className="mb-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-500">Step 2</p><h4 className="mt-1 text-sm font-semibold text-slate-900">Ad Set configuration</h4></div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="md:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Ad Set Name</span><input value={publishAdSetName} onChange={e => setPublishAdSetName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Daily Budget (₹)</span><input type="number" min="1" value={publishAdSetBudget} onChange={e => setPublishAdSetBudget(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Countries</span><input value={publishAdSetCountries} onChange={e => setPublishAdSetCountries(e.target.value)} placeholder="IN" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Billing Event</span><select value={publishAdSetBillingEvent} onChange={e => setPublishAdSetBillingEvent(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>{META_BILLING_EVENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Optimization Goal</span><select value={publishAdSetOptimizationGoal} onChange={e => setPublishAdSetOptimizationGoal(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>{META_OPTIMIZATION_GOAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Destination</span><select value={publishAdSetDestinationType} onChange={e => setPublishAdSetDestinationType(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>{META_DESTINATION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Start Time</span><input value={publishAdSetStartTime} onChange={e => setPublishAdSetStartTime(e.target.value)} placeholder="2026-06-10T09:00:00+0530" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">End Time</span><input value={publishAdSetEndTime} onChange={e => setPublishAdSetEndTime(e.target.value)} placeholder="Optional" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm shadow-blue-100/40">
                    <div className="mb-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">Step 3</p><h4 className="mt-1 text-sm font-semibold text-slate-900">Creative and artwork</h4></div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Creative Name</span><input value={publishCreativeName} onChange={e => setPublishCreativeName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">CTA</span><select value={publishCreativeCta} onChange={e => setPublishCreativeCta(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy}>{META_CTA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                      <label className="md:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Primary Text</span><input value={publishCreativeMessage} onChange={e => setPublishCreativeMessage(e.target.value)} placeholder="Ad copy…" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Headline</span><input value={publishCreativeHeadline} onChange={e => setPublishCreativeHeadline(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Image Hash</span><input value={publishCreativeImageHash} onChange={e => setPublishCreativeImageHash(e.target.value)} placeholder="Optional" className={ctrl} disabled={!canUpdate || publishBusy || publishCreativeUploadBusy} /></label>
                    </div>
                    <div className="mt-3 rounded-2xl border border-dashed border-blue-300 bg-blue-50/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Upload Artwork</p><p className="mt-1 text-xs text-slate-500">Choose the creative image here instead of manually pasting a URL.</p></div>
                        <input ref={creativeImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCreativeImagePick} />
                        <button type="button" onClick={() => creativeImageInputRef.current?.click()} disabled={!canUpdate || publishBusy || publishCreativeUploadBusy} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400">
                          {publishCreativeUploadBusy ? <><span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />Uploading...</> : <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16.5v1A2.5 2.5 0 006.5 20h11a2.5 2.5 0 002.5-2.5v-1" /></svg>Upload Image</>}
                        </button>
                      </div>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
                          {publishCreativeImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={publishCreativeImageUrl} alt="Creative preview" className="h-full w-full object-cover" />
                          ) : (
                            <svg className="h-7 w-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                        </div>
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">{publishCreativeImageFileName || 'No image uploaded yet'}</p><p className="mt-1 break-all text-[11px] text-slate-500">{publishCreativeImageUrl || 'A hosted image URL will be generated automatically after upload.'}</p>{publishCreativeUploadError && <p className="mt-2 text-[11px] text-red-600">{publishCreativeUploadError}</p>}</div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                  <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm shadow-emerald-100/40">
                    <div className="mb-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-500">Step 4</p><h4 className="mt-1 text-sm font-semibold text-slate-900">Instant form setup</h4></div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Form Name</span><input value={publishFormName} onChange={e => setPublishFormName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Questions</span><input value={publishFormQuestions} onChange={e => setPublishFormQuestions(e.target.value)} placeholder="FULL_NAME, EMAIL, PHONE" className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Privacy URL</span><input value={publishFormPrivacyUrl} onChange={e => setPublishFormPrivacyUrl(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Follow-up URL</span><input value={publishFormFollowUpUrl} onChange={e => setPublishFormFollowUpUrl(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label><span className="mb-1 block text-[11px] font-semibold text-slate-600">Thank-you Title</span><input value={publishFormThankYouTitle} onChange={e => setPublishFormThankYouTitle(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                      <label className="md:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Thank-you Body</span><input value={publishFormThankYouBody} onChange={e => setPublishFormThankYouBody(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm shadow-orange-100/40">
                    <div className="mb-4"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">Step 5</p><h4 className="mt-1 text-sm font-semibold text-slate-900">Final ad shell</h4></div>
                    <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Ad Name</span><input value={publishAdName} onChange={e => setPublishAdName(e.target.value)} className={ctrl} disabled={!canUpdate || publishBusy} /></label>
                    <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-3 text-[11px] leading-5 text-orange-800">Everything created here is submitted in paused mode so you can review the objects safely in Meta before activation.</div>
                  </section>
                </div>

                {!canUpdate && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-700">View-only — creation requires update permission.</p>}
                {publishError && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">{publishError}</p>}
                {publishSuccess && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-700">{publishSuccess}</p>}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">{['Campaign', 'Ad Set', 'Creative', 'Form', 'Ad'].map((l) => <span key={l} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{l}</span>)}</div>
                <button type="button" onClick={submitCampaignPublish} disabled={!canUpdate || publishBusy || !publishName.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2E3093] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2E3093]/20 transition-colors hover:bg-[#25277a] disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-w-[180px]">{publishBusy ? <><div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Publishing...</> : <>Publish Campaign Stack</>}</button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Recent Activity</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-900">Latest publish attempts</h3>
              </div>
              <div className="max-h-[860px] overflow-y-auto">
                {publishHistoryLoading ? (
                  <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-50 animate-pulse" />)}</div>
                ) : publishHistory.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">No publish activity yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {publishHistory.map((item) => {
                      const ok = !item.errorMessage;
                      return (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">{item.campaignName}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                <span>{item.objective}</span>
                                {item.campaignId && <span className="font-mono text-[10px] text-slate-400">{item.campaignId}</span>}
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{ok ? item.publishStatus : 'Failed'}</span>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-400">{formatDate(item.createdAt)}</p>
                          {item.errorMessage && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-600">{item.errorMessage}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}