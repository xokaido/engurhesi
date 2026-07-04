<script lang="ts">
  import { enhance } from '$app/forms';
  import LocaleTabs from '$lib/components/admin/LocaleTabs.svelte';
  import RichTextEditor from '$lib/components/admin/RichTextEditor.svelte';
  import { requestTranslation } from '$lib/components/admin/translate-client';
  import type { Locale } from '$lib/i18n';

  let { data, form } = $props();

  const page = $derived(data.page);
  const canPublish = $derived(data.role === 'admin' || data.role === 'editor');

  function i18nFor(locale: Locale) {
    return data.i18n.find((r) => r.locale === locale);
  }

  const status = $derived(
    Object.fromEntries(
      data.i18n.map((r) => [r.locale, { reviewStatus: r.reviewStatus, stale: !!r.staleSource }])
    )
  );

  const imageOptions = $derived(data.images.map((i) => ({ id: i.id, label: i.filename })));

  // AJAX translation: current (unsaved) KA form → EN/РУ tabs, one request, no reload
  type EditorRef = { setJson: (j: string) => void; getJson: () => string };
  let editors: Record<string, EditorRef | undefined> = $state({});
  let tab: Locale = $state('ka');
  let translating = $state(false);
  let saving = $state(false);
  let trMsg = $state('');
  let trErr = $state('');

  const TRANSLATE_FIELDS = ['title', 'seo_title', 'seo_description'];

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
  <title>რედაქტირება — გვერდი — ადმინი</title>
</svelte:head>

<div class="admin-head">
  <h1>{i18nFor('ka')?.title || page.slug}</h1>
  <div class="actions-row">
    <span class="badge {page.status === 'published' ? 'badge-green' : 'badge-amber'}">
      {page.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
    </span>
    {#if page.status === 'published'}
      <a class="btn btn-sm btn-outline" href="/ka/about/{page.slug}" target="_blank">ნახვა</a>
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
{#if form?.unpublished}<p class="ok-msg" role="status">გამოქვეყნება გაუქმდა</p>{/if}
{#if form?.translated && !form?.saved}<p class="ok-msg" role="status">
    თარგმანი შესრულდა (EN + RU)
  </p>{/if}
{#if trMsg}<p class="ok-msg" role="status">{trMsg}</p>{/if}
{#if trErr}<p class="err-msg" role="alert">{trErr}</p>{/if}

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

      <div class="form-row">
        <label class="field">
          <span>SEO სათაური</span>
          <input type="text" name="seo_title" value={row?.seoTitle ?? ''} />
        </label>
        <label class="field">
          <span>SEO აღწერა</span>
          <input type="text" name="seo_description" value={row?.seoDescription ?? ''} />
        </label>
        {#if locale === 'ka'}
          <label class="field">
            <span>რიგი (მენიუში)</span>
            <input type="number" name="sort" value={page.sort} />
          </label>
        {/if}
      </div>

      <div class="field">
        <span>ტექსტი</span>
        <RichTextEditor
          bind:this={editors[locale]}
          name="body"
          initialJson={row?.bodyJson ?? ''}
          images={imageOptions}
        />
      </div>

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
  <h2>მოქმედებები</h2>
  <div class="actions-row">
    {#if canPublish}
      {#if page.status === 'draft'}
        <form method="POST" action="?/publish">
          <input type="hidden" name="csrf" value={data.csrf} />
          <button class="btn" type="submit">გამოქვეყნება</button>
        </form>
      {:else}
        <form method="POST" action="?/unpublish">
          <input type="hidden" name="csrf" value={data.csrf} />
          <button class="btn btn-outline" type="submit">გამოქვეყნების გაუქმება</button>
        </form>
      {/if}
    {/if}
    {#if data.hasOpenRouter}
      <button class="btn btn-outline" type="button" onclick={translateNow} disabled={translating}>
        {translating ? '🌐 ითარგმნება…' : '🌐 თარგმნა (EN + РУ)'}
      </button>
    {/if}
    {#if data.role === 'admin'}
      <form
        method="POST"
        action="?/delete"
        onsubmit={(e) => {
          if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
        }}
      >
        <input type="hidden" name="csrf" value={data.csrf} />
        <button class="btn btn-danger" type="submit">წაშლა</button>
      </form>
    {/if}
  </div>
</div>
