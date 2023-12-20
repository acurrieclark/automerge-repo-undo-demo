<script lang="ts">
	import { nanoid } from 'nanoid';
	import 'gridstack/dist/gridstack.min.css';
	import {
		GridStack,
		type GridItemHTMLElement,
		type GridStackNode,
		type GridStackOptions,
		type GridStackWidget
	} from 'gridstack';
	import { onDestroy } from 'svelte';

	let gridContainer: HTMLDivElement;

	let grid: GridStack;

	let columns = 24;

	let rows = 3;

	let rowHeight = 33;

	$: grid?.column(columns);

	let savedGrid: GridStackOptions;

	const boxes: Record<string, GridItemHTMLElement> = {};

	const unlisteners: (() => void)[] = [];
	const initGrid = async (rows: number, columns: number) => {
		saveGrid();
		destroyGrid();

		const bigOne: GridStackWidget = { x: 1, y: 1, w: 2, h: 2, content: 'Big one', id: nanoid() };
		const litleOne: GridStackWidget = {
			x: 4,
			y: 2,
			w: 1,
			h: 1,
			content: 'Little one',
			id: nanoid()
		};

		const defaultGrid = {
			children: [],
			animate: false,
			float: true,
			row: rows,
			column: columns,
			margin: 0,
			cellHeight: rowHeight,
			resizable: {
				handles: 'all'
			}
		};

		let selected: string | null = null;

		const selectBox = (box: GridItemHTMLElement, toggle = false) => {
			selected === box.id ?? null;
			if (toggle) {
				box.classList.toggle('selected');
				selected = selected === box.id ? null : box.id;
			} else {
				selected = box.id;
				box.classList.add('selected');
			}
			Object.values(boxes).forEach((b) => {
				if (b !== box) {
					b.classList.remove('selected');
				}
			});
		};

		const gridToUse = savedGrid
			? { ...savedGrid, cellHeight: rowHeight, column: columns, row: rows, children: [] }
			: defaultGrid;

		const children = savedGrid ? savedGrid.children : [bigOne, litleOne];

		grid = GridStack.init(gridToUse, gridContainer)
			.on('added', (event: Event, items: GridStackNode[]) => {
				items.forEach((item) => {
					if (item.el === undefined || item.id === undefined) {
						return;
					}

					boxes[item.id] = item.el;
					const listener = (event: MouseEvent) => {
						if (item.el === undefined) {
							return;
						}
						selectBox(item.el, event.metaKey);
					};
					item.el?.addEventListener('click', listener);

					unlisteners.push(() => {
						item.el?.removeEventListener('click', listener);
					});

					selectBox(item.el);
				});
			})
			.on('dragstart', (event: Event, el: GridItemHTMLElement) => {
				if (el === undefined) {
					return;
				}
				selectBox(el);
			})
			.on('resizestart', (event: Event, el: GridItemHTMLElement) => {
				if (el === undefined) {
					return;
				}
				selectBox(el);
			});

		grid.load(children ?? []);
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
			initGrid(rows, columns);
		}
	}

	const mouseDown = (event: MouseEvent) => {
		if (event.target !== gridContainer) {
			return;
		}
		const cell = grid.getCellFromPixel({ left: event.offsetX, top: event.offsetY });
		const newElement = grid.addWidget({
			x: cell.x,
			y: cell.y,
			w: 1,
			h: 1,
			content: 'New widget',
			id: nanoid()
		});

		const dragElement = newElement.querySelector('.ui-resizable-se');

		dragElement?.dispatchEvent(
			new MouseEvent('mousedown', { clientX: event.clientX, clientY: event.clientY })
		);
	};

	onDestroy(() => {
		destroyGrid();
	});

	let width: number;
	let height: number;
	let columnWidth: number;
	$: columnWidth = width / columns;
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

<button on:click={() => rows++}>Add Row</button>

<div class="grid-bg" style="--column-width: {columnWidth + 'px'}; --row-height: {rowHeight + 'px'}">
	<div
		role="grid"
		tabindex="-1"
		bind:this={gridContainer}
		bind:clientHeight={height}
		bind:clientWidth={width}
		on:mousedown={mouseDown}
	></div>
</div>

<style>
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
		outline: 2px solid #07c;
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
	:global(.gs-24 > .grid-stack-item[gs-x='1']) {
		left: 4.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='2']) {
		width: 8.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='2']) {
		left: 8.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='3']) {
		width: 12.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='3']) {
		left: 12.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='4']) {
		width: 16.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='4']) {
		left: 16.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='5']) {
		width: 20.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='5']) {
		left: 20.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='6']) {
		width: 25%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='6']) {
		left: 25%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='7']) {
		width: 29.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='7']) {
		left: 29.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='8']) {
		width: 33.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='8']) {
		left: 33.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='9']) {
		width: 37.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='9']) {
		left: 37.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='10']) {
		width: 41.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='10']) {
		left: 41.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='11']) {
		width: 45.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='11']) {
		left: 45.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='12']) {
		width: 50%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='12']) {
		left: 50%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='13']) {
		width: 54.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='13']) {
		left: 54.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='14']) {
		width: 58.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='14']) {
		left: 58.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='15']) {
		width: 62.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='15']) {
		left: 62.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='16']) {
		width: 66.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='16']) {
		left: 66.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='17']) {
		width: 70.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='17']) {
		left: 70.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='18']) {
		width: 75%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='18']) {
		left: 75%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='19']) {
		width: 79.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='19']) {
		left: 79.167%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='20']) {
		width: 83.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='20']) {
		left: 83.333%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='21']) {
		width: 87.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='21']) {
		left: 87.5%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='22']) {
		width: 91.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='22']) {
		left: 91.667%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='23']) {
		width: 95.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-x='23']) {
		left: 95.833%;
	}
	:global(.gs-24 > .grid-stack-item[gs-w='24']) {
		width: 100%;
	}
</style>
