<script lang="ts">
	import { formatDateTime } from '$lib/i18n';

	let { data, form } = $props();

	const STATUS_LABEL: Record<string, string> = {
		queued: 'რიგში',
		running: 'მიმდინარე',
		done: 'დასრულებული',
		failed: 'შეცდომით',
		dead: 'შეჩერებული (dead)'
	};

	function itemsFor(jobId: string) {
		return data.items.filter((i) => i.jobId === jobId);
	}
	function progressFor(jobId: string): string {
		const items = itemsFor(jobId);
		const done = items.filter((i) => i.status === 'done').length;
		return `${done}/${items.length}`;
	}
</script>

<svelte:head>
	<title>სამუშაოები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>ფონური სამუშაოები</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.queued}<p class="ok-msg" role="status">რიგში ჩადგა {form.queued} ერთეული</p>{/if}
{#if form?.retried}<p class="ok-msg" role="status">ხელახლა გაეშვა</p>{/if}

<div class="panel">
	<h2>თარგმანის ბექფილი</h2>
	<p class="muted">ყველა გამოქვეყნებული სიახლისთვის, რომელსაც აკლია EN ან RU თარგმანი.</p>
	<form method="POST" action="?/translateBackfill">
		<input type="hidden" name="csrf" value={data.csrf} />
		<button class="btn" type="submit">გაშვება</button>
	</form>
</div>

{#each data.jobs as job (job.id)}
	<div class="panel">
		<div class="admin-head" style="margin-bottom: var(--sp-1);">
			<h2 style="font-size: 1rem;">{job.type} <span class="muted">· {progressFor(job.id)}</span></h2>
			<div class="actions-row">
				<span
					class="badge {job.status === 'done'
						? 'badge-green'
						: job.status === 'failed'
							? 'badge-red'
							: 'badge-amber'}"
				>
					{STATUS_LABEL[job.status] ?? job.status}
				</span>
				<span class="muted">{formatDateTime('ka', job.createdAt)}</span>
			</div>
		</div>
		{#if itemsFor(job.id).some((i) => i.status === 'failed' || i.status === 'dead')}
			<table class="admin">
				<tbody>
					{#each itemsFor(job.id).filter((i) => i.status === 'failed' || i.status === 'dead') as item (item.id)}
						<tr>
							<td>{item.entityRef}</td>
							<td><span class="badge badge-red">{STATUS_LABEL[item.status]}</span></td>
							<td class="muted">{item.lastError ?? ''}</td>
							<td>
								<form method="POST" action="?/retryItem">
									<input type="hidden" name="csrf" value={data.csrf} />
									<input type="hidden" name="item_id" value={item.id} />
									<button class="btn btn-sm btn-outline" type="submit">ხელახლა</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
{:else}
	<p class="muted">სამუშაოები არ არის</p>
{/each}
