<script lang="ts">
	import { formatDate } from '$lib/i18n';

	let { data, form } = $props();

	const ROLE_LABEL: Record<string, string> = {
		admin: 'ადმინისტრატორი',
		editor: 'რედაქტორი',
		draft_editor: 'მონახაზების რედაქტორი'
	};

	function isLocked(lockedUntil: string | null): boolean {
		return !!lockedUntil && new Date(lockedUntil) > new Date();
	}
</script>

<svelte:head>
	<title>მომხმარებლები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>მომხმარებლები</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.tempPassword}
	<div class="panel" style="border: 2px solid var(--c-amber, #d97706);">
		<h2>დროებითი პაროლი — გადაეცით უსაფრთხო არხით</h2>
		<p>
			<strong>{form.email}</strong>:
			<code style="font-size: 1.1rem; user-select: all;">{form.tempPassword}</code>
		</p>
		<p class="muted">ეს პაროლი მხოლოდ ერთხელ ჩანს.</p>
	</div>
{/if}
{#if form?.roleSaved}<p class="ok-msg" role="status">როლი შეიცვალა</p>{/if}
{#if form?.unlocked}<p class="ok-msg" role="status">ანგარიში განიბლოკა</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">მომხმარებელი წაიშალა</p>{/if}

<div class="panel">
	<h2>ახალი მომხმარებელი</h2>
	<form method="POST" action="?/create" class="actions-row" style="flex-wrap: wrap;">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="email" name="email" placeholder="ელფოსტა" required style="min-width: 14rem;" />
		<input type="text" name="name" placeholder="სახელი" required />
		<select name="role">
			<option value="draft_editor">მონახაზების რედაქტორი</option>
			<option value="editor">რედაქტორი</option>
			<option value="admin">ადმინისტრატორი</option>
		</select>
		<button class="btn" type="submit">შექმნა</button>
	</form>
	<p class="muted" style="margin-top: var(--sp-1); font-size: 0.85rem;">
		მონახაზების რედაქტორი ვერ აქვეყნებს და ვერ ტვირთავს ფაილებს.
	</p>
</div>

<table class="admin">
	<thead>
		<tr><th>ელფოსტა</th><th>სახელი</th><th>როლი</th><th>სტატუსი</th><th>მოქმედებები</th></tr>
	</thead>
	<tbody>
		{#each data.items as user (user.id)}
			<tr>
				<td>{user.email}{#if user.id === data.selfId}<span class="muted"> (თქვენ)</span>{/if}</td>
				<td>{user.name}</td>
				<td>
					{#if user.id === data.selfId}
						{ROLE_LABEL[user.role]}
					{:else}
						<form method="POST" action="?/setRole" class="actions-row">
							<input type="hidden" name="csrf" value={data.csrf} />
							<input type="hidden" name="user_id" value={user.id} />
							<select name="role">
								{#each Object.entries(ROLE_LABEL) as [value, label] (value)}
									<option {value} selected={user.role === value}>{label}</option>
								{/each}
							</select>
							<button class="btn btn-sm btn-outline" type="submit">OK</button>
						</form>
					{/if}
				</td>
				<td>
					{#if isLocked(user.lockedUntil)}
						<span class="badge badge-red">დაბლოკილი</span>
					{:else}
						<span class="muted">{formatDate('ka', user.createdAt)}</span>
					{/if}
				</td>
				<td>
					<div class="actions-row" style="flex-wrap: wrap;">
						<form
							method="POST"
							action="?/resetPassword"
							onsubmit={(e) => {
								if (!confirm('პაროლი გადაყენდეს? ყველა სესია გაუქმდება.')) e.preventDefault();
							}}
						>
							<input type="hidden" name="csrf" value={data.csrf} />
							<input type="hidden" name="user_id" value={user.id} />
							<button class="btn btn-sm btn-outline" type="submit">პაროლის გადაყენება</button>
						</form>
						{#if isLocked(user.lockedUntil)}
							<form method="POST" action="?/unlock">
								<input type="hidden" name="csrf" value={data.csrf} />
								<input type="hidden" name="user_id" value={user.id} />
								<button class="btn btn-sm" type="submit">განბლოკვა</button>
							</form>
						{/if}
						{#if user.id !== data.selfId}
							<form
								method="POST"
								action="?/delete"
								onsubmit={(e) => {
									if (!confirm('ნამდვილად წაიშალოს მომხმარებელი?')) e.preventDefault();
								}}
							>
								<input type="hidden" name="csrf" value={data.csrf} />
								<input type="hidden" name="user_id" value={user.id} />
								<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
							</form>
						{/if}
					</div>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
