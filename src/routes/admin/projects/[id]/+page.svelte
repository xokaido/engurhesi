<script lang="ts">
	import LocaleTabs from '$lib/components/admin/LocaleTabs.svelte';
	import RichTextEditor from '$lib/components/admin/RichTextEditor.svelte';
	import type { Locale } from '$lib/i18n';

	let { data, form } = $props();

	const project = $derived(data.project);
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

	const factsText = $derived.by(() => {
		if (!project.factsJson) return '';
		try {
			const facts = JSON.parse(project.factsJson) as { label: string; value: string }[];
			return facts.map((f) => `${f.label} = ${f.value}`).join('\n');
		} catch {
			return '';
		}
	});
</script>

<svelte:head>
	<title>რედაქტირება — პროექტი — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>{i18nFor('ka')?.title || project.slug}</h1>
	<div class="actions-row">
		<span class="badge {project.status === 'published' ? 'badge-green' : 'badge-amber'}">
			{project.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
		</span>
		{#if project.status === 'published'}
			<a class="btn btn-sm btn-outline" href="/ka/projects/{project.slug}" target="_blank">ნახვა</a>
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

			<label class="field">
				<span>მოკლე აღწერა</span>
				<textarea name="summary" rows="2">{row?.summary ?? ''}</textarea>
			</label>

			<div class="field">
				<span>ტექსტი</span>
				<RichTextEditor name="body" initialJson={row?.bodyJson ?? ''} images={imageOptions} />
			</div>

			{#if locale === 'ka'}
				<div class="form-row">
					<label class="field">
						<span>ყდის სურათი</span>
						<select name="cover">
							<option value="">— არაა —</option>
							{#each data.images as img (img.id)}
								<option value={img.id} selected={project.coverMediaId === img.id}>{img.filename}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span>რიგი</span>
						<input type="number" name="sort" value={project.sort} />
					</label>
				</div>
				<label class="field">
					<span>ფაქტები (თითო ხაზზე: სახელი = მნიშვნელობა)</span>
					<textarea name="facts" rows="4" placeholder="სიმძლავრე = 1300 მგვტ">{factsText}</textarea>
				</label>
			{/if}

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
			{#if project.status === 'draft'}
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
