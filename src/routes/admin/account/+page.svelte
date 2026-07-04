<script lang="ts">
	import { formatDateTime } from '$lib/i18n';

	let { data, form } = $props();

	const ROLE_LABEL: Record<string, string> = {
		admin: 'ადმინისტრატორი',
		editor: 'რედაქტორი',
		draft_editor: 'მონახაზების რედაქტორი'
	};
</script>

<svelte:head>
	<title>ჩემი ანგარიში — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>ჩემი ანგარიში</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.passwordChanged}<p class="ok-msg" role="status">პაროლი შეიცვალა — სხვა სესიები გაუქმდა</p>{/if}
{#if form?.revoked}<p class="ok-msg" role="status">სხვა სესიები გაუქმდა</p>{/if}

<div class="panel">
	<h2>პროფილი</h2>
	<p><strong>{data.user.name}</strong> — {data.user.email}</p>
	<p class="muted">{ROLE_LABEL[data.user.role]}</p>
</div>

<div class="panel">
	<h2>პაროლის შეცვლა</h2>
	<form method="POST" action="?/changePassword" style="max-width: 26rem; display: grid; gap: var(--sp-2);">
		<input type="hidden" name="csrf" value={data.csrf} />
		<label class="field">
			<span>მიმდინარე პაროლი</span>
			<input type="password" name="current" required autocomplete="current-password" />
		</label>
		<label class="field">
			<span>ახალი პაროლი (მინ. 12 სიმბოლო)</span>
			<input type="password" name="next" required minlength="12" autocomplete="new-password" />
		</label>
		<label class="field">
			<span>გაიმეორეთ ახალი პაროლი</span>
			<input type="password" name="confirm" required minlength="12" autocomplete="new-password" />
		</label>
		<div><button class="btn" type="submit">შეცვლა</button></div>
	</form>
</div>

<div class="panel">
	<h2>აქტიური სესიები ({data.sessions.length})</h2>
	<table class="admin">
		<thead>
			<tr><th>შეიქმნა</th><th>ბოლო აქტივობა</th><th>IP</th><th>ბრაუზერი</th></tr>
		</thead>
		<tbody>
			{#each data.sessions as session (session.id)}
				<tr>
					<td class="muted">{formatDateTime('ka', session.createdAt)}</td>
					<td class="muted">{formatDateTime('ka', session.lastSeenAt)}</td>
					<td class="muted">{session.ip ?? '—'}</td>
					<td class="muted" style="max-width: 18rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
						{session.userAgent ?? '—'}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	<form method="POST" action="?/revokeOtherSessions" style="margin-top: var(--sp-2);">
		<input type="hidden" name="csrf" value={data.csrf} />
		<button class="btn btn-outline" type="submit">სხვა სესიების გაუქმება</button>
	</form>
</div>
