import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    const stats = searchParams.get("stats");
    const collection = searchParams.get("collection");
    const id = searchParams.get("id");

    if (stats === "true") {
      return NextResponse.json({ success: true, data: db.getStats() });
    }

    if (key) {
      const data = db.get(key);
      return NextResponse.json({ success: true, data });
    }

    if (collection) {
      if (id) {
        const item = db.collection(collection).findOne(id);
        return NextResponse.json({ success: true, data: item });
      }

      // Filter query parameters (excluding special params)
      const filter: Record<string, any> = {};
      searchParams.forEach((val, k) => {
        if (k !== "collection" && k !== "id" && k !== "_") {
          filter[k] = val === "true" ? true : val === "false" ? false : val;
        }
      });

      const items = db.collection(collection).find(Object.keys(filter).length > 0 ? filter : undefined);
      return NextResponse.json({ success: true, data: items, count: items.length });
    }

    return NextResponse.json({ success: true, data: db.getStats() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, collection, id, data, key } = body;

    if (action === "insert" && collection && data) {
      const inserted = await db.collection(collection).insert(data);
      return NextResponse.json({ success: true, data: inserted });
    }

    if (action === "update" && collection && id && data) {
      const updated = await db.collection(collection).update(id, data);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "delete" && collection && id) {
      const deleted = await db.collection(collection).delete(id);
      return NextResponse.json({ success: true, deleted });
    }

    if (action === "set" && key) {
      const saved = await db.set(key, data);
      return NextResponse.json({ success: true, data: saved });
    }

    if (action === "deleteKey" && key) {
      const deleted = await db.deleteKey(key);
      return NextResponse.json({ success: true, deleted });
    }

    return NextResponse.json({ success: false, error: "Invalid action or parameters" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
