import type {
	Column,
	Row,
	CellValue,
} from "@data-validator/validator-mastermind";
import { DataTable } from "@/components/data-table";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";

interface ErrorTableProps {
	columns: Column[];
	rows: Row[];
	onCellUpdate: (rowId: string, columnKey: string, value: CellValue) => void;
}

export function ValidationErrorsTable({
	columns,
	rows,
	onCellUpdate,
}: ErrorTableProps) {
	const errorRows = rows.filter((r) =>
		Object.values(r.errors).some((e) => e.length > 0),
	);

	if (errorRows.length === 0) return null;

	const ROW_HEIGHT = 44;
	const HEADER_HEIGHT = 44;
	const height = `${Math.min(errorRows.length * ROW_HEIGHT + HEADER_HEIGHT, 400)}px`;

	return (
		<Accordion type="single" collapsible>
			<AccordionItem value="errors">
				<AccordionTrigger className="text-base font-semibold text-destructive hover:no-underline cursor-pointer">
					Rows with errors ({errorRows.length})
				</AccordionTrigger>

				<AccordionContent>
					<DataTable
						columns={columns}
						rows={errorRows}
						onCellUpdate={onCellUpdate}
						height={height}
					/>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
