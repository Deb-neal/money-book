import { supabase } from "./supabase";
import { parseAnalysis, type BillAnalysis } from "./cardBills";

/** EXIF 등의 메타데이터를 제외하고 캡처를 JPEG로 변환한다. */
export async function prepareBillImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG, PNG, WebP 이미지를 선택해 주세요.");
  if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하 이미지를 선택해 주세요.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (img.naturalWidth * img.naturalHeight > 40_000_000) throw new Error("이미지가 너무 커요. 캡처 영역을 줄여 주세요.");
    const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("이미지를 읽지 못했어요.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.75, 0.6]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length < 2_600_000) return data;
    }
    throw new Error("이미지가 너무 커요. 캡처 영역을 줄여 주세요.");
  } finally { URL.revokeObjectURL(url); }
}

export async function analyzeCardBill(image: string, month: string): Promise<BillAnalysis> {
  if (!supabase) throw new Error("로그인 후 캡처 분석을 사용할 수 있어요.");
  const { data, error } = await supabase.functions.invoke("analyze-card-bill", { body: { image, month } });
  if (error) {
    let message = "캡처 분석에 연결하지 못했어요. 잠시 후 다시 시도하거나 직접 입력해 주세요.";
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        if (typeof body.error === "string") message = body.error;
        else if (error.context.status === 401) message = "로그인이 만료됐어요. 다시 로그인해 주세요.";
      } catch {}
    }
    throw new Error(message);
  }
  return parseAnalysis(data);
}
