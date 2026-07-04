<script lang="ts">
	import LocaleTabs from '$lib/components/admin/LocaleTabs.svelte';
	import RichTextEditor from '$lib/components/admin/RichTextEditor.svelte';
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
{#if form?.saved}<p class="ok-msg" role="status">შენახულია ({form.locale})</p>{/if}
{#if form?.published}<p class="ok-msg" role="status">გამოქვეყნდა</p>{/if}
{#if form?.unpublished}<p class="ok-msg" role="status">გამოქვეყნება გაუქმდა</p>{/if}
{#if form?.translated}<p class="ok-msg" role="status">თარგმანი შესრულდა (EN + RU)</p>{/if}

<LocaleTabs {status}>
	{#snippet panel(locale)}
		{@const row = i18nFor(locale)}
		<form method="POST" action="?/save" class="panel">
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
				<RichTextEditor name="body" initialJson={row?.bodyJson ?? ''} images={imageOptions} />
			</div>

			<div class="actions-row">
				<button class="btn" type="submit">შენახვა</button>
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
			<form method="POST" action="?/translate">
				<input type="hidden" name="csrf" value={data.csrf} />
				<button class="btn btn-outline" type="submit">თარგმნა (EN + RU)</button>
			</form>
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
