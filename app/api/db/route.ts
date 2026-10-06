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
    const exportFormat = searchParams.get("export");
    const doBackup = searchParams.get("backup");

    if (doBackup === "true") {
      const backupPath = await db.backup();
      return NextResponse.json({ success: true, backupPath });
    }

    if (stats === "true") {
      return NextResponse.json({ success: true, data: db.getStats() });
    }

    if (key) {
      const data = db.get(key);
      return NextResponse.json({ success: true, data });
    }

    if (collection) {
      const col = db.collection(collection);

      if (exportFormat === "json") {
        return new Response(col.exportJson(), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${collection}.json"`,
          },
        });
      }

      if (exportFormat === "csv") {
        return new Response(col.exportCsv(), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${collection}.csv"`,
          },
        });
      }

      if (id) {
        const item = col.findOne(id);
        return NextResponse.json({ success: true, data: item });
      }

      const filter: Record<string, any> = {};
      const options: Record<string, any> = {};

      searchParams.forEach((val, k) => {
        if (k === "collection" || k === "id" || k === "export" || k === "stats" || k === "key") return;

        if (k === "_sort") options.sort = val;
        else if (k === "_order") options.order = val === "desc" ? "desc" : "asc";
        else if (k === "_limit") options.limit = parseInt(val, 10);
        else if (k === "_page") options.page = parseInt(val, 10);
        else if (k === "_skip") options.skip = parseInt(val, 10);
        else if (k === "_search") filter._search = val;
        else {
          filter[k] = val === "true" ? true : val === "false" ? false : val;
        }
      });

      if (options.page && options.limit) {
        const paginated = col.findPaginated(filter, options);
        return NextResponse.json({ success: true, ...paginated });
      }

      const items = col.find(Object.keys(filter).length > 0 ? filter : undefined, options);
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
    const { action, collection, id, data, key, filter, backupPath } = body;

    if (action === "insert" && collection && data) {
      const inserted = await db.collection(collection).insert(data);
      return NextResponse.json({ success: true, data: inserted });
    }

    if (action === "insertMany" && collection && Array.isArray(data)) {
      const inserted = await db.collection(collection).insertMany(data);
      return NextResponse.json({ success: true, data: inserted, count: inserted.length });
    }

    if (action === "update" && collection && id && data) {
      const updated = await db.collection(collection).update(id, data);
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "updateMany" && collection && filter && data) {
      const count = await db.collection(collection).updateMany(filter, data);
      return NextResponse.json({ success: true, count });
    }

    if (action === "delete" && collection && id) {
      const deleted = await db.collection(collection).delete(id);
      return NextResponse.json({ success: true, deleted });
    }

    if (action === "deleteMany" && collection && filter) {
      const count = await db.collection(collection).deleteMany(filter);
      return NextResponse.json({ success: true, count });
    }

    if (action === "clear" && collection) {
      const cleared = await db.collection(collection).clear();
      return NextResponse.json({ success: true, cleared });
    }

    if (action === "import" && collection && data) {
      const result = await db.collection(collection).importJson(data);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "backup") {
      const path = await db.backup(backupPath);
      return NextResponse.json({ success: true, backupPath: path });
    }

    if (action === "restore" && backupPath) {
      const restored = await db.restore(backupPath);
      return NextResponse.json({ success: true, restored });
    }

    if (action === "reset") {
      const reset = await db.reset();
      return NextResponse.json({ success: true, reset });
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
