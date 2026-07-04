<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>ტერმინოლოგია — ადმინი</title>
</svelte:head>

<div class="admin-head">
  <h1>ტერმინოლოგია (თარგმანის ლექსიკონი)</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.warning}<p class="err-msg" role="alert">{form.warning}</p>{/if}
{#if form?.created || form?.saved}<p class="ok-msg" role="status">შენახულია</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<p class="muted" style="font-size: 0.85rem;">
  ეს ტერმინები ეგზავნება მთარგმნელ მოდელს, რომ ოფიციალური სახელები ერთნაირად ითარგმნოს. 🌐
  საკმარისია ქართული ტერმინი — ცარიელი EN/РУ ველები ავტომატურად ითარგმნება.
</p>

<div class="panel">
  <h2>ახალი ტერმინი</h2>
  <form method="POST" action="?/create" class="actions-row" style="flex-wrap: wrap;">
    <input type="hidden" name="csrf" value={data.csrf} />
    <input type="text" name="term_ka" placeholder="ქართული" required />
    <input type="text" name="term_en" placeholder="English (ავტო)" />
    <input type="text" name="term_ru" placeholder="Русский (ავტო)" />
    <input type="text" name="note" placeholder="შენიშვნა (არასავალდ.)" />
    <button class="btn" type="submit">დამატება</button>
  </form>
</div>

{#each data.items as item (item.id)}
  <div class="panel">
    <form method="POST" action="?/update" class="actions-row" style="flex-wrap: wrap;">
      <input type="hidden" name="csrf" value={data.csrf} />
      <input type="hidden" name="id" value={item.id} />
      <input type="text" name="term_ka" value={item.termKa} required />
      <input type="text" name="term_en" value={item.termEn} placeholder="English (ავტო)" />
      <input type="text" name="term_ru" value={item.termRu} placeholder="Русский (ავტო)" />
      <input type="text" name="note" value={item.note ?? ''} placeholder="შენიშვნა" />
      <span class="muted">v{item.version}</span>
      <button class="btn btn-sm btn-outline" type="submit">შენახვა</button>
    </form>
    <form
      method="POST"
      action="?/delete"
      style="margin-top: var(--sp-1);"
      onsubmit={(e) => {
        if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
      }}
    >
      <input type="hidden" name="csrf" value={data.csrf} />
      <input type="hidden" name="id" value={item.id} />
      <button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
    </form>
  </div>
{:else}
  <p class="muted">ტერმინები არ არის</p>
{/each}
