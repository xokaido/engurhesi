<script lang="ts">
	import OrgTree from './OrgTree.svelte';

	interface Node {
		id: string;
		title: string;
		personName: string | null;
		children: Node[];
	}

	let { nodes, depth = 0 }: { nodes: Node[]; depth?: number } = $props();
</script>

<ul class="org-level" class:root={depth === 0}>
	{#each nodes as node (node.id)}
		<li>
			<div class="org-node" class:lead={depth === 0}>
				<span class="org-title">{node.title}</span>
				{#if node.personName}
					<span class="org-person">{node.personName}</span>
				{/if}
			</div>
			{#if node.children.length > 0}
				<OrgTree nodes={node.children} depth={depth + 1} />
			{/if}
		</li>
	{/each}
</ul>

<style>
	.org-level {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.625rem;
	}

	.org-level:not(.root) {
		margin-top: 0.625rem;
		padding-left: 1.5rem;
		border-left: 2px solid var(--c-line);
	}

	.org-node {
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		border-radius: var(--radius-sm);
		padding: 0.625rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.org-node.lead {
		border-left: 4px solid var(--c-accent-500);
	}

	.org-title {
		font-weight: 700;
		color: var(--c-primary-900);
		font-size: var(--fs-sm);
	}

	.org-person {
		color: var(--c-ink-500);
		font-size: var(--fs-xs);
	}
</style>
