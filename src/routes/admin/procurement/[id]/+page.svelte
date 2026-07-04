<script lang="ts">
  import { enhance } from '$app/forms';
  import LocaleTabs from '$lib/components/admin/LocaleTabs.svelte';
  import RichTextEditor from '$lib/components/admin/RichTextEditor.svelte';
  import { requestTranslation } from '$lib/components/admin/translate-client';
  import { formatDateTime, type Locale } from '$lib/i18n';
  import { formatBytes, mediaFileUrl } from '$lib/types';

  let { data, form } = $props();

  const item = $derived(data.item);

  const STATUS_LABEL: Record<string, string> = {
    draft: 'მონახაზი',
    published: 'გამოქვეყნებული',
    closed: 'დახურული',
    amended: 'შეცვლილი',
    canceled: 'გაუქმებული',
    awarded: 'დასრულებული (გამარჯვებული გამოვლენილია)',
    archived: 'არქივი'
  };

  function i18nFor(locale: Locale) {
    return data.i18n.find((r) => r.locale === locale);
  }

  const status = $derived(
    Object.fromEntries(
      data.i18n.map((r) => [r.locale, { reviewStatus: r.reviewStatus, stale: !!r.staleSource }])
    )
  );

  function docTitle(docId: string, filename: string): string {
    return data.docTitles.find((t) => t.docId === docId && t.locale === 'ka')?.title ?? filename;
  }

  // AJAX translation: current (unsaved) KA form → EN/РУ tabs, one request, no reload
  type EditorRef = { setJson: (j: string) => void; getJson: () => string };
  let editors: Record<string, EditorRef | undefined> = $state({});
  let tab: Locale = $state('ka');
  let translating = $state(false);
  let saving = $state(false);
  let trMsg = $state('');
  let trErr = $state('');

  const TRANSLATE_FIELDS = ['title', 'amendment_summary'];

  async function translateNow() {
    trMsg = '';
    trErr = '';
    const kaForm = document.querySelector<HTMLFormElement>('form[data-locale="ka"]');
    if (!kaForm) return;
    const fields: Record<string, string> = {};
    for (const name of TRANSLATE_FIELDS) {
      const el = kaForm.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el?.value.trim()) fields[name] = el.value.trim();
    }
    if (!fields.title) {
      trErr = 'ჯერ ქართული სათაური შეავსეთ';
      return;
    }
    translating = true;
    const res = await requestTranslation(data.csrf, {
      fields,
      bodyJson: editors.ka?.getJson() || null
    });
    translating = false;
    if (!res.ok || !res.en || !res.ru) {
      trErr = res.error ?? 'თარგმნა ვერ შესრულდა';
      return;
    }
    for (const loc of ['en', 'ru'] as const) {
      const f = document.querySelector<HTMLFormElement>(`form[data-locale="${loc}"]`);
      const out = res[loc];
      if (!f || !out) continue;
      for (const [key, value] of Object.entries(out.fields)) {
        const el = f.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | null;
        if (el && value) el.value = value;
      }
      if (out.bodyJson) editors[loc]?.setJson(out.bodyJson);
    }
    tab = 'en';
    trMsg = 'თარგმანი ჩაისვა EN/РУ ჩანართებში — გადახედეთ და შეინახეთ';
  }

  const enhanceSave = () => {
    saving = true;
    return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
      saving = false;
      await update({ reset: false });
    };
  };
</script>

<svelte:head>
  <title>რედაქტირება — შესყიდვა — ადმინი</title>
</svelte:head>

<div class="admin-head">
  <h1>{i18nFor('ka')?.title || item.slug}</h1>
  <div class="actions-row">
    <span class="badge">{item.kind === 'tender' ? 'ტენდერი' : 'აუქციონი'}</span>
    <span class="badge {item.status === 'published' ? 'badge-green' : 'badge-neutral'}">
      {STATUS_LABEL[item.status] ?? item.status}
    </span>
    {#if item.status !== 'draft'}
      <a class="btn btn-sm btn-outline" href="/ka/procurement/{item.slug}" target="_blank">ნახვა</a>
    {/if}
  </div>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.saved}
  <p class="ok-msg" role="status">
    შენახულია ({form.locale}){form.translated ? ' · EN/РУ ავტომატურად ითარგმნა' : ''}
  </p>
{/if}
{#if form?.warning}<p class="err-msg" role="alert">{form.warning}</p>{/if}
{#if form?.published}<p class="ok-msg" role="status">გამოქვეყნდა</p>{/if}
{#if form?.transitioned}<p class="ok-msg" role="status">სტატუსი შეიცვალა</p>{/if}
{#if form?.docUploaded}<p class="ok-msg" role="status">დოკუმენტი აიტვირთა</p>{/if}
{#if form?.translated && !form?.saved}<p class="ok-msg" role="status">
    თარგმანი შესრულდა (EN + RU)
  </p>{/if}
{#if trMsg}<p class="ok-msg" role="status">{trMsg}</p>{/if}
{#if trErr}<p class="err-msg" role="alert">{trErr}</p>{/if}

{#if item.amendsId}
  <p class="notice notice-amber">
    ეს განცხადება არის ცვლილება — <a href="/admin/procurement/{item.amendsId}"
      >თავდაპირველი განცხადება</a
    >
  </p>
{/if}

<LocaleTabs {status} bind:current={tab}>
  {#snippet panel(locale)}
    {@const row = i18nFor(locale)}
    <form
      method="POST"
      action="?/save"
      class="panel"
      data-locale={locale}
      use:enhance={enhanceSave}
    >
      <input type="hidden" name="csrf" value={data.csrf} />
      <input type="hidden" name="locale" value={locale} />

      <label class="field">
        <span>სათაური</span>
        <input type="text" name="title" value={row?.title ?? ''} required={locale === 'ka'} />
      </label>

      {#if item.amendsId}
        <label class="field">
          <span>ცვლილების აღწერა</span>
          <textarea name="amendment_summary" rows="2">{row?.amendmentSummary ?? ''}</textarea>
        </label>
      {/if}

      <div class="field">
        <span>ტექსტი</span>
        <RichTextEditor bind:this={editors[locale]} name="body" initialJson={row?.bodyJson ?? ''} />
      </div>

      {#if locale === 'ka'}
        <div class="form-row">
          <label class="field">
            <span>ტიპი</span>
            <select name="kind">
              <option value="tender" selected={item.kind === 'tender'}>ტენდერი</option>
              <option value="auction" selected={item.kind === 'auction'}>აუქციონი</option>
            </select>
          </label>
          <label class="field">
            <span>ბოლო ვადა (თბილისის დროით)</span>
            <input type="datetime-local" name="deadline" value={data.deadlineLocal} />
          </label>
          {#if item.status !== 'draft'}
            <label class="field">
              <span>ვადის შეცვლის მიზეზი (სავალდებულო ცვლილებისას)</span>
              <input type="text" name="deadline_reason" />
            </label>
          {/if}
        </div>
      {/if}

      <div class="actions-row">
        <button class="btn" type="submit" disabled={saving}>
          {saving ? 'ინახება…' : 'შენახვა'}
        </button>
        {#if locale === 'ka' && data.hasOpenRouter}
          <label class="auto-toggle">
            <input type="checkbox" name="autotranslate" value="1" checked />
            EN/РУ ავტომატური თარგმნა შენახვისას
          </label>
          <button
            class="btn btn-outline"
            type="button"
            onclick={translateNow}
            disabled={translating}
          >
            {translating ? '🌐 ითარგმნება…' : '🌐 თარგმნა (EN + РУ)'}
          </button>
        {/if}
      </div>
    </form>
  {/snippet}
</LocaleTabs>

<div class="panel">
  <h2>დოკუმენტები (PDF, append-only)</h2>
  {#if data.docs.length > 0}
    <table class="admin" style="margin-bottom: var(--sp-2);">
      <tbody>
        {#each data.docs as doc (doc.id)}
          <tr>
            <td>
              <a href={mediaFileUrl(doc.mediaId)} target="_blank" rel="noopener">
                {docTitle(doc.id, doc.filename)}
              </a>
            </td>
            <td class="muted">{doc.locale ?? 'ყველა ენა'}</td>
            <td class="muted">{formatBytes(doc.size)}</td>
            <td>
              <span class="badge {doc.status === 'active' ? 'badge-green' : 'badge-red'}">
                {doc.status}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  <form method="POST" action="?/uploadDoc" enctype="multipart/form-data" class="actions-row">
    <input type="hidden" name="csrf" value={data.csrf} />
    <input type="file" name="file" accept="application/pdf" required />
    <input type="text" name="doc_title" placeholder="დოკუმენტის სათაური" />
    <select name="doc_locale">
      <option value="">ყველა ენა</option>
      <option value="ka">ქართული</option>
      <option value="en">English</option>
      <option value="ru">Русский</option>
    </select>
    <button class="btn btn-sm" type="submit">ატვირთვა</button>
  </form>
</div>

<div class="panel">
  <h2>სტატუსი და მოქმედებები</h2>
  <div class="actions-row">
    {#if item.status === 'draft'}
      <form method="POST" action="?/publish">
        <input type="hidden" name="csrf" value={data.csrf} />
        <button class="btn" type="submit">გამოქვეყნება</button>
      </form>
    {/if}
    {#if data.hasOpenRouter}
      <button class="btn btn-outline" type="button" onclick={translateNow} disabled={translating}>
        {translating ? '🌐 ითარგმნება…' : '🌐 თარგმნა (EN + РУ)'}
      </button>
    {/if}
  </div>

  {#if data.validTransitions.length > 0 && item.status !== 'draft'}
    <form method="POST" action="?/transition" class="actions-row" style="margin-top: var(--sp-2);">
      <input type="hidden" name="csrf" value={data.csrf} />
      <select name="to_status" required>
        {#each data.validTransitions as transition (transition)}
          <option value={transition}>{STATUS_LABEL[transition] ?? transition}</option>
        {/each}
      </select>
      <input
        type="text"
        name="reason"
        placeholder="მიზეზი (სავალდებულო)"
        required
        style="flex: 1; min-width: 14rem;"
      />
      <button class="btn btn-outline" type="submit">სტატუსის შეცვლა</button>
    </form>
  {/if}

  {#if ['published', 'amended'].includes(item.status)}
    <form method="POST" action="?/amend" class="actions-row" style="margin-top: var(--sp-2);">
      <input type="hidden" name="csrf" value={data.csrf} />
      <input
        type="text"
        name="summary"
        placeholder="ცვლილების მოკლე აღწერა"
        required
        style="flex: 1; min-width: 14rem;"
      />
      <button class="btn btn-outline" type="submit">ცვლილების განცხადების შექმნა</button>
    </form>
  {/if}
</div>

{#if data.amendments.length > 0}
  <div class="panel">
    <h2>ცვლილებები</h2>
    <ul>
      {#each data.amendments as amendment (amendment.id)}
        <li>
          <a href="/admin/procurement/{amendment.id}">{amendment.slug}</a>
          <span class="badge badge-neutral"
            >{STATUS_LABEL[amendment.status] ?? amendment.status}</span
          >
        </li>
      {/each}
    </ul>
  </div>
{/if}

{#if data.history.length > 0}
  <div class="panel">
    <h2>სტატუსების ისტორია</h2>
    <table class="admin">
      <thead>
        <tr><th>საიდან</th><th>სად</th><th>მიზეზი</th><th>დრო</th></tr>
      </thead>
      <tbody>
        {#each data.history as entry (entry.id)}
          <tr>
            <td>{entry.fromStatus ? (STATUS_LABEL[entry.fromStatus] ?? entry.fromStatus) : '—'}</td>
            <td>{STATUS_LABEL[entry.toStatus] ?? entry.toStatus}</td>
            <td>{entry.reason}</td>
            <td class="muted">{formatDateTime('ka', entry.createdAt)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
