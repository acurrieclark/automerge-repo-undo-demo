<script lang="ts">
  import { addEntity, deleteEntity } from "@onsetsoftware/mutable-js";
  import type { GridData, GridState } from "$lib/types/grid-data.type";
  import type { DocHandleChangePayload } from "@automerge/automerge-repo";
  import type { AutomergeRepoUndoRedo } from "@onsetsoftware/automerge-repo-undo-redo";
  import {
    GridStack,
    type GridItemHTMLElement,
    type GridStackNode,
    type GridStackOptions,
  } from "gridstack";
  import "gridstack/dist/gridstack.min.css";
  import { nanoid } from "nanoid";
  import { getContext, onDestroy, tick } from "svelte";
  import { derived, readable } from "svelte/store";
  import Button from "./menu/Button.svelte";
  import type { UndoRedoStore } from "$lib/undo-redo-store";
  import { getHeads } from "@automerge/automerge";
  import { toast } from "svelte-sonner";

  export let undoHandle: AutomergeRepoUndoRedo<GridData>;
  export let stateHandle: AutomergeRepoUndoRedo<GridState>;

  const undoStore = getContext<UndoRedoStore>("undoStore");
  const { transaction } = undoStore;

  const undos = undoStore.undos();
  const redos = undoStore.redos();

  let gridContainer: HTMLDivElement;

  let grid: GridStack;

  let columns = 24;

  let rowHeight = 33;

  $: grid?.column(columns);

  let savedGrid: GridStackOptions;

  const boxes: Record<string, GridItemHTMLElement> = {};

  const unlisteners: (() => void)[] = [];

  const gridData = readable<GridData>(undoHandle.handle.docSync(), (set) => {
    const listener = (data: DocHandleChangePayload<GridData>) => {
      set(data.doc);

      console.log(JSON.parse(JSON.stringify(data.doc.children)), getHeads(data.doc), data.patches);
    };

    undoHandle.handle.on("change", listener);

    return () => {
      undoHandle.handle.off("change", listener);
    };
  });

  const gridState = readable<GridState>(stateHandle.handle.docSync(), (set) => {
    const listener = (data: DocHandleChangePayload<GridState>) => {
      set(data.doc);
    };

    stateHandle.handle.on("change", listener);

    return () => {
      stateHandle.handle.off("change", listener);
    };
  });

  const selected = derived(gridState, ($gridState) => {
    return $gridState.selected;
  });

  $: setSelected($gridState.selected);

  const setSelected = (selected: string[]) => {
    Object.values(boxes).forEach((box) => {
      if (selected.includes(box.gridstackNode?.id ?? "")) {
        box.classList.add("selected");
      } else {
        box.classList.remove("selected");
      }
    });
  };

  const clickBox = (id: string, event: MouseEvent) => {
    stateHandle.handle.change((doc) => {
      if (event.metaKey) {
        if (doc.selected.includes(id)) {
          doc.selected = doc.selected.filter((s) => s !== id);
        } else {
          doc.selected.push(id);
        }
      } else {
        doc.selected = [id];
      }
    });
  };

  const initGrid = async (columns: number, data: GridData) => {
    saveGrid();
    destroyGrid();

    const rows = data.rows ?? 3;

    const defaultGrid = {
      children: [],
      animate: false,
      float: true,
      row: rows,
      column: columns,
      margin: 0,
      cellHeight: rowHeight,
      resizable: {
        handles: "all",
      },
    };

    const gridToUse = savedGrid
      ? { ...savedGrid, cellHeight: rowHeight, column: columns, row: rows, children: [] }
      : defaultGrid;

    const children = Object.values(data.children.entities);

    grid = GridStack.init(gridToUse, gridContainer)
      .on("added", (_: Event, items: GridStackNode[]) => {
        items.forEach((item) => {
          if (item.el === undefined || item.id === undefined) {
            return;
          }

          if (!$gridData.children.ids.includes(item.id)) {
            transaction(() => {
              undoHandle.change((doc) => {
                if (item.id) {
                  addEntity(doc.children, {
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                    id: item.id,
                  });
                }
              });

              stateHandle.change((doc) => {
                if (item.id) {
                  doc.selected = [item.id];
                }
              });
            }, "Add Box");
            toast.success("Box added", {
              action: {
                label: "Undo",
                onClick: () => {
                  undoStore.undo();
                },
              },
            });
          }

          boxes[item.id] = item.el;
          const listener = (event: MouseEvent) => {
            if (item.el === undefined || item.id === undefined) {
              return;
            }
            clickBox(item.id, event);
          };
          item.el?.addEventListener("click", listener);

          unlisteners.push(() => {
            item.el?.removeEventListener("click", listener);
          });
        });
      })
      .on("dragstart", (_: Event, el: GridItemHTMLElement) => {
        manipulatingCell = true;
        if (el === undefined) {
          return;
        }
      })
      .on("dragstop", (_: Event, el: GridItemHTMLElement) => {
        manipulatingCell = false;
        if (el === undefined) {
          return;
        }

        transaction(() => {
          stateHandle.handle.change((doc) => {
            if (el.gridstackNode?.id === undefined) {
              return;
            }
            doc.selected = [el.gridstackNode.id];
          });

          undoHandle.change((doc) => {
            if (el.gridstackNode?.id === undefined) {
              return;
            }
            const entity = doc.children.entities[el.gridstackNode.id];
            if (entity) {
              entity.x = el.gridstackNode.x;
              entity.y = el.gridstackNode.y;
            }
          });
        }, "Move Box");

        toast.success("Box moved", {
          action: {
            label: "Undo",
            onClick: () => {
              undoStore.undo();
            },
          },
        });
      })
      .on("resizestart", (_: Event, el: GridItemHTMLElement) => {
        manipulatingCell = true;
        if (el === undefined) {
          return;
        }
      })
      .on("resizestop", (_: Event, el: GridItemHTMLElement) => {
        manipulatingCell = false;
        if (el === undefined) {
          return;
        }

        transaction(() => {
          stateHandle.handle.change((doc) => {
            if (el.gridstackNode?.id === undefined) {
              return;
            }
            doc.selected = [el.gridstackNode.id];
          });
          undoHandle.change((doc) => {
            if (el.gridstackNode?.id === undefined) {
              return;
            }
            const entity = doc.children.entities[el.gridstackNode.id];
            if (entity) {
              entity.x = el.gridstackNode.x;
              entity.y = el.gridstackNode.y;
              entity.w = el.gridstackNode.w;
              entity.h = el.gridstackNode.h;
            }
          });
        }, "Resize Box");
        toast.success("Box resized", {
          action: {
            label: "Undo",
            onClick: () => {
              undoStore.undo();
            },
          },
        });
      });

    grid.load(children ?? []);

    tick().then(() => {
      setSelected($gridState.selected);
    });
  };

  const saveGrid = () => {
    if (grid !== undefined) {
      savedGrid = grid.save(true, true) as GridStackOptions;
    }
  };

  const destroyGrid = () => {
    if (grid !== undefined) {
      grid.removeAll();
      grid.destroy(false);
      unlisteners.forEach((unlistener) => {
        unlistener();
      });
    }
  };

  $: {
    if (gridContainer !== undefined) {
      initGrid(columns, $gridData);
    }
  }

  let previousPointerOffset: { x: number; y: number } | null = null;

  // returns n, s, e, w, ne, nw, se, sw depending on which side or corner we are near
  const resizeDirection = (pointerOffset: { x: number; y: number }, element: Element) => {
    if (!previousPointerOffset) {
      previousPointerOffset = pointerOffset;
      return null;
    }
    const xDiff = pointerOffset.x - previousPointerOffset.x;
    const yDiff = pointerOffset.y - previousPointerOffset.y;

    const rect = element.getBoundingClientRect();
    const { x, y } = pointerOffset;
    const edgeSize = 8;
    const { left, top, width, height } = rect;
    const right = left + width;
    const bottom = top + height;
    const nearNorthEast =
      (y < top + edgeSize && x > right - width / 2) ||
      (y < top + height / 2 && x > right - edgeSize);
    const nearSouthEast =
      (y > bottom - edgeSize && x > right - width / 2) ||
      (y > bottom - height / 2 && x > right - edgeSize);
    const nearSouthWest =
      (y > bottom - edgeSize && x < left + width / 2) ||
      (y > bottom - height / 2 && x < left + edgeSize);
    const nearNorthWest =
      (y < top + edgeSize && x < left + width / 2) || (y < top + height / 2 && x < left + edgeSize);
    if (nearNorthEast && xDiff > 0 && yDiff < 0) {
      return "ne";
    }
    if (nearNorthWest && xDiff < 0 && yDiff < 0) {
      return "nw";
    }
    if (nearSouthEast && xDiff > 0 && yDiff > 0) {
      return "se";
    }
    if (nearSouthWest && xDiff < 0 && yDiff > 0) {
      return "sw";
    }
    return null;
  };

  let manipulatingCell = false;

  const removeWidgets = (ids: string[]) => {
    transaction(
      () => {
        undoHandle.change((doc) => {
          ids.forEach((id) => {
            deleteEntity(doc.children, id);
          });
        });

        stateHandle.change((doc) => {
          doc.selected = [];
        });
      },
      ids.length > 1 ? "Remove Boxes" : "Remove Box",
    );
    toast.success(ids.length > 1 ? "Boxes Removed" : "Box Removed", {
      action: {
        label: "Undo",
        onClick: () => {
          undoStore.undo();
        },
      },
    });
  };

  const mouseDown = (event: MouseEvent) => {
    if (event.target !== gridContainer || event.button !== 0) {
      return;
    }

    manipulatingCell = true;

    const id = nanoid();

    const cell = grid.getCellFromPixel({ left: event.offsetX, top: event.offsetY });
    let newElement = grid.addWidget({
      x: cell.x,
      y: cell.y,
      w: 1,
      h: 1,
      id,
    });

    removeHover();

    let elementReplaced = false;

    const mouseMove = (event: MouseEvent) => {
      if (!elementReplaced) {
        const activeElement = document.querySelector(`[gs-id="${id}"]`);
        if (activeElement !== newElement) {
          elementReplaced = true;
          newElement = activeElement as HTMLDivElement;
        }
      }

      const direction = resizeDirection({ x: event.clientX, y: event.clientY }, newElement);

      if (direction) {
        const dragElement = newElement?.querySelector(".ui-resizable-" + direction);
        dragElement?.dispatchEvent(
          new MouseEvent("mousedown", { clientX: event.clientX, clientY: event.clientY }),
        );
        document.removeEventListener("mousemove", mouseMove);
        document.removeEventListener("mouseup", mouseUp);
        previousPointerOffset = null;
        manipulatingCell = false;
      }
    };

    const mouseUp = () => {
      manipulatingCell = false;
      previousPointerOffset = null;
      document.removeEventListener("mousemove", mouseMove);
      document.removeEventListener("mouseup", mouseUp);
    };

    document.addEventListener("mousemove", mouseMove);
    document.addEventListener("mouseup", mouseUp);
  };

  let hoverCell: { x: number; y: number; element: HTMLDivElement | null } | null = null;

  // adds hover element to the grid
  const mouseMove = (event: MouseEvent) => {
    if (event.target !== gridContainer || manipulatingCell) {
      if (hoverCell?.element) {
        hoverCell.element.remove();
      }
      return;
    }

    const cell = grid.getCellFromPixel({ left: event.offsetX, top: event.offsetY });

    if (hoverCell?.x === cell.x && hoverCell?.y === cell.y) {
      return;
    }

    if (hoverCell?.element) {
      hoverCell.element.remove();
    }

    hoverCell = { x: cell.x, y: cell.y, element: null };

    if (cell.x < 0 || cell.y < 0) {
      return;
    }

    const element = grid
      .getGridItems()
      .find(
        (item) =>
          item.gridstackNode &&
          item.gridstackNode.x &&
          item.gridstackNode.y &&
          item.gridstackNode.w &&
          item.gridstackNode.h &&
          cell.x >= item.gridstackNode.x &&
          cell.x < item.gridstackNode.x + item.gridstackNode.w &&
          cell.y >= item.gridstackNode.y &&
          cell.y < item.gridstackNode.y + item.gridstackNode.h,
      );

    if (!element) {
      const hover = document.createElement("div");

      hover.style.position = "absolute";
      hover.style.left = cell.x * columnWidth + "px";
      hover.style.top = cell.y * rowHeight + "px";

      hover.style.width = columnWidth + "px";
      hover.style.height = rowHeight + "px";

      hover.style.backgroundColor = "rgba(0, 0, 0, 0.1)";
      hover.style.border = "1px dashed #000";
      hover.style.pointerEvents = "none";
      hover.style.zIndex = "1000";

      hoverCell.element = hover;

      gridContainer.appendChild(hover);
    }
  };

  const removeHover = () => {
    if (hoverCell?.element) {
      hoverCell.element.remove();
      hoverCell = null;
    }
  };

  onDestroy(() => {
    destroyGrid();
  });

  let width: number;
  let height: number;
  let columnWidth: number;
  $: columnWidth = width / columns;

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      if (!selected) {
        return;
      }
      removeWidgets($selected);
    }

    if (event.key === "a" && event.metaKey) {
      event.preventDefault();
      stateHandle.handle.change((doc) => {
        doc.selected = $gridData.children.ids;
      });
    }

    if (event.key === "z" && event.metaKey && !event.shiftKey) {
      event.preventDefault();
      undoStore.undo();
    }

    if (event.key === "z" && event.metaKey && event.shiftKey) {
      event.preventDefault();
      undoStore.redo();
    }
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="flex items-center justify-between">
  <div>
    <Button
      on:click={() => {
        if ($selected.length < 1) {
          return;
        }
        removeWidgets($selected);
      }}
      type="Delete"
      disabled={$selected.length < 1}
    />
  </div>
  <div class="flex">
    <Button
      type="Undo"
      on:click={() => {
        undoStore.undo();
      }}
      disabled={!$undos.length}
    />
    <Button
      type="Redo"
      on:click={() => {
        undoStore.redo();
      }}
      disabled={!$redos.length}
    />
  </div>
</div>

<!-- <button
  on:click={() =>
    transaction(() => {
      undoHandle.change((doc) => {
        if (doc.rows === undefined) {
          doc.rows = 3;
        }
        doc.rows++;
      });
    })}>Add Row</button
> -->

<div class="px-8 py-6 mt-2 bg-gray-50">
  <div
    class="grid-bg"
    style="--column-width: {columnWidth + 'px'}; --row-height: {rowHeight + 'px'}"
  >
    <div
      role="grid"
      tabindex="-1"
      bind:this={gridContainer}
      bind:clientHeight={height}
      bind:clientWidth={width}
      on:mousedown={mouseDown}
      on:mousemove={mouseMove}
      on:mouseleave={removeHover}
    ></div>
  </div>
</div>

<style>
  :focus-visible {
    outline: none;
  }

  .grid-bg {
    position: relative;
    /* diameter of the circle */
    --d: 2px;

    background: radial-gradient(
        circle at var(--d) var(--d),
        #333 calc(var(--d) - 1px),
        #0000 var(--d)
      )
      0 0 / var(--column-width) var(--row-height);

    padding: 2px;
    margin-top: 2px;
  }

  :global(.grid-stack) {
    position: relative;
  }

  :global(.grid-stack-item.selected) {
    outline: 2px solid red;
    z-index: 2;
  }

  :global(.grid-stack-item-content) {
    background-color: white;
    border: 1px solid #ddd;
    user-select: none;
  }

  :global(.ui-resizable-handle) {
    opacity: 0;
  }

  :global(.grid-stack-item > .ui-resizable-e),
  :global(.grid-stack-item > .ui-resizable-w) {
    width: 8px;
    top: 8px;
    bottom: 8px;
  }

  :global(.grid-stack-item > .ui-resizable-n),
  :global(.grid-stack-item > .ui-resizable-s) {
    height: 8px;
    left: 8px;
    right: 8px;
  }

  :global(.grid-stack-item > .ui-resizable-ne),
  :global(.grid-stack-item > .ui-resizable-sw) {
    width: 8px;
    height: 8px;
    transform: rotate(45deg);
  }

  :global(.grid-stack-item > .ui-resizable-nw),
  :global(.grid-stack-item > .ui-resizable-se) {
    width: 8px;
    height: 8px;
    transform: rotate(-45deg);
  }

  :global(.gs-24 > .grid-stack-item) {
    width: 4.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="1"]) {
    left: 4.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="2"]) {
    width: 8.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="2"]) {
    left: 8.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="3"]) {
    width: 12.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="3"]) {
    left: 12.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="4"]) {
    width: 16.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="4"]) {
    left: 16.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="5"]) {
    width: 20.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="5"]) {
    left: 20.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="6"]) {
    width: 25%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="6"]) {
    left: 25%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="7"]) {
    width: 29.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="7"]) {
    left: 29.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="8"]) {
    width: 33.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="8"]) {
    left: 33.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="9"]) {
    width: 37.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="9"]) {
    left: 37.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="10"]) {
    width: 41.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="10"]) {
    left: 41.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="11"]) {
    width: 45.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="11"]) {
    left: 45.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="12"]) {
    width: 50%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="12"]) {
    left: 50%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="13"]) {
    width: 54.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="13"]) {
    left: 54.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="14"]) {
    width: 58.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="14"]) {
    left: 58.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="15"]) {
    width: 62.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="15"]) {
    left: 62.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="16"]) {
    width: 66.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="16"]) {
    left: 66.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="17"]) {
    width: 70.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="17"]) {
    left: 70.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="18"]) {
    width: 75%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="18"]) {
    left: 75%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="19"]) {
    width: 79.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="19"]) {
    left: 79.167%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="20"]) {
    width: 83.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="20"]) {
    left: 83.333%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="21"]) {
    width: 87.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="21"]) {
    left: 87.5%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="22"]) {
    width: 91.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="22"]) {
    left: 91.667%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="23"]) {
    width: 95.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-x="23"]) {
    left: 95.833%;
  }

  :global(.gs-24 > .grid-stack-item[gs-w="24"]) {
    width: 100%;
  }
</style>
