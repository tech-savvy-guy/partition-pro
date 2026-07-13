import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * A single coverage table block (title + header + rows). Mirrors the ROI
 * CompareCoverage `CoverageTableBlock`. Cells arrive preformatted from the
 * workspace; an absent/empty `rows` renders the placeholder body row.
 */
export function CoverageTable({
  title,
  columns,
  rows,
}: {
  title: string
  columns: string[]
  rows?: (string | number)[][]
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <div className="overflow-x-auto border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column}
                  className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.length ? (
              rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex} className="text-xs">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  No coverage data yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
