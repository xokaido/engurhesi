<script lang="ts">
	let { data, form } = $props();

	function titleFor(unitId: string, locale = 'ka'): string {
		return data.i18n.find((r) => r.orgUnitId === unitId && r.locale === locale)?.title ?? '';
	}
	function personFor(unitId: string, locale = 'ka'): string {
		return data.i18n.find((r) => r.orgUnitId === unitId && r.locale === locale)?.personName ?? '';
	}
	function depthOf(unitId: string): number {
		let depth = 0;
		let current = data.units.find((u) => u.id === unitId);
		while (current?.parentId) {
			depth++;
			current = data.units.find((u) => u.id === current!.parentId);
			if (depth > 10) break;
		}
		return depth;
	}

	// render parents before children
	const ordered = $derived.by(() => {
		const result: typeof data.units = [];
		const visit = (parentId: string | null) => {
			for (const unit of data.units.filter((u) => u.parentId === parentId)) {
				result.push(unit);
				visit(unit.id);
			}
		};
		visit(null);
		return result;
	});
</script>

<svelte:head>
	<title>სტრუქტურა — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>ორგანიზაციული სტრუქტურა</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.created || form?.saved}<p class="ok-msg" role="status">შენახულია</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<div class="panel">
	<h2>ახალი ერთეული</h2>
	<form method="POST" action="?/create" class="actions-row" style="flex-wrap: wrap;">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="დასახელება (ქართულად)" required style="flex: 1; min-width: 12rem;" />
		<input type="text" name="person" placeholder="პირის სახელი (არასავალდ.)" />
		<select name="parent_id">
			<option value="">— ზედა დონე —</option>
			{#each ordered as unit (unit.id)}
				<option value={unit.id}>{'—'.repeat(depthOf(unit.id))} {titleFor(unit.id)}</option>
			{/each}
		</select>
		<button class="btn" type="submit">დამატება</button>
	</form>
</div>

{#each ordered as unit (unit.id)}
	<div class="panel" style="margin-left: {depthOf(unit.id) * 1.5}rem;">
		<div class="actions-row" style="flex-wrap: wrap;">
			<strong>{titleFor(unit.id)}</strong>
			{#if personFor(unit.id)}<span class="muted">— {personFor(unit.id)}</span>{/if}
			<form method="POST" action="?/move" class="actions-row" style="margin-left: auto;">
				<input type="hidden" name="csrf" value={data.csrf} />
				<input type="hidden" name="unit_id" value={unit.id} />
				<select name="parent_id">
					<option value="">— ზედა დონე —</option>
					{#each ordered.filter((u) => u.id !== unit.id) as other (other.id)}
						<option value={other.id} selected={unit.parentId === other.id}>
							{'—'.repeat(depthOf(other.id))} {titleFor(other.id)}
						</option>
					{/each}
				</select>
				<input type="number" name="sort" value={unit.sort} style="width: 4.5rem;" />
				<button class="btn btn-sm btn-outline" type="submit">გადატანა</button>
			</form>
			<form
				method="POST"
				action="?/delete"
				onsubmit={(e) => {
					if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
				}}
			>
				<input type="hidden" name="csrf" value={data.csrf} />
				<input type="hidden" name="unit_id" value={unit.id} />
				<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
			</form>
		</div>
		<form method="POST" action="?/setI18n" class="actions-row" style="margin-top: var(--sp-1);">
			<input type="hidden" name="csrf" value={data.csrf} />
			<input type="hidden" name="unit_id" value={unit.id} />
			<select name="locale">
				<option value="ka">ქა</option>
				<option value="en">EN</option>
				<option value="ru">РУ</option>
			</select>
			<input type="text" name="title" placeholder="დასახელება" required />
			<input type="text" name="person" placeholder="პირის სახელი" />
			<button class="btn btn-sm btn-outline" type="submit">შენახვა</button>
			<span class="muted">EN: {titleFor(unit.id, 'en') || '—'} · РУ: {titleFor(unit.id, 'ru') || '—'}</span>
		</form>
	</div>
{:else}
	<p class="muted">ჩანაწერები არ არის</p>
{/each}
