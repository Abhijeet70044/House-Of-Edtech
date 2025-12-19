import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemSchema } from "@/lib/validators";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All logged-in users see the same inventory (no owner filter)
  const items = await prisma.item.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const item = await prisma.item.create({
      data: { ...parsed.data, ownerId: user.id },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create item" },
      { status: 500 },
    );
  }
}

