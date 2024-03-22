import {
  defaultScope,
  type UndoRedoManager,
  type UndoRedoOptions,
} from "@onsetsoftware/automerge-repo-undo-redo";
import { derived, writable, type Readable } from "svelte/store";

export class UndoRedoStore {
  #undoRedoManager: UndoRedoManager;

  #undos = writable<Record<string | symbol, (string | undefined)[]>>({});
  #redos = writable<Record<string | symbol, (string | undefined)[]>>({});

  #undoStacks: Record<string | symbol, Readable<(string | undefined)[]>> = {};
  #redoStacks: Record<string | symbol, Readable<(string | undefined)[]>> = {};

  constructor(undoRedoManager: UndoRedoManager) {
    this.#undoRedoManager = undoRedoManager;
  }

  #transaction(fn: () => string | void, options?: UndoRedoOptions<unknown> | string): void {
    if (typeof options === "string") {
      options = { description: options };
    }
    const changes = this.#undoRedoManager.transaction(fn, options);
    if (changes) {
      this.#updateStores(changes.scope);
    }
  }

  get transaction() {
    return this.#transaction.bind(this);
  }

  undo(scope: string | symbol = defaultScope): void {
    const change = this.#undoRedoManager.undo(scope);
    if (change) {
      this.#updateStores(change.scope);
    }
  }

  redo(scope: string | symbol = defaultScope): void {
    const change = this.#undoRedoManager.redo(scope);
    if (change) {
      this.#updateStores(change.scope);
    }
  }

  #updateStores = (scope: string | symbol = defaultScope) => {
    this.#undos.update((undos) => {
      undos[scope] = this.#undoRedoManager.undos(scope);
      return undos;
    });
    this.#redos.update((redos) => {
      redos[scope] = this.#undoRedoManager.redos(scope);
      return redos;
    });
  };

  undos(scope: string | symbol = defaultScope) {
    return (this.#undoStacks[scope] ??= derived(this.#undos, ($undos) => $undos[scope] ?? []));
  }

  redos(scope: string | symbol = defaultScope) {
    return (this.#redoStacks[scope] ??= derived(this.#redos, ($redos) => $redos[scope] ?? []));
  }
}
