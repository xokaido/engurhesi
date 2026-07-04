<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Editor, Node, type Content } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';

	let {
		name,
		initialJson = '',
		images = []
	}: {
		/** hidden input name that carries the ProseMirror JSON */
		name: string;
		initialJson?: string;
		images?: Array<{ id: string; label: string }>;
	} = $props();

	let element: HTMLDivElement;
	let editor: Editor | undefined = $state();
	// svelte-ignore state_referenced_locally -- the initial value is intentional;
	// the editor takes over as the source of truth after mount
	let json = $state(initialJson);
	let imageDialog: HTMLDialogElement | undefined = $state();
	// tick to re-evaluate isActive() after each transaction
	let version = $state(0);

	/** Block image node referencing a media row by id — mirrors the server schema. */
	const MediaImageNode = Node.create({
		name: 'image',
		group: 'block',
		atom: true,
		addAttributes() {
			return { mediaId: { default: '' }, alt: { default: '' } };
		},
		parseHTML() {
			return [{ tag: 'img[data-media-id]' }];
		},
		renderHTML({ node }) {
			return [
				'img',
				{
					src: `/media/img/${node.attrs.mediaId}/card`,
					'data-media-id': node.attrs.mediaId,
					alt: node.attrs.alt
				}
			];
		}
	});

	onMount(() => {
		let content: Content | undefined;
		try {
			content = initialJson ? (JSON.parse(initialJson) as Content) : undefined;
		} catch {
			content = undefined;
		}

		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3, 4] },
					code: false,
					codeBlock: false,
					strike: false,
					underline: false,
					link: {
						openOnClick: false,
						protocols: ['http', 'https', 'mailto'],
						defaultProtocol: 'https'
					}
				}),
				MediaImageNode
			],
			content,
			onTransaction: () => {
				version += 1;
				if (editor) json = JSON.stringify(editor.getJSON());
			}
		});
		json = JSON.stringify(editor.getJSON());
	});

	onDestroy(() => editor?.destroy());

	function cmd(fn: (chain: ReturnType<Editor['chain']>) => { run: () => boolean }) {
		if (editor) fn(editor.chain().focus());
	}

	function setLink() {
		if (!editor) return;
		const previous = editor.getAttributes('link').href as string | undefined;
		const url = window.prompt('ბმული (URL):', previous ?? 'https://');
		if (url === null) return;
		if (url === '') {
			editor.chain().focus().unsetLink().run();
			return;
		}
		if (!/^(https?:|mailto:)/.test(url)) return;
		editor.chain().focus().setLink({ href: url }).run();
	}

	function insertImage(mediaId: string) {
		editor?.chain().focus().insertContent({ type: 'image', attrs: { mediaId, alt: '' } }).run();
		imageDialog?.close();
	}

	function active(nameOrAttrs: string, attrs?: Record<string, unknown>): boolean {
		void version;
		return editor?.isActive(nameOrAttrs, attrs) ?? false;
	}
</script>

<div class="rte">
	<div class="rte-toolbar" role="toolbar" aria-label="Formatting">
		<button type="button" class:on={active('bold')} onclick={() => cmd((c) => c.toggleBold())}>
			<strong>B</strong>
		</button>
		<button type="button" class:on={active('italic')} onclick={() => cmd((c) => c.toggleItalic())}>
			<em>I</em>
		</button>
		<button type="button" class:on={active('link')} onclick={setLink}>🔗</button>
		<span class="rte-sep"></span>
		<button
			type="button"
			class:on={active('heading', { level: 2 })}
			onclick={() => cmd((c) => c.toggleHeading({ level: 2 }))}
		>
			H2
		</button>
		<button
			type="button"
			class:on={active('heading', { level: 3 })}
			onclick={() => cmd((c) => c.toggleHeading({ level: 3 }))}
		>
			H3
		</button>
		<span class="rte-sep"></span>
		<button type="button" class:on={active('bulletList')} onclick={() => cmd((c) => c.toggleBulletList())}>
			• —
		</button>
		<button type="button" class:on={active('orderedList')} onclick={() => cmd((c) => c.toggleOrderedList())}>
			1. —
		</button>
		<button type="button" class:on={active('blockquote')} onclick={() => cmd((c) => c.toggleBlockquote())}>
			❝
		</button>
		<button type="button" onclick={() => cmd((c) => c.setHorizontalRule())}>―</button>
		{#if images.length > 0}
			<span class="rte-sep"></span>
			<button type="button" onclick={() => imageDialog?.showModal()}>🖼</button>
		{/if}
	</div>

	<div class="rte-body" bind:this={element}></div>
	<input type="hidden" {name} value={json} />
</div>

{#if images.length > 0}
	<dialog bind:this={imageDialog} class="rte-image-dialog">
		<h2>სურათის ჩასმა</h2>
		<div class="rte-image-grid">
			{#each images as image (image.id)}
				<button type="button" onclick={() => insertImage(image.id)}>
					<img src="/media/img/{image.id}/thumb" alt={image.label} loading="lazy" />
					<span>{image.label}</span>
				</button>
			{/each}
		</div>
		<button type="button" class="btn btn-sm btn-outline" onclick={() => imageDialog?.close()}>
			დახურვა
		</button>
	</dialog>
{/if}

<style>
	.rte {
		border: 1px solid var(--c-line);
		border-radius: var(--radius-sm);
		background: var(--c-surface);
	}

	.rte-toolbar {
		display: flex;
		gap: 2px;
		padding: 0.375rem;
		border-bottom: 1px solid var(--c-line);
		flex-wrap: wrap;
		background: var(--c-warm-100);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
	}

	.rte-toolbar button {
		min-width: 2.25rem;
		min-height: 2.25rem;
		border: 1px solid transparent;
		background: transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: var(--fs-sm);
		color: var(--c-ink-700);
	}

	.rte-toolbar button:hover {
		background: var(--c-primary-50);
	}

	.rte-toolbar button.on {
		background: var(--c-primary-100);
		border-color: var(--c-primary-700);
		color: var(--c-primary-900);
	}

	.rte-sep {
		width: 1px;
		background: var(--c-line);
		margin: 0.25rem 0.375rem;
	}

	.rte-body :global(.tiptap) {
		min-height: 14rem;
		padding: 0.875rem 1rem;
		outline: none;
	}

	.rte-body :global(.tiptap p) {
		margin: 0 0 0.75em;
	}

	.rte-body :global(.tiptap img) {
		max-width: 20rem;
		border-radius: var(--radius-sm);
	}

	.rte-body :global(.tiptap blockquote) {
		border-left: 3px solid var(--c-accent-500);
		margin-left: 0;
		padding-left: 1em;
		color: var(--c-ink-700);
	}

	.rte-image-dialog {
		border: none;
		border-radius: var(--radius);
		padding: var(--sp-3);
		max-width: 40rem;
	}

	.rte-image-dialog::backdrop {
		background: rgb(7 42 66 / 0.6);
	}

	.rte-image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 0.625rem;
		margin-bottom: var(--sp-2);
		max-height: 50vh;
		overflow-y: auto;
	}

	.rte-image-grid button {
		border: 1px solid var(--c-line);
		background: var(--c-surface);
		border-radius: var(--radius-sm);
		padding: 0.375rem;
		cursor: pointer;
		display: grid;
		gap: 0.25rem;
	}

	.rte-image-grid button:hover {
		border-color: var(--c-accent-500);
	}

	.rte-image-grid img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 4px;
	}

	.rte-image-grid span {
		font-size: var(--fs-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
