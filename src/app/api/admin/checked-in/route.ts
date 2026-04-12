import { prisma } from "@/lib/prisma";
import { sanitizeText } from "@/lib/security/input";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/admin/checked-in?page=&pageSize=&checkoutStatus=&q=
 * checkoutStatus: (ว่าง)=ทั้งหมดที่เช็คอินแล้ว | in_event=ยังไม่เช็คเอาท์ | checked_out=เช็คเอาท์แล้ว
 * q: ค้นหา ชื่อ / เบอร์ / booking code
 */
export async function GET(request: NextRequest) {
  const rawPage = request.nextUrl.searchParams.get("page");
  const rawPageSize = request.nextUrl.searchParams.get("pageSize");
  const pageSize = Math.min(Math.max(Number.parseInt(rawPageSize ?? "20", 10) || 20, 1), 100);
  const page = Math.max(Number.parseInt(rawPage ?? "1", 10) || 1, 1);
  const skip = (page - 1) * pageSize;

  const checkoutStatus = request.nextUrl.searchParams.get("checkoutStatus");
  const qRaw = request.nextUrl.searchParams.get("q");
  const q = qRaw ? sanitizeText(qRaw, 120) : "";

  const baseWhere: Prisma.BookingWhereInput = { status: "checked_in" };

  if (checkoutStatus === "in_event") {
    baseWhere.checkedOutAt = null;
  } else if (checkoutStatus === "checked_out") {
    baseWhere.checkedOutAt = { not: null };
  }

  const where: Prisma.BookingWhereInput = {
    ...baseWhere,
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { bookingCode: { contains: q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  try {
    const [rows, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { checkedInAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          bookingCode: true,
          phone: true,
          checkedInAt: true,
          lineDisplay: true,
          drinkCount: true,
          checkedOutAt: true
        }
      }),
      prisma.booking.count({ where })
    ]);

    return NextResponse.json({ rows, total, page, pageSize });
  } catch (err) {
    const hint =
      err instanceof Error && /drinkCount|checkedOutAt|column/i.test(err.message)
        ? "รัน `npx prisma migrate deploy` (หรือ `migrate dev`) เพื่อเพิ่มคอลัมน์ drinkCount / checkedOutAt ในตาราง Booking"
        : "ตรวจสอบ DATABASE_URL และ log ฝั่งเซิร์ฟเวอร์";
    console.error("[checked-in]", err);
    return NextResponse.json(
      {
        message: `โหลดรายชื่อไม่สำเร็จ — ${hint}`,
        rows: [],
        total: 0,
        page,
        pageSize
      },
      { status: 500 }
    );
  }
}
