<script lang="ts">
  import Delete from "./icons/Delete.svelte";
  import Redo from "./icons/Redo.svelte";
  import Undo from "./icons/Undo.svelte";

  export let type: "Delete" | "Undo" | "Redo";
</script>

<button
  {...$$restProps}
  on:click
  class="flex flex-col items-center p-2 hover:bg-gray-50 rounded disabled:text-gray-300"
>
  <div>
    {#if type === "Delete"}
      <Delete class="h-8 w-8" />
    {:else if type === "Undo"}
      <Undo class="h-8 w-8" />
    {:else if type === "Redo"}
      <Redo class="h-8 w-8" />
    {/if}
  </div>
  <div class="text-xs">{type}</div>
</button>
