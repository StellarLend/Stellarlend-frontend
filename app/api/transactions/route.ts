import { NextResponse } from "next/server";
import { parseTransactionParams } from "../../../lib/transactions/validator";
import { fetchTransactions } from "../../../types/Transaction";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { params, errors } = parseTransactionParams(searchParams);

  if (errors) {
    return NextResponse.json({ error: "Invalid parameters", details: errors }, { status: 400 });
  }

  // Use the mock data as our database
  let data = await fetchTransactions();

  // 1. Filter
  if (params.status) data = data.filter(t => t.status === params.status);
  if (params.asset) data = data.filter(t => t.asset === params.asset);
  if (params.startDate) data = data.filter(t => new Date(t.date) >= new Date(params.startDate!));
  if (params.endDate) data = data.filter(t => new Date(t.date) <= new Date(params.endDate!));

  // 2. Sort
  data.sort((a, b) => {
    if (params.sort === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
    if (params.sort === "amount-desc") return Math.abs(b.amount) - Math.abs(a.amount);
    if (params.sort === "amount-asc") return Math.abs(a.amount) - Math.abs(b.amount);
    return new Date(b.date).getTime() - new Date(a.date).getTime(); // default: date-desc
  });

  // 3. Paginate
  const totalCount = data.length;
  const totalPages = Math.ceil(totalCount / params.pageSize);
  const startIndex = (params.page - 1) * params.pageSize;
  const paginatedData = data.slice(startIndex, startIndex + params.pageSize);

  // 4. Return Data + Metadata
  return NextResponse.json({
    data: paginatedData,
    meta: { page: params.page, pageSize: params.pageSize, totalCount, totalPages }
  });
}
