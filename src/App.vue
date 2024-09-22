<script setup lang="ts">
import VoiceTranslate from './components/VoiceTranslate.vue'

</script>

<template>
  <div>
    <a href="" target="_blank">
      <img src="./assets/laptop-hero.webp" class="logo vue" alt="Vue logo" />
    </a>
    <div>
      <voice-translate></voice-translate>
    </div>
  </div>
</template>

<style scoped>
.logo {
  height: 18em;
  padding: 0.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #8542b8aa);
}
</style>
