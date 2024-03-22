<script lang="ts">
  import Grid from "$lib/components/Grid.svelte";
  import {
    Repo,
    type DocumentId,
    DocHandle,
    type DocHandleEphemeralMessagePayload,
  } from "@automerge/automerge-repo";
  import { AutomergeRepoUndoRedo, UndoRedoManager } from "@onsetsoftware/automerge-repo-undo-redo";
  import { onMount, setContext } from "svelte";
  import { getParams, setParams } from "$lib/helpers/url";
  import type { GridData, GridState } from "$lib/types/grid-data.type";
  import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
  import { BroadcastChannelNetworkAdapter } from "@automerge/automerge-repo-network-broadcastchannel";
  import { createEntityState } from "$lib/helpers/entity-state";
  import { nanoid } from "nanoid";
  import { UndoRedoStore } from "$lib/undo-redo-store";
  import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";

  const initialData: GridData = {
    children: createEntityState([{ x: 1, y: 1, w: 2, h: 2, id: nanoid() }]),
    rows: 3,
  };

  const initialState: GridState = {
    selected: [],
  };

  let handle: DocHandle<GridData>;
  let state: DocHandle<GridState>;
  let undoHandle: AutomergeRepoUndoRedo<GridData>;
  let stateHandle: AutomergeRepoUndoRedo<GridState>;

  const rootUndoManager = new UndoRedoManager();

  setContext("undoManager", rootUndoManager);
  const undoStore = new UndoRedoStore(rootUndoManager);
  setContext("undoStore", undoStore);

  onMount(() => {
    const repo = new Repo({
      storage: new IndexedDBStorageAdapter("undo-redo-tests"),
      network: [
        new BroadcastChannelNetworkAdapter({ channelName: "undo-redo-tests" }),
        new BrowserWebSocketClientAdapter("wss://sync.automerge.org"),
      ],
    });

    const params = getParams();
    const id = params.id as DocumentId | undefined;
    handle = id ? repo.find(id) : repo.create(initialData);

    const stateId = params.state as DocumentId | undefined;
    state = stateId ? repo.find(stateId) : repo.create(initialState);

    const setStateHandle = (newState: DocHandle<GridState>) => {
      state = newState;
      state.off("ephemeral-message", recieveMessage);
      state.on("ephemeral-message", recieveMessage);
      stateHandle = rootUndoManager.addHandle(state);
      setParams({ id: handle.documentId, state: state.documentId });
    };

    const recieveMessage = ({ message }: DocHandleEphemeralMessagePayload<GridState>) => {
      if (message === "knock-knock") {
        state.broadcast("who's there?");
        return;
      }
      if (message === "who's there?") {
        const newState = repo.clone(state);
        newState.whenReady().then(() => {
          setStateHandle(newState);
        });
      }
    };

    state.whenReady().then(() => {
      setTimeout(() => {
        state.broadcast("knock-knock");
      });
    });

    state.on("ephemeral-message", recieveMessage);
    setParams({ id: handle.documentId, state: state.documentId });
    undoHandle = rootUndoManager.addHandle(handle);
    stateHandle = rootUndoManager.addHandle(state);

    return () => {
      state.off("ephemeral-message", recieveMessage);
    };
  });
</script>

{#if undoHandle}
  {#await Promise.all([handle.whenReady(), state.whenReady()])}
    <p>Loading...</p>
  {:then}
    <Grid {undoHandle} {stateHandle} />
  {/await}
{/if}
