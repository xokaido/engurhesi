<script lang="ts">
  import { formatDateTime } from '$lib/i18n';

  let { data } = $props();

  const tiles = $derived([
    {
      href: '/admin/inbox',
      value: data.unhandledCount,
      label: 'წასაკითხი შეტყობინება',
      tone: data.unhandledCount > 0 ? 'amber' : 'ok'
    },
    {
      href: '/admin/procurement',
      value: data.deadlines.length,
      label: 'ვადის მოახლოებული შესყიდვა',
      tone: data.deadlines.length > 0 ? 'amber' : 'ok'
    },
    { href: '/admin/news', value: data.drafts.length, label: 'მონახაზი', tone: 'info' },
    {
      href: '/admin/jobs',
      value: data.runningJobs.length,
      label: 'აქტიური პროცესი',
      tone: data.runningJobs.some((j) => j.status === 'failed') ? 'alert' : 'info'
    }
  ]);
</script>

<svelte:head>
  <title>დაფა — ადმინი</title>
</svelte:head>

<div class="admin-head">
  <h1>დაფა</h1>
  <div class="actions-row">
    <a class="btn btn-sm" href="/admin/news">+ ახალი სიახლე</a>
    <a class="btn btn-sm btn-outline" href="/admin/procurement">+ ახალი შესყიდვა</a>
    <a class="btn btn-sm btn-outline" href="/admin/media">ფაილის ატვირთვა</a>
  </div>
</div>

<div class="tile-grid">
  {#each tiles as tile (tile.href + tile.label)}
    <a class="tile tone-{tile.tone}" href={tile.href}>
      <span class="tile-value">{tile.value}</span>
      <span class="tile-label">{tile.label}</span>
    </a>
  {/each}
</div>

<div class="panel-grid">
  <div class="panel">
    <div class="panel-head">
      <h2>ვადის მოახლოებული შესყიდვები (7 დღე)</h2>
      <a href="/admin/procurement">ყველა →</a>
    </div>
    {#if data.deadlines.length === 0}
      <p class="muted">ვადის მოახლოებული შესყიდვა არ არის.</p>
    {:else}
      <table class="admin">
        <tbody>
          {#each data.deadlines as item (item.id)}
            <tr>
              <td><a href="/admin/procurement/{item.id}">{item.slug}</a></td>
              <td>{item.kind === 'tender' ? 'ტენდერი' : 'აუქციონი'}</td>
              <td>{formatDateTime('ka', item.deadlineAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>ბოლო მონახაზები</h2>
      <a href="/admin/news">ყველა →</a>
    </div>
    {#if data.drafts.length === 0}
      <p class="muted">მონახაზები არ არის.</p>
    {:else}
      <table class="admin">
        <tbody>
          {#each data.drafts as draft (draft.id)}
            <tr>
              <td><a href="/admin/news/{draft.id}">{draft.slug}</a></td>
              <td class="muted">{formatDateTime('ka', draft.updatedAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <div class="panel">
    <div class="panel-head">
      <h2>მიმდინარე პროცესები</h2>
      <a href="/admin/jobs">ყველა →</a>
    </div>
    {#if data.runningJobs.length === 0}
      <p class="muted">აქტიური პროცესები არ არის.</p>
    {:else}
      <table class="admin">
        <tbody>
          {#each data.runningJobs as job (job.id)}
            <tr>
              <td><a href="/admin/jobs">{job.type}</a></td>
              <td><span class="badge">{job.status}</span></td>
              <td class="muted">{formatDateTime('ka', job.createdAt)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<style>
  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }

  .tile {
    display: grid;
    gap: 0.125rem;
    background: var(--c-surface);
    border: 1px solid var(--c-line);
    border-left-width: 4px;
    border-radius: var(--radius);
    padding: var(--sp-2) var(--sp-3);
    text-decoration: none;
    box-shadow: 0 1px 2px rgb(7 42 66 / 0.04);
    transition:
      box-shadow 0.2s ease,
      translate 0.2s ease;
  }

  .tile:hover {
    box-shadow: var(--shadow-card);
    translate: 0 -2px;
  }

  .tone-info {
    border-left-color: var(--c-accent-500);
  }

  .tone-ok {
    border-left-color: var(--c-green-600);
  }

  .tone-amber {
    border-left-color: var(--c-amber-600);
  }

  .tone-alert {
    border-left-color: var(--c-red-600);
  }

  .tile-value {
    font-size: 2rem;
    font-weight: 800;
    color: var(--c-primary-800);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }

  .tile-label {
    color: var(--c-ink-500);
    font-size: var(--fs-sm);
  }

  .panel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(24rem, 100%), 1fr));
    gap: var(--sp-3);
    align-items: start;
  }

  .panel-grid .panel {
    margin-bottom: 0;
  }

  .panel-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .panel-head a {
    font-size: var(--fs-xs);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }
</style>
