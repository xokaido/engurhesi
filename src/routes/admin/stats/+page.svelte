<script lang="ts">
  import TriField from '$lib/components/admin/TriField.svelte';

  let { data, form } = $props();

  function labelFor(statId: string, locale: string): string {
    return data.i18n.find((r) => r.statId === statId && r.locale === locale)?.label ?? '';
  }
</script>

<svelte:head>
  <title>მაჩვენებლები — ადმინი</title>
</svelte:head>

<div class="admin-head">
  <h1>მაჩვენებლები (მთავარი გვერდის ციფრები)</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.warning}<p class="err-msg" role="alert">{form.warning}</p>{/if}
{#if form?.created || form?.saved}<p class="ok-msg" role="status">შენახულია</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<p class="muted auto-hint">
  🌐 საკმარისია ქართული წარწერა — ცარიელი EN/РУ ველები შენახვისას ავტომატურად ითარგმნება.
</p>

<div class="panel">
  <h2>ახალი მაჩვენებელი</h2>
  <form method="POST" action="?/create" class="actions-row" style="flex-wrap: wrap;">
    <input type="hidden" name="csrf" value={data.csrf} />
    <input type="text" name="key" placeholder="key (მაგ. capacity_mw)" required />
    <input type="text" name="value" placeholder="მნიშვნელობა (მაგ. 1300)" required />
    <input type="text" name="unit" placeholder="ერთეული (მაგ. მგვტ)" style="width: 8rem;" />
    <input
      type="text"
      name="label"
      placeholder="წარწერა (ქართულად)"
      required
      style="flex: 1; min-width: 12rem;"
    />
    <button class="btn" type="submit">დამატება</button>
  </form>
</div>

{#each data.items as item (item.id)}
  <div class="panel">
    <div class="actions-row" style="flex-wrap: wrap;">
      <code class="muted">{item.key}</code>
      <form method="POST" action="?/update" class="actions-row" style="flex: 1; flex-wrap: wrap;">
        <input type="hidden" name="csrf" value={data.csrf} />
        <input type="hidden" name="stat_id" value={item.id} />
        <input type="text" name="value" value={item.value} required style="width: 8rem;" />
        <input
          type="text"
          name="unit"
          value={item.unit ?? ''}
          placeholder="ერთეული"
          style="width: 7rem;"
        />
        <input type="number" name="sort" value={item.sort} style="width: 4.5rem;" />
        <button class="btn btn-sm btn-outline" type="submit">შენახვა</button>
      </form>
      <form
        method="POST"
        action="?/delete"
        onsubmit={(e) => {
          if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
        }}
      >
        <input type="hidden" name="csrf" value={data.csrf} />
        <input type="hidden" name="stat_id" value={item.id} />
        <button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
      </form>
    </div>
    <form
      method="POST"
      action="?/setLabels"
      class="actions-row"
      style="margin-top: var(--sp-1); align-items: flex-start;"
    >
      <input type="hidden" name="csrf" value={data.csrf} />
      <input type="hidden" name="stat_id" value={item.id} />
      <TriField
        name="label"
        ka={labelFor(item.id, 'ka')}
        en={labelFor(item.id, 'en')}
        ru={labelFor(item.id, 'ru')}
        placeholder="წარწერა"
      />
      <button class="btn btn-sm btn-outline" type="submit">შენახვა + თარგმნა</button>
    </form>
  </div>
{:else}
  <p class="muted">ჩანაწერები არ არის</p>
{/each}
