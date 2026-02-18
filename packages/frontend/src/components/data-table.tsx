import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useState, useCallback, useRef, useEffect, memo } from "react";
import type {
	Column,
	Row,
	CellValue,
	CellType,
	ValidationError,
} from "@data-validator/validator-mastermind";
import { ArrowUpDown, ChevronLeft, ChevronRight, OctagonAlert } from "lucide-react";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Field } from "./ui/field";

function formatCellValue(value: CellValue, type: CellType): string {
	if (value === null || value === undefined) return "—";
	switch (type) {
		case "boolean":
			return value ? "Yes" : "No";
		case "number":
			return typeof value === "number" ? value.toLocaleString() : String(value);
		case "date":
			if (typeof value === "string") {
				const date = new Date(value);
				if (!isNaN(date.getTime())) return date.toLocaleDateString();
			}
			return String(value);
		default:
			return String(value);
	}
}

function parseEditValue(input: string, type: CellType): CellValue {
	if (input.trim() === "") return null;
	switch (type) {
		case "number": {
			const num = Number(input);
			return isNaN(num) ? input : num;
		}
		case "boolean": {
			const lower = input.toLowerCase();
			if (["true", "yes", "1"].includes(lower)) return true;
			if (["false", "no", "0"].includes(lower)) return false;
			return input;
		}
		default:
			return input;
	}
}

function getPageNumbers(pageCount: number, currentPage: number): (number | "...")[] {
	if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
	const pages: (number | "...")[] = [0];
	const start = Math.max(1, currentPage - 2);
	const end = Math.min(pageCount - 2, currentPage + 2);
	if (start > 1) pages.push("...");
	for (let i = start; i <= end; i++) pages.push(i);
	if (end < pageCount - 2) pages.push("...");
	pages.push(pageCount - 1);
	return pages;
}

interface EditableCellProps {
	value: CellValue;
	columnKey: string;
	columnType: CellType;
	rowId: string;
	errors: ValidationError[];
	onUpdate: (rowId: string, columnKey: string, value: CellValue) => void;
}

const EditableCell = memo(function EditableCell({
	value,
	columnKey,
	columnType,
	rowId,
	errors,
	onUpdate,
}: EditableCellProps) {
	const [open, setOpen] = useState(false);
	const [editValue, setEditValue] = useState(() =>
		value === null || value === undefined ? "" : String(value),
	);
	const [pendingBool, setPendingBool] = useState<boolean>(() => value === true);
	const [pendingDate, setPendingDate] = useState<Date | undefined>(() => {
		if (value && typeof value === "string") {
			const d = new Date(value);
			return isNaN(d.getTime()) ? undefined : d;
		}
		return undefined;
	});
	const inputRef = useRef<HTMLInputElement>(null);
	const hasErrors = errors.length > 0;

	useEffect(() => {
		if (!open) {
			setEditValue(value === null || value === undefined ? "" : String(value));
			setPendingBool(value === true);
			setPendingDate(() => {
				if (value && typeof value === "string") {
					const d = new Date(value);
					return isNaN(d.getTime()) ? undefined : d;
				}
				return undefined;
			});
		}
	}, [value, open]);

	useEffect(() => {
		if (
			open &&
			(columnType === "string" || columnType === "number") &&
			inputRef.current
		) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [open, columnType]);

	const handleSave = useCallback(() => {
		let newValue: CellValue;
		switch (columnType) {
			case "string":
			case "number":
				newValue = parseEditValue(editValue, columnType);
				break;
			case "boolean":
				newValue = pendingBool;
				break;
			case "date":
				newValue = pendingDate ? pendingDate.toISOString().split("T")[0] : null;
				break;
		}
		if (newValue !== value) {
			onUpdate(rowId, columnKey, newValue);
		}
		setOpen(false);
	}, [columnType, editValue, pendingBool, pendingDate, value, onUpdate, rowId, columnKey]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleSave();
			}
		},
		[handleSave],
	);

	function renderContent() {
		switch (columnType) {
			case "string":
				return (
					<Input
						ref={inputRef}
						type="text"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						aria-label={`Edit ${columnKey}`}
						aria-invalid={hasErrors || undefined}
					/>
				);
			case "number":
				return (
					<Input
						ref={inputRef}
						type="number"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						aria-label={`Edit ${columnKey}`}
						aria-invalid={hasErrors || undefined}
					/>
				);
			case "boolean":
				return (
					<div className="flex items-center gap-2 px-1 py-1">
						<Checkbox
							id={`${rowId}-${columnKey}`}
							checked={pendingBool}
							onCheckedChange={(next) => setPendingBool(next === true)}
						/>
						<label
							htmlFor={`${rowId}-${columnKey}`}
							className="cursor-pointer select-none text-sm"
						>
							{pendingBool ? "True" : "False"}
						</label>
					</div>
				);
			case "date":
				return (
					<Calendar
						mode="single"
						selected={pendingDate}
						onSelect={(date) => setPendingDate(date ?? undefined)}
					/>
				);
		}
	}

	const isTextInput = columnType === "string" || columnType === "number";

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<div
					className={cn(
						"flex h-8 cursor-pointer items-center gap-1 rounded px-1 -mx-1 hover:bg-muted/50",
						hasErrors && "text-destructive",
					)}
					tabIndex={0}
					role="gridcell"
					title={
						hasErrors
							? errors.map((e) => e.message).join(", ")
							: "Click to edit"
					}
				>
					<span>{formatCellValue(value, columnType)}</span>
					{hasErrors && <OctagonAlert size={16} className="text-destructive" />}
				</div>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className={cn(
					"w-64",
					isTextInput && "w-[--radix-popover-trigger-width] p-1",
					columnType === "boolean" && "w-auto p-2",
					columnType === "date" && "w-auto p-0",
				)}
			>
				<div className="flex w-full flex-col gap-4">
					{renderContent()}

					<Field orientation="horizontal">
						<Button variant="outline" size="sm" onClick={() => setOpen(false)}>
							Cancel
						</Button>

						<Button variant="outline" size="sm" onClick={handleSave}>
							Save
						</Button>
					</Field>
				</div>
			</PopoverContent>
		</Popover>
	);
});

function buildColumns(
	columns: Column[],
	onCellUpdate?: (rowId: string, columnKey: string, value: CellValue) => void,
): ColumnDef<Row>[] {
	return columns.map((col) => ({
		accessorFn: (row: Row) => row.cells[col.key],
		id: col.key,
		header: ({ column }) => (
			<Button
				variant="ghost"
				size="sm"
				className="-ml-3"
				onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
			>
				{col.label}
				<ArrowUpDown className="ml-2 size-4" />
			</Button>
		),
		cell: ({ row: tableRow }) => {
			const value = tableRow.original.cells[col.key];
			const errors = tableRow.original.errors[col.key] ?? [];

			if (onCellUpdate) {
				return (
					<EditableCell
						value={value}
						columnKey={col.key}
						columnType={col.type}
						rowId={tableRow.original.id}
						errors={errors}
						onUpdate={onCellUpdate}
					/>
				);
			}
			return (
				<div
					className={cn(
						"flex items-center gap-1",
						errors.length > 0 && "text-destructive",
					)}
				>
					<span>{formatCellValue(value, col.type)}</span>
					{errors.length > 0 && (
						<span
							className="text-destructive text-xs"
							title={errors.map((e) => e.message).join(", ")}
						>
							⚠
						</span>
					)}
				</div>
			);
		},
	}));
}

interface DataTableProps {
	columns: Column[];
	rows: Row[];
	onCellUpdate?: (rowId: string, columnKey: string, value: CellValue) => void;
	className?: string;
}

function DataTable({ columns, rows, onCellUpdate, className }: DataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);

	const tableColumns = buildColumns(columns, onCellUpdate);

	const table = useReactTable({
		data: rows,
		columns: tableColumns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		state: { sorting },
		getRowId: (row) => row.id,
		initialState: { pagination: { pageSize: 50 } },
	});

	const { pageIndex, pageSize } = table.getState().pagination;
	const pageCount = table.getPageCount();

	return (
		<div className={cn("space-y-4", className)}>

			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								<TableHead className="w-10 text-right text-muted-foreground">#</TableHead>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length ? (
							table.getRowModel().rows.map((row, i) => {
								const rowNumber = pageIndex * pageSize + i + 1;
								return (
									<TableRow key={row.id}>
										<TableCell className="w-10 text-right text-xs text-muted-foreground tabular-nums">
											{rowNumber}
										</TableCell>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								);
							})
						) : (
							<TableRow>
								<TableCell
									colSpan={tableColumns.length + 1}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-between px-2">
				<p className="text-muted-foreground text-sm">
					{table.getFilteredRowModel().rows.length} row(s) total
				</p>
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
						aria-label="Previous page"
					>
						<ChevronLeft className="size-4" />
					</Button>
					{getPageNumbers(pageCount, pageIndex).map((page, idx) =>
						page === "..." ? (
							<span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm select-none">
								…
							</span>
						) : (
							<Button
								key={page}
								variant={page === pageIndex ? "default" : "outline"}
								size="sm"
								className="min-w-8"
								onClick={() => table.setPageIndex(page)}
								aria-label={`Page ${page + 1}`}
								aria-current={page === pageIndex ? "page" : undefined}
							>
								{page + 1}
							</Button>
						),
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
						aria-label="Next page"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}

export { DataTable };
