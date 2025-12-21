import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemUpdateSchema } from "@/lib/validators";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH: update item
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const paramsResolved = await context.params; // <-- unwrap Promise
  const user = await requireUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = itemUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.item.findUnique({
    where: { id: paramsResolved.id },

    select: { id: true, ownerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = await prisma.item.update({
    where: { id: paramsResolved.id },
    data: parsed.data,
  });

  return NextResponse.json({ item }, { status: 200 });
}

// DELETE: remove item
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const paramsResolved = await context.params; // <-- unwrap Promise
  const user = await requireUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  if (!paramsResolved?.id) {
    return NextResponse.json({ error: "Item id missing in route" }, { status: 400 });
  }

  const existing = await prisma.item.findUnique({
    where: { id: paramsResolved.id },
    select: { id: true, ownerId: true },
  });

  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.item.delete({ where: { id: paramsResolved.id } });

  return NextResponse.json({ success: true }, { status: 200 });
}
