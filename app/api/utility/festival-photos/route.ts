import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB cap to avoid oversized uploads

type FestivalPhoto = {
  id: number;
  startDate: string;
  endDate: string;
  description: string;
  imageUrl: string;
  createdAt: string;
};

const uploadDir = path.join(process.cwd(), "public", "uploads", "festival-photos");
const metadataPath = path.join(uploadDir, "metadata.json");

async function loadMetadata(): Promise<FestivalPhoto[]> {
  try {
    const raw = await fs.readFile(metadataPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FestivalPhoto[];
    return [];
  } catch {
    return [];
  }
}

async function saveMetadata(list: FestivalPhoto[]) {
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify(list, null, 2), "utf8");
}

export async function GET() {
  try {
    const list = await loadMetadata();
    return NextResponse.json({ success: true, data: list });
  } catch (error: unknown) {
    console.error("Festival photo fetch failed", error);
    return NextResponse.json({ success: false, error: "Failed to load festival photos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const startDate = String(formData.get("startDate") || "").trim();
    const endDate = String(formData.get("endDate") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const image = formData.get("image");

    if (!startDate || !endDate || !description || !(image instanceof File)) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ success: false, error: "Start Date cannot be after End Date." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ success: false, error: "Image file is empty." }, { status: 400 });
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "Image exceeds 5MB limit." }, { status: 413 });
    }

    if (image.type && !image.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "Only image uploads are allowed." }, { status: 400 });
    }

    const safeName = image.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const fileName = `${Date.now()}-${safeName || "festival"}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    const imageUrl = `/uploads/festival-photos/${fileName}`;

    const existing = await loadMetadata();
    const nextId = existing.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    const record: FestivalPhoto = {
      id: nextId,
      startDate,
      endDate,
      description,
      imageUrl,
      createdAt: new Date().toISOString(),
    };

    const updated = [record, ...existing];
    await saveMetadata(updated);

    return NextResponse.json({
      success: true,
      data: {
        ...record,
      },
    });
  } catch (error: unknown) {
    console.error("Festival photo upload failed", error);
    return NextResponse.json({ success: false, error: "Unexpected server error." }, { status: 500 });
  }
}
