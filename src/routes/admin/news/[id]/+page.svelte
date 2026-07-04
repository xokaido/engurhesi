<script lang="ts">
	import LocaleTabs from '$lib/components/admin/LocaleTabs.svelte';
	import RichTextEditor from '$lib/components/admin/RichTextEditor.svelte';
	import { formatDateTime, type Locale } from '$lib/i18n';

	let { data, form } = $props();

	const article = $derived(data.article);
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

	let gallery = $state('');
	$effect(() => {
		gallery = data.gallery.join(',');
	});
</script>

<svelte:head>
	<title>რედაქტირება — სიახლე — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>{i18nFor('ka')?.title || article.slug}</h1>
	<div class="actions-row">
		<span class="badge {article.status === 'published' ? 'badge-green' : 'badge-amber'}">
			{article.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
		</span>
		{#if article.status === 'published'}
			<a class="btn btn-sm btn-outline" href="/ka/news/{article.slug}" target="_blank">ნახვა</a>
		{/if}
	</div>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.saved}<p class="ok-msg" role="status">შენახულია ({form.locale})</p>{/if}
{#if form?.published}<p class="ok-msg" role="status">გამოქვეყნდა</p>{/if}
{#if form?.unpublished}<p class="ok-msg" role="status">გამოქვეყნება გაუქმდა</p>{/if}
{#if form?.translated}<p class="ok-msg" role="status">თარგმანი შესრულდა (EN + RU)</p>{/if}
{#if form?.restored}<p class="ok-msg" role="status">ვერსია აღდგა</p>{/if}

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
				<span>ანონსი (excerpt)</span>
				<textarea name="excerpt" rows="2">{row?.excerpt ?? ''}</textarea>
			</label>

			<label class="field">
				<span>SEO აღწერა</span>
				<textarea name="seo_description" rows="2">{row?.seoDescription ?? ''}</textarea>
			</label>

			<div class="field">
				<span>ტექსტი</span>
				<RichTextEditor name="body" initialJson={row?.bodyJson ?? ''} images={imageOptions} />
			</div>

			{#if locale === 'ka'}
				<div class="form-row">
					<label class="field">
						<span>კატეგორია</span>
						<select name="category">
							<option value="news" selected={article.category === 'news'}>სიახლე</option>
							<option value="announcement" selected={article.category === 'announcement'}>განცხადება</option>
							<option value="publication" selected={article.category === 'publication'}>პუბლიკაცია</option>
						</select>
					</label>
					<label class="field">
						<span>Slug {article.status === 'published' ? '(შეცვლისას ავტომატური redirect)' : ''}</span>
						<input type="text" name="slug" value={article.slug} pattern="[a-z0-9\-]+" />
					</label>
					<label class="field">
						<span>ყდის სურათი</span>
						<select name="cover_media_id">
							<option value="">— არცერთი —</option>
							{#each data.images as image (image.id)}
								<option value={image.id} selected={article.coverMediaId === image.id}>
									{image.filename}
								</option>
							{/each}
						</select>
					</label>
				</div>

				<label class="field">
					<span>გალერეა (მედია ID-ები, მძიმით)</span>
					<input type="text" name="gallery" bind:value={gallery} />
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
			{#if article.status === 'draft'}
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
		{:else}
			<span class="muted">თარგმნა მიუწვდომელია — OPENROUTER_API_KEY არ არის კონფიგურირებული</span>
		{/if}

		{#if canPublish}
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

{#if data.revisions.length > 0}
	<div class="panel">
		<h2>ვერსიების ისტორია</h2>
		<table class="admin">
			<thead>
				<tr><th>ვერსია</th><th>ენა</th><th>სათაური</th><th>დრო</th><th></th></tr>
			</thead>
			<tbody>
				{#each data.revisions as revision (revision.id)}
					<tr>
						<td>#{revision.version}</td>
						<td>{revision.locale}</td>
						<td>{revision.title}</td>
						<td class="muted">{formatDateTime('ka', revision.createdAt)}</td>
						<td>
							<form method="POST" action="?/restore">
								<input type="hidden" name="csrf" value={data.csrf} />
								<input type="hidden" name="revision_id" value={revision.id} />
								<button class="btn btn-sm btn-outline" type="submit">აღდგენა</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
