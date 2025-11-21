<script setup lang="ts">
const highlights = [
  { label: 'Timelines created', value: '128' },
  { label: 'Active collaborators', value: '42' },
  { label: 'Moments synced today', value: '356' },
]
</script>

<template>
  <div class="page">
    <header class="page__header">
      <span class="badge">Momento</span>
      <h1>Capture the moments that move your team forward.</h1>
      <p>
        Momento is a calm workspace for writing, sharing, and revisiting the
        highlights that define a product journey. Keep things simple, focused,
        and human.
      </p>
      <button class="primary">Start writing</button>
    </header>

    <section class="stats" aria-label="Team snapshot">
      <article v-for="item in highlights" :key="item.label">
        <p class="stats__label">{{ item.label }}</p>
        <p class="stats__value">{{ item.value }}</p>
      </article>
    </section>

    <footer class="page__footer">
      <small>Momento · Crafted with Vue 3 + Vite</small>
    </footer>
  </div>
</template>
